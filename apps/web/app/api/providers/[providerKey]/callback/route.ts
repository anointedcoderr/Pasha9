// Built by Anointed Coder.
//
// POST /api/providers/<providerKey>/callback?key=<callbackSecret>
//
// Inbound provider webhook. Security gates BEFORE any wallet work:
//   1. Provider exists + active.
//   2. ?key= matches the stored callbackSecret.
//   3. Source IP is on the operator's whitelist (when configured).
//   4. Body parses into the adapter's NormalizedCallback shape.
//   5. Idempotency key `${providerKey}:${gameRound}` blocks replay.
//
// Every callback hit lands in ProviderCallbackLog, valid or not, so
// the operator can audit rejected hits and prove what we returned.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { loadProviderCreds } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { processProviderCallback } from '@/lib/providers/wallet';
import { maskPayload } from '@/lib/providers/mask';
import { ProviderAdapterError } from '@/lib/providers/types';

function getClientIp(req: NextRequest): string {
  // Behind Cloudflare + nginx the caller's real IP is in CF-Connecting-IP
  // (set by Cloudflare, not client-spoofable) and mirrored to X-Real-IP by
  // nginx. Prefer those over the left-most X-Forwarded-For entry, which a
  // client can inject and which can otherwise be a Cloudflare edge IP - either
  // would make the IP whitelist compare the wrong address and reject genuine
  // provider callbacks, showing up as a game balance that updates only "in
  // some cases".
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xreal = req.headers.get('x-real-ip');
  if (xreal) return xreal.trim();
  const xfwd = req.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  return '';
}

