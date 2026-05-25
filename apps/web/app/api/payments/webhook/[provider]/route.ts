// Built by Anointed Coder.
//
// Public webhook entry point for every payment provider adapter.
// Provider key comes from the URL path (eg /api/payments/webhook/bkash).
// Body is read raw so signature schemes that hash the original bytes
// (HMAC over the request body) can verify correctly.
//
// Always returns 200 once the request has been logged so the provider
// does not retry a row we have already accepted. Adapters return null
// from verifyWebhook to mean "no idea what this is" - we log it as
// signature_invalid and 200 back.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { getAdapter } from '@/lib/payments/registry';
import { ingestProviderEvent } from '@/lib/payments/service';
import { recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import type { ProviderKey } from '@/lib/payments/types';

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const adapter = getAdapter(provider);
  if (!adapter) {
    // Unknown provider key. Do not log against PaymentGatewayTx because
    // the provider column is constrained to known keys downstream; just
    // 404 the caller.
    return jsonError(404, 'UNKNOWN_PROVIDER');
  }

  if (provider === 'manual') {
    // Manual flow has no webhook; if a caller hits this we say so.
    return jsonError(405, 'MANUAL_NO_WEBHOOK', 'Manual adapter has no webhook; admin approves at /admin/deposits.');
  }

  const rawBody = await req.text();
  let event = null;
  try {
    event = await adapter.verifyWebhook(req.headers, rawBody);
  } catch (err) {
    console.error('webhook verifier threw', provider, err);
  }

  if (!event) {
    // Adapter rejected the request. Log so support can replay.
    let parsed: Prisma.InputJsonValue | undefined;
    try { parsed = JSON.parse(rawBody) as Prisma.InputJsonValue; } catch { parsed = rawBody as Prisma.InputJsonValue; }
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        status: 'signature_invalid',
        signatureValid: false,
        raw: parsed,
        note: 'Adapter returned null from verifyWebhook. Either signature was bad, payload shape was wrong, or the adapter has no live verifier yet.',
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return jsonOk({ ok: true, gatewayTxId: row.id, status: 'signature_invalid' });
  }

  const result = await ingestProviderEvent(provider as ProviderKey, event);

  // Audit trail for any auto-credit so admin can trace the chain back
  // through ActivityLog the same way manual approvals are traced.
  if (result.status === 'credited' && result.depositId) {
    await recordActivity({
      actorId: 'system',
      actorRole: 'system',
      action: 'DEPOSIT_AUTO_CREDIT',
      target: result.depositId,
      detail: provider,
      meta: { gatewayTxId: result.gatewayTxId, ticketsGenerated: result.ticketsGenerated },
    });
  }

  return jsonOk({
    ok: true,
    gatewayTxId: result.gatewayTxId,
    status: result.status,
    depositId: result.depositId,
    ticketsGenerated: result.ticketsGenerated,
  });
}
