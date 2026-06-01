// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/test-launch
// Body: { gameUid: string, userQuery?: string }
//
// Admin-only round trip that runs the launch flow against the
// upstream provider without redirecting the operator. The
// `userQuery` field accepts any of: internal user id (cuid),
// username, phone, or email. When omitted, defaults to the calling
// admin. Either way we look up or allocate the provider-specific
// numeric memberAccount (ProviderPlayerAccount) and send THAT as
// user_id upstream; the internal cuid is never exposed.
//
// Token + secret stay server-side: the adapter's raw response goes
// through maskPayload before reaching the browser.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { logRequest } from '@/lib/providers/log';
import { maskPayload } from '@/lib/providers/mask';
import { ProviderAdapterError } from '@/lib/providers/types';
import { getOrCreateMemberAccount } from '@/lib/providers/player-account';

const schema = z.object({
  gameUid: z.string().trim().min(1).max(120),
  userQuery: z.string().trim().min(1).max(160).optional(),
});

// Resolves a free-text query to a real User row. Accepts the cuid,
// username, phone number, or email address. Returns null on miss.
async function resolveUserByQuery(q: string) {
  const v = q.trim();
  if (!v) return null;
  return db.user.findFirst({
    where: {
      OR: [
        { id: v },
        { username: v },
        { phone: v },
        { email: v },
      ],
    },
    select: { id: true, username: true, phone: true, email: true, status: true },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const creds = await loadProviderCredsById(params.id);
    if (!creds) return jsonError(404, 'NOT_FOUND');
    const adapter = getAdapter(creds.adapterKey);
    if (!adapter) return jsonError(500, 'ADAPTER_NOT_REGISTERED');

    const game = await db.externalGame.findUnique({
      where: { providerId_gameUid: { providerId: creds.id, gameUid: parsed.data.gameUid } },
      select: { gameUid: true, displayName: true, status: true },
    });
    if (!game) return jsonError(404, 'GAME_NOT_FOUND', 'Game is not registered for this provider. Add it manually first.');

    // Resolve test user. With no query we default to the calling
    // admin so the operator probes against their own wallet.
    let user: { id: string; username: string; phone: string; email: string | null; status: string } | null = null;
    if (parsed.data.userQuery) {
      user = await resolveUserByQuery(parsed.data.userQuery);
      if (!user) return jsonError(404, 'USER_NOT_FOUND', `No user matches "${parsed.data.userQuery}".`);
    } else {
      user = await db.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, username: true, phone: true, email: true, status: true },
      });
      if (!user) return jsonError(404, 'USER_NOT_FOUND');
    }
    if (user.status === 'blocked') return jsonError(403, 'USER_BLOCKED');

    const wallet = await db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } });
    const balance = wallet ? Number(wallet.balance) : 0;

    // Allocate the numeric memberAccount. ProviderPlayerAccount keeps
    // this stable forever for (providerId, userId).
    const memberAccount = await getOrCreateMemberAccount(creds.id, user.id);

    const origin = new URL(req.url).origin;
    const callbackUrl = `${origin}${creds.callbackPath || `/api/providers/${creds.providerKey}/callback`}?key=${encodeURIComponent(creds.callbackSecret)}`;
    const returnUrl = `${origin}/games/provider/return?p=${encodeURIComponent(creds.providerKey)}`;

    try {
      const { result, rawRequest, rawResponse } = await adapter.launch(creds, {
        userId: user.id,
        memberAccount,
        balance,
        gameUid: parsed.data.gameUid,
        token: creds.apiKey,
        returnUrl,
        callbackUrl,
        currencyCode: creds.currencyCode,
        language: creds.language,
      });

      // Pull timestamp diagnostics out of the rawRequest the adapter
      // assembled. These are NOT secrets - they let the operator
      // confirm the launch payload carried a fresh ms-precision
      // timestamp.
      const r = rawRequest as { timestampSent?: number; serverNow?: number; ageMs?: number; offsetMs?: number };
      const diagnostics = {
        timestampSent: r.timestampSent ?? null,
        serverNow: r.serverNow ?? null,
        ageMs: r.ageMs ?? null,
        offsetMs: r.offsetMs ?? creds.launchTimestampOffsetMs,
      };

      await logRequest({
        providerId: creds.id,
        direction: 'outbound',
        endpoint: 'launch:test',
        method: 'GET',
        status: 200,
        requestPayload: rawRequest,
        responsePayload: { ok: true, mode: result.mode, gameUid: parsed.data.gameUid, ...diagnostics },
      });
      await recordActivity({
        actorId: claims.sub,
        actorRole: claims.role,
        action: 'PROVIDER_LAUNCH_TEST',
        target: parsed.data.gameUid,
        meta: {
          providerId: creds.id,
          providerKey: creds.providerKey,
          testUserId: user.id,
          memberAccount,
          mode: result.mode,
          ...diagnostics,
        },
      });

      return jsonOk({
        launchUrl: result.launchUrl,
        mode: result.mode,
        rawCode: result.rawCode,
        rawMessage: result.rawMessage,
        balanceUsed: balance,
        testUser: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          email: user.email,
        },
        providerMemberAccount: memberAccount,
        timestamp: diagnostics,
        maskedResponse: maskPayload(rawResponse),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof ProviderAdapterError ? err.code : 'LAUNCH_FAILED';
      const snippet = err instanceof ProviderAdapterError ? err.snippet : undefined;
      const status = err instanceof ProviderAdapterError ? err.status : 502;
      await logRequest({
        providerId: creds.id,
        direction: 'outbound',
        endpoint: 'launch:test',
        method: 'GET',
        status,
        responsePayload: snippet ? { snippet, gameUid: parsed.data.gameUid } : undefined,
        errorMessage: msg,
      });
      return jsonError(status, code, msg, snippet ? { snippet } : undefined);
    }
  });
}