function ipAllowed(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true; // no whitelist = accept any
  if (!ip) return false;
  // Phase 3A: exact-match only. CIDR support can layer on later.
  return whitelist.includes(ip);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i += 1) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function POST(req: NextRequest, { params }: { params: { providerKey: string } }) {
  const ip = getClientIp(req);
  const url = new URL(req.url);
  const providedKey = url.searchParams.get('key') || '';

  // Provider lookup with minimal columns first - we want to log
  // every attempt even if the provider does not exist.
  const provider = await db.gameProvider.findUnique({ where: { providerKey: params.providerKey } });
  if (!provider) {
    // Provider does not exist - cannot FK a log row. The hit is
    // still surfaced via the access log on the reverse proxy and
    // the activity log on the IP block list. Silent 404 reply.
    return new Response(JSON.stringify({ code: 1, msg: 'PROVIDER_NOT_FOUND', timestamp: Date.now() }), { status: 404, headers: { 'content-type': 'application/json' } });
  }

  const creds = await loadProviderCreds(params.providerKey);
  if (!creds) {
    await db.providerCallbackLog.create({
      data: {
        providerId: provider.id, ip, method: 'POST',
        callbackKeyValid: false, ipValid: false, timestampValid: false,
        body: Prisma.JsonNull, response: { code: 1, msg: 'CREDENTIALS_MISSING' } as Prisma.InputJsonValue,
        error: 'CREDENTIALS_MISSING',
      },
    }).catch(() => undefined);
    return new Response(JSON.stringify({ code: 1, msg: 'CREDENTIALS_MISSING', timestamp: Date.now() }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const keyValid = creds.callbackSecret.length > 0 && timingSafeEqualStr(providedKey, creds.callbackSecret);
  const ipOk = ipAllowed(ip, creds.ipWhitelist);
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  const bodyRaw = await req.text();
  let bodyJson: unknown = null;
  if (!bodyRaw.length) {
    bodyJson = null;
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    // Form-encoded: convert into a flat object so the adapter alias
    // map can read it the same way as JSON. Numeric strings stay as
    // strings; pickNumber coerces them anyway.
    try {
      const params = new URLSearchParams(bodyRaw);
      const obj: Record<string, string> = {};
      params.forEach((v, k) => { obj[k] = v; });
      bodyJson = obj;
    } catch { bodyJson = { _raw: bodyRaw.slice(0, 2000) }; }
  } else {
    try { bodyJson = JSON.parse(bodyRaw); } catch { bodyJson = { _raw: bodyRaw.slice(0, 2000) }; }
  }

  if (!keyValid || !ipOk || !creds.active) {
    const errorCode = !keyValid ? 'UNAUTHORIZED_KEY' : !ipOk ? 'IP_NOT_WHITELISTED' : 'PROVIDER_INACTIVE';
    const response = { code: 1, msg: errorCode, timestamp: Date.now() };
    await db.providerCallbackLog.create({
      data: {
        providerId: provider.id,
        ip,
        method: 'POST',
        callbackKeyValid: keyValid,
        ipValid: ipOk,
        timestampValid: null,
        body: (maskPayload(bodyJson) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        response: response as Prisma.InputJsonValue,
        error: errorCode,
      },
    }).catch(() => undefined);
    return new Response(JSON.stringify(response), { status: 403, headers: { 'content-type': 'application/json' } });
  }

  const adapter = getAdapter(creds.adapterKey);
  if (!adapter) {
    const response = { code: 1, msg: 'ADAPTER_NOT_REGISTERED', timestamp: Date.now() };
    await db.providerCallbackLog.create({
      data: {
        providerId: provider.id, ip, method: 'POST',
        callbackKeyValid: keyValid, ipValid: ipOk, timestampValid: null,
        body: (maskPayload(bodyJson) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        response: response as Prisma.InputJsonValue,
        error: 'ADAPTER_NOT_REGISTERED',
      },
    }).catch(() => undefined);
    return new Response(JSON.stringify(response), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  try {
    const normalized = await adapter.parseCallback(creds, Object.fromEntries(req.headers.entries()), bodyJson);

    // Timestamp validity is informational here; the wallet pipeline
    // still processes, but the operator sees a flag in the log.
    const tsValid = normalized.timestamp
      ? Math.abs(Date.now() - normalized.timestamp.getTime()) / 1000 <= Math.max(60, creds.clockSkewSeconds * 4)
      : null;

    const result = await processProviderCallback(creds, normalized);

    const envelope = adapter.buildCallbackResponse(creds, {
      newBalance: result.walletAfter,
      betAmount: normalized.betAmount,
      winAmount: normalized.winAmount,
      responseMode: creds.callbackResponseMode,
      ok: result.status === 'accepted' || result.status === 'duplicate',
      errorCode: result.errorCode,
    });

    const responseWithDiag = {
      ...(envelope.body as Record<string, unknown>),
      _diagnostics: {
        ...(normalized.diagnostics ?? {}),
        status: result.status,
        errorCode: result.errorCode ?? null,
        userId: result.userId,
        walletBefore: result.walletBefore,
        walletAfter: result.walletAfter,
        netResult: result.netResult,
      },
    };
    await db.providerCallbackLog.create({
      data: {
        providerId: provider.id, ip, method: 'POST',
        callbackKeyValid: true, ipValid: true, timestampValid: tsValid,
        body: (maskPayload(bodyJson) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        response: responseWithDiag as Prisma.InputJsonValue,
        processedTxId: result.providerTxId,
        error: result.status === 'rejected' ? (result.errorCode ?? 'REJECTED') : null,
      },
    }).catch(() => undefined);

    return new Response(JSON.stringify(envelope.body), { status: envelope.status, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err instanceof ProviderAdapterError ? err.code : 'CALLBACK_FAILED';
    const response = { code: 1, msg: code, timestamp: Date.now() };
    await db.providerCallbackLog.create({
      data: {
        providerId: provider.id, ip, method: 'POST',
        callbackKeyValid: true, ipValid: true, timestampValid: null,
        body: (maskPayload(bodyJson) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        response: response as Prisma.InputJsonValue,
        error: `${code}: ${msg}`.slice(0, 300),
      },
    }).catch(() => undefined);
    return new Response(JSON.stringify(response), { status: err instanceof ProviderAdapterError ? err.status : 500, headers: { 'content-type': 'application/json' } });
  }
}
