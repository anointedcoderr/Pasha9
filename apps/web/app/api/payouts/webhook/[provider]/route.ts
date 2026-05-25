// Built by Anointed Coder.
//
// Public webhook endpoint for outbound-payout status callbacks. Same
// shape as the inbound /api/payments/webhook/[provider] route: read
// raw body, dispatch to the matching adapter, always log to
// PaymentGatewayTx(direction=outbound), 200 once recorded.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { getPayoutAdapter } from '@/lib/payouts/registry';
import { ingestPayoutEvent } from '@/lib/payouts/service';
import { recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import type { PayoutProviderKey } from '@/lib/payouts/types';

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const adapter = getPayoutAdapter(provider);
  if (!adapter) return jsonError(404, 'UNKNOWN_PROVIDER');
  if (provider === 'manual') {
    return jsonError(405, 'MANUAL_NO_WEBHOOK', 'Manual payouts are admin-driven; no webhook to deliver.');
  }

  const rawBody = await req.text();
  let event = null;
  try {
    event = await adapter.verifyWebhook(req.headers, rawBody);
  } catch (err) {
    console.error('payout webhook verifier threw', provider, err);
  }

  if (!event) {
    let parsed: Prisma.InputJsonValue | undefined;
    try { parsed = JSON.parse(rawBody) as Prisma.InputJsonValue; } catch { parsed = rawBody as Prisma.InputJsonValue; }
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        status: 'signature_invalid',
        signatureValid: false,
        raw: parsed,
        note: 'Adapter returned null from verifyWebhook for payout. Either signature was bad or the adapter has no live verifier yet.',
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return jsonOk({ ok: true, gatewayTxId: row.id, status: 'signature_invalid' });
  }

  const result = await ingestPayoutEvent(provider as PayoutProviderKey, event);

  if (result.status === 'paid_recorded' && result.withdrawalId) {
    await recordActivity({
      actorId: 'system',
      actorRole: 'system',
      action: 'WITHDRAWAL_AUTO_PAID',
      target: result.withdrawalId,
      detail: provider,
      meta: { gatewayTxId: result.gatewayTxId },
    });
  }

  return jsonOk({
    ok: true,
    gatewayTxId: result.gatewayTxId,
    status: result.status,
    withdrawalId: result.withdrawalId,
  });
}
