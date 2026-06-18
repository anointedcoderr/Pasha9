// Built by Anointed Coder.
//
// GET /api/admin/operations/stuck-transactions
//
// Surfaces transactions that are stalled in an interim state long
// enough that the operator should investigate. Three categories:
//
// 1. Pending deposits older than DEPOSIT_PENDING_MIN minutes
//    where the player has supplied a transaction id but the wallet
//    has not been credited (and there is no matching successful
//    PaymentGatewayTx). Likely cause: gateway webhook never landed,
//    or the player's TX ID does not match what was sent.
//
// 2. Approved withdrawals stuck in processingState='payout_initiated'
//    longer than PAYOUT_PENDING_MIN minutes with no matching
//    'paid' webhook. Likely cause: gateway is slow, OR the gateway
//    confirmed via a webhook we never received.
//
// 3. Successful PaymentGatewayTx rows in 'unmatched' status (verified
//    signature, no matching Deposit found). Likely cause: player
//    typed the wrong transaction id when submitting the deposit form
//    OR money landed without a deposit request being created (e.g.
//    refund, test transfer).
//
// All three categories surface in /admin/operations as actionable
// queues. The operator can take per-row action (retry, mark paid,
// reject, link to user) from the page.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const DEPOSIT_PENDING_MIN = 5;
const PAYOUT_PENDING_MIN = 10;

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('deposits.review');

    const now = new Date();
    const depositCutoff = new Date(now.getTime() - DEPOSIT_PENDING_MIN * 60_000);
    const payoutCutoff = new Date(now.getTime() - PAYOUT_PENDING_MIN * 60_000);

    const [stuckDeposits, stuckPayouts, unmatchedGatewayTx] = await Promise.all([
      db.deposit.findMany({
        where: {
          status: 'pending',
          createdAt: { lt: depositCutoff },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: {
          id: true,
          userId: true,
          amount: true,
          method: true,
          transactionId: true,
          createdAt: true,
          user: { select: { username: true, phone: true } },
        },
      }),
      db.withdrawal.findMany({
        where: {
          status: 'approved',
          processingState: 'payout_initiated',
          reviewedAt: { lt: payoutCutoff },
        },
        orderBy: { reviewedAt: 'asc' },
        take: 50,
        select: {
          id: true,
          userId: true,
          amount: true,
          method: true,
          accountNumber: true,
          providerKey: true,
          providerRef: true,
          reviewedAt: true,
          user: { select: { username: true, phone: true } },
        },
      }),
      db.paymentGatewayTx.findMany({
        where: {
          status: 'unmatched',
          receivedAt: { lt: depositCutoff },
        },
        orderBy: { receivedAt: 'asc' },
        take: 50,
        select: {
          id: true,
          provider: true,
          providerTxId: true,
          amount: true,
          currency: true,
          receivedAt: true,
          note: true,
          userId: true,
          depositId: true,
        },
      }),
    ]);

    return jsonOk({
      stuckDeposits: stuckDeposits.map((d) => ({
        id: d.id,
        userId: d.userId,
        username: d.user?.username ?? null,
        phone: d.user?.phone ?? null,
        amount: Number(d.amount),
        method: d.method,
        transactionId: d.transactionId,
        createdAt: d.createdAt.toISOString(),
        ageMinutes: Math.round((now.getTime() - d.createdAt.getTime()) / 60_000),
      })),
      stuckPayouts: stuckPayouts.map((w) => ({
        id: w.id,
        userId: w.userId,
        username: w.user?.username ?? null,
        phone: w.user?.phone ?? null,
        amount: Number(w.amount),
        method: w.method,
        accountNumber: w.accountNumber,
        providerKey: w.providerKey,
        providerRef: w.providerRef,
        reviewedAt: w.reviewedAt?.toISOString() ?? null,
        ageMinutes: w.reviewedAt ? Math.round((now.getTime() - w.reviewedAt.getTime()) / 60_000) : null,
      })),
      unmatchedGatewayTx: unmatchedGatewayTx.map((tx) => ({
        id: tx.id,
        provider: tx.provider,
        providerTxId: tx.providerTxId,
        amount: Number(tx.amount ?? 0),
        currency: tx.currency,
        createdAt: tx.receivedAt.toISOString(),
        note: tx.note,
        userId: tx.userId,
        depositId: tx.depositId,
        ageMinutes: Math.round((now.getTime() - tx.receivedAt.getTime()) / 60_000),
      })),
      thresholds: {
        depositPendingMinutes: DEPOSIT_PENDING_MIN,
        payoutPendingMinutes: PAYOUT_PENDING_MIN,
      },
      counts: {
        stuckDeposits: stuckDeposits.length,
        stuckPayouts: stuckPayouts.length,
        unmatched: unmatchedGatewayTx.length,
      },
    });
  });
}
