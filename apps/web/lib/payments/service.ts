// Built by Anointed Coder.
//
// Core payment service. Receives a verified ProviderEvent from a
// gateway adapter, logs it to PaymentGatewayTx, attempts to match it
// to a pending Deposit row, and (if the match + signature both check
// out) credits the user's wallet and accrues lottery tickets via the
// same code path the admin approve endpoint uses.
//
// Safety rails:
// - Always writes a PaymentGatewayTx row, even on failure.
// - Auto-approve only fires when signatureValid AND match is exact on
//   provider key + transactionId/reference + amount within 0.01 BDT.
// - Re-running the same providerTxId is detected and logged as
//   "duplicate" without double-crediting.
// - Manual approval at /admin/deposits remains the authoritative
//   flow; webhooks just give it an automatic head start when the
//   match is unambiguous.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { accrueLotteryTickets } from '@/lib/lotto/tickets';
import type { ProviderEvent, ProviderKey } from './types';

export interface IngestResult {
  status:
    | 'credited'
    | 'verified_no_match'
    | 'signature_invalid'
    | 'duplicate'
    | 'failed'
    | 'pending'
    | 'unmatched';
  gatewayTxId: string;
  depositId: string | null;
  ticketsGenerated: number;
}

interface DepositCandidate {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  status: 'pending' | 'approved' | 'rejected';
  transactionId: string;
}

const AMOUNT_TOLERANCE = 0.01;

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

async function findDepositForEvent(provider: ProviderKey, event: ProviderEvent): Promise<DepositCandidate | null> {
  // Match priority:
  //   1. providerRef already set on a deposit AND matches provider + providerTxId
  //   2. user-entered transactionId matches providerTxId
  //   3. event.reference matches transactionId
  const byProviderRef = await db.deposit.findFirst({
    where: { providerKey: provider, providerRef: event.providerTxId, status: 'pending' },
    select: { id: true, userId: true, amount: true, status: true, transactionId: true },
  });
  if (byProviderRef) return { ...byProviderRef, status: byProviderRef.status as 'pending' };

  const byTxId = await db.deposit.findFirst({
    where: { transactionId: event.providerTxId, status: 'pending' },
    select: { id: true, userId: true, amount: true, status: true, transactionId: true },
  });
  if (byTxId) return { ...byTxId, status: byTxId.status as 'pending' };

  if (event.reference) {
    const byReference = await db.deposit.findFirst({
      where: { OR: [{ transactionId: event.reference }, { id: event.reference }], status: 'pending' },
      select: { id: true, userId: true, amount: true, status: true, transactionId: true },
    });
    if (byReference) return { ...byReference, status: byReference.status as 'pending' };
  }

  return null;
}

