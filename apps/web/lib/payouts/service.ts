// Built by Anointed Coder.
//
// Outbound-payout service. Consumes verified PayoutEvent objects from
// payout adapters, writes a PaymentGatewayTx(direction=outbound) row
// for the audit trail, attempts to match the event to an existing
// Withdrawal, and (when matched) updates Withdrawal.processingState
// to paid + writes a WithdrawalEvent record. The admin can still
// manually Mark Paid at /admin/withdrawals - this is the automated
// equivalent.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { PayoutEvent, PayoutProviderKey } from './types';

export interface PayoutIngestResult {
  status:
    | 'paid_recorded'      // matched + paid + processingState=paid set
    | 'verified_no_match'
    | 'signature_invalid'
    | 'duplicate'
    | 'failed'
    | 'pending'
    | 'unmatched';
  gatewayTxId: string;
  withdrawalId: string | null;
}

const AMOUNT_TOLERANCE = 0.01;

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

async function findWithdrawalForEvent(provider: PayoutProviderKey, event: PayoutEvent) {
  // Match by providerKey + providerRef first, then by reference column
  // (Withdrawal.id or a value the admin set on initiation).
  const byProviderRef = await db.withdrawal.findFirst({
    where: { providerKey: provider, providerRef: event.providerTxId, status: 'approved' },
    select: { id: true, userId: true, amount: true, processingState: true, method: true },
  });
  if (byProviderRef) return byProviderRef;

  if (event.reference) {
    const byRef = await db.withdrawal.findFirst({
      where: { OR: [{ id: event.reference }, { providerRef: event.reference }], status: 'approved' },
      select: { id: true, userId: true, amount: true, processingState: true, method: true },
    });
    if (byRef) return byRef;
  }
  return null;
}

export async function ingestPayoutEvent(provider: PayoutProviderKey, event: PayoutEvent): Promise<PayoutIngestResult> {
  // Duplicate suppression
  const existing = await db.paymentGatewayTx.findFirst({
    where: {
      provider,
      direction: 'outbound',
      providerTxId: event.providerTxId,
      status: 'paid_recorded',
    },
    select: { id: true, withdrawalId: true },
  });
  if (existing) {
    const dup = await db.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'duplicate',
        signatureValid: event.signatureValid,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: 'Already recorded against ' + existing.id,
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'duplicate', gatewayTxId: dup.id, withdrawalId: existing.withdrawalId };
  }

  if (!event.signatureValid) {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'signature_invalid',
        signatureValid: false,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: 'Adapter could not verify payout webhook signature.',
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'signature_invalid', gatewayTxId: row.id, withdrawalId: null };
  }

  if (event.status === 'failed') {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'failed',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'failed', gatewayTxId: row.id, withdrawalId: null };
  }

  if (event.status === 'pending') {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'pending_provider',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        meta: event.meta as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });
    return { status: 'pending', gatewayTxId: row.id, withdrawalId: null };
  }

  // event.status === 'paid'
  const candidate = await findWithdrawalForEvent(provider, event);
  if (!candidate) {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'unmatched',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: 'Verified signature but no approved Withdrawal matched provider tx id or reference.',
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'unmatched', gatewayTxId: row.id, withdrawalId: null };
  }

  if (!amountsMatch(Number(candidate.amount), event.amount)) {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        providerTxId: event.providerTxId,
        withdrawalId: candidate.id,
        userId: candidate.userId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'unmatched',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: `Amount mismatch: gateway ${event.amount}, withdrawal ${Number(candidate.amount)}. Held for manual review.`,
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'unmatched', gatewayTxId: row.id, withdrawalId: candidate.id };
  }

  // Matched + paid. Mark withdrawal paid + write timeline event + log.
  const result = await db.$transaction(async (tx) => {
    await tx.withdrawal.update({
      where: { id: candidate.id },
      data: {
        processingState: 'paid',
        paidAt: new Date(),
        providerKey: provider,
        providerRef: event.providerTxId,
      },
    });
    await tx.withdrawalEvent.create({
      data: {
        withdrawalId: candidate.id,
        kind: 'paid',
        actorRole: 'system',
        note: `Auto-recorded paid via ${provider} webhook.`,
        meta: { providerTxId: event.providerTxId } as Prisma.InputJsonValue,
      },
    });
    const log = await tx.paymentGatewayTx.create({
      data: {
        provider,
        direction: 'outbound',
        providerTxId: event.providerTxId,
        withdrawalId: candidate.id,
        userId: candidate.userId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'paid_recorded',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
        note: 'Auto-recorded from verified payout webhook.',
      },
      select: { id: true },
    });
    return { gatewayTxId: log.id };
  });

  // Player-facing notification fires AFTER the transaction commits so
  // a notify failure cannot roll back the paid state.
  try {
    const { notifyWithdrawalPaid } = await import('@/lib/notifications/notify');
    await notifyWithdrawalPaid({
      userId: candidate.userId,
      amount: Number(candidate.amount),
      method: candidate.method,
      withdrawalId: candidate.id,
      providerRef: event.providerTxId,
    });
  } catch (err) {
    console.error('[payouts/service] webhook notify failed', err);
  }

  return { status: 'paid_recorded', gatewayTxId: result.gatewayTxId, withdrawalId: candidate.id };
}