export async function ingestProviderEvent(provider: ProviderKey, event: ProviderEvent): Promise<IngestResult> {
  // Duplicate detection: same provider + providerTxId already credited.
  const existing = await db.paymentGatewayTx.findFirst({
    where: { provider, providerTxId: event.providerTxId, status: 'credited' },
    select: { id: true, depositId: true },
  });
  if (existing) {
    const dup = await db.paymentGatewayTx.create({
      data: {
        provider,
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'duplicate',
        signatureValid: event.signatureValid,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: 'Already credited under earlier gateway tx ' + existing.id,
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'duplicate', gatewayTxId: dup.id, depositId: existing.depositId, ticketsGenerated: 0 };
  }

  if (!event.signatureValid) {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'signature_invalid',
        signatureValid: false,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: 'Adapter could not verify webhook signature.',
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'signature_invalid', gatewayTxId: row.id, depositId: null, ticketsGenerated: 0 };
  }

  if (event.status === 'failed') {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
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
    return { status: 'failed', gatewayTxId: row.id, depositId: null, ticketsGenerated: 0 };
  }

  if (event.status === 'pending') {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
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
    return { status: 'pending', gatewayTxId: row.id, depositId: null, ticketsGenerated: 0 };
  }

  // event.status === 'success'
  const candidate = await findDepositForEvent(provider, event);

  if (!candidate) {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        providerTxId: event.providerTxId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'unmatched',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: 'Verified signature but no pending Deposit matched provider tx id or reference.',
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'unmatched', gatewayTxId: row.id, depositId: null, ticketsGenerated: 0 };
  }

  const depositAmount = Number(candidate.amount);
  if (!amountsMatch(depositAmount, event.amount)) {
    const row = await db.paymentGatewayTx.create({
      data: {
        provider,
        providerTxId: event.providerTxId,
        depositId: candidate.id,
        userId: candidate.userId,
        amount: new Prisma.Decimal(event.amount),
        currency: event.currency,
        status: 'unmatched',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        note: `Amount mismatch: gateway ${event.amount}, deposit ${depositAmount}. Held for manual review.`,
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { status: 'unmatched', gatewayTxId: row.id, depositId: candidate.id, ticketsGenerated: 0 };
  }

  // Verified + matched + amount checks out. Credit the wallet, write
  // the Transaction row, mark the deposit approved (system-initiated),
  // and log a credited PaymentGatewayTx pointing at both. Lottery
  // ticket accrual runs after the txn so a partial failure can't roll
  // back the credit.
  const amount = candidate.amount;
  const credited = await db.$transaction(async (tx) => {
    const dep = await tx.deposit.update({
      where: { id: candidate.id },
      data: {
        status: 'approved',
        providerKey: provider,
        providerRef: event.providerTxId,
        reviewerId: null,
        reviewedAt: new Date(),
        adminNote: `Auto-credited via ${provider} webhook.`,
      },
    });
    const wallet = await tx.wallet.findUnique({ where: { userId: dep.userId } });
    if (wallet) {
      await tx.wallet.update({ where: { userId: dep.userId }, data: { balance: { increment: amount } } });
    } else {
      await tx.wallet.create({ data: { userId: dep.userId, balance: amount } });
    }
    await tx.transaction.create({
      data: {
        userId: dep.userId,
        type: 'deposit',
        status: 'completed',
        amount,
        reference: event.providerTxId,
        description: `Deposit ${dep.method} (auto-credit via ${provider})`,
        meta: { depositId: dep.id, provider, providerTxId: event.providerTxId } as Prisma.InputJsonValue,
      },
    });
    const log = await tx.paymentGatewayTx.create({
      data: {
        provider,
        providerTxId: event.providerTxId,
        depositId: dep.id,
        userId: dep.userId,
        amount,
        currency: event.currency,
        status: 'credited',
        signatureValid: true,
        raw: event.rawPayload as Prisma.InputJsonValue,
        meta: event.meta as Prisma.InputJsonValue | undefined,
        processedAt: new Date(),
        note: 'Auto-credited from verified webhook.',
      },
      select: { id: true },
    });
    return { depositId: dep.id, gatewayTxId: log.id };
  });

  let ticketsGenerated = 0;
  try {
    const accrual = await accrueLotteryTickets(candidate.userId);
    ticketsGenerated = accrual.generated;
  } catch (err) {
    console.error('lottery accrual after auto-credit failed', err);
  }

  // Player-facing notification. Auto-credited deposits skip the admin
  // approve flow so they otherwise have no in-app announcement. Lookup
  // the method label from the deposit row since this code path does
  // not have it in scope.
  try {
    const depRow = await db.deposit.findUnique({
      where: { id: credited.depositId },
      select: { method: true },
    });
    const { notifyDepositApproved, notifyAdminsDepositAutoCredited } = await import('@/lib/notifications/notify');
    await notifyDepositApproved({
      userId: candidate.userId,
      amount: Number(amount),
      method: depRow?.method ?? provider,
      depositId: credited.depositId,
    });
    // Operator-facing ping (bell + push + Telegram). Gateway credits
    // used to be invisible to staff because only the manual submit path
    // called notifyAdmins. Runs after the credit transaction committed,
    // fire-and-forget: a notify failure never affects the credit.
    notifyAdminsDepositAutoCredited({
      depositId: credited.depositId,
      amount: Number(amount),
      method: depRow?.method ?? provider,
      provider,
      userId: candidate.userId,
    }).catch((err) => console.error('auto-credit admin notify failed', err));
  } catch (err) {
    console.error('auto-credit notify failed', err);
  }

  return {
    status: 'credited',
    gatewayTxId: credited.gatewayTxId,
    depositId: credited.depositId,
    ticketsGenerated,
  };
}
