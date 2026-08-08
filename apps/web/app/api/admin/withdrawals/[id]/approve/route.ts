// Built by Anointed Coder.
//
// Admin approves a withdrawal. Transactional:
//   1. flips the Withdrawal row to status="approved"
//   2. deducts the amount from the user's main wallet balance
//   3. writes a Transaction (withdraw / completed)
// processingState stays NULL so /admin/withdrawals shows both the
// manual "Mark Paid" button AND the "Send via ChaopaoPay" button.
//
// When SystemSetting payment_chaopaopay_auto_payout_on_approve='1'
// AND the withdrawal method is a ChaopaoPay-supported channel
// (bKash/Nagad) AND ChaopaoPay credentials are configured, the
// approve endpoint also fires the ChaopaoPay /payout/create.php call
// in a best-effort post-commit step. Success flips processingState
// to 'payout_initiated' and records the providerTxId. Failure leaves
// the withdrawal in 'approved' state with a payout_attempt_failed
// audit event so the operator can retry via the manual button.
//
// Idempotent + safety-checked: rejects if wallet would go negative or
// row is already resolved.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';
import { sendSms } from '@/lib/sms/service';
import { fireEvent } from '@/lib/tracking/dispatcher';
import { computeDepositTurnover } from '@/lib/turnover/deposit-gate';
import { createChaopaoPayOut, type ChaopaoPayMethod } from '@/lib/payments/chaopaopay-client';
import { notifyWithdrawalApproved, notifyAdminsWithdrawalApproved } from '@/lib/notifications/notify';

const schema = z.object({ adminNote: z.string().max(500).optional() });

function resolveChaopaopayMethod(methodName: string): ChaopaoPayMethod | null {
  const m = methodName.toLowerCase();
  if (m === 'bkash' || m === 'chaopaopay_bkash') return 'bkash';
  if (m === 'nagad' || m === 'chaopaopay_nagad') return 'nagad';
  return null;
}

function generatePayoutTrx(): string {
  return `WIT-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function originFromRequest(req: NextRequest): string {
  const cfg = process.env.PUBLIC_BASE_URL?.trim();
  if (cfg) return cfg.replace(/\/+$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? '';
  return host ? `${proto}://${host}` : '';
}

// Inline ChaopaoPay payout dispatch shared with the manual Send via
// ChaopaoPay route (apps/web/app/api/admin/payments/chaopaopay/
// send-payout/[withdrawalId]/route.ts). Failure path logs a
// payout_attempt_failed WithdrawalEvent and returns without throwing
// so the approve response still succeeds.
async function runAutoPayout(
  req: NextRequest,
  actorId: string,
  actorRole: string,
  w: { id: string; amount: Prisma.Decimal | number | string; method: string; accountNumber: string; accountName: string },
  method: ChaopaoPayMethod,
): Promise<void> {
  const trxId = generatePayoutTrx();
  const origin = originFromRequest(req);
  const notifyUrl = `${origin}/api/payouts/webhook/chaopaopay`;
  let result;
  try {
    result = await createChaopaoPayOut({
      trxId,
      amount: Number(w.amount),
      method,
      accountNumber: w.accountNumber,
      accountName: w.accountName,
      notifyUrl,
      description: `Pasha 9 auto-payout ${w.id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[approve/auto-payout] gateway error', err);
    try {
      await db.withdrawalEvent.create({
        data: {
          withdrawalId: w.id,
          kind: 'payout_attempt_failed',
          actorId,
          actorRole,
          note: msg.slice(0, 480),
          meta: { trxId, auto: true },
        },
      });
    } catch { /* swallow audit failure */ }
    return;
  }
  try {
    await db.$transaction(async (tx) => {
      const r = await tx.withdrawal.updateMany({
        where: {
          id: w.id,
          status: 'approved',
          processingState: { notIn: ['paid', 'payout_initiated'] },
        },
        data: {
          processingState: 'payout_initiated',
          providerKey: 'chaopaopay',
          providerRef: result!.transactionId,
        },
      });
      if (r.count === 0) return;
      await tx.withdrawalEvent.create({
        data: {
          withdrawalId: w.id,
          kind: 'payout_initiated',
          actorId,
          actorRole,
          note: `ChaopaoPay auto-payout initiated. trx_id=${trxId}, providerTxId=${result!.transactionId}, fee=${result!.fee}, net=${result!.netAmount}.`,
          meta: {
            providerKey: 'chaopaopay',
            providerRef: result!.transactionId,
            trxId,
            fee: result!.fee,
            netAmount: result!.netAmount,
            method,
            gatewayStatus: result!.status,
            auto: true,
          },
        },
      });
    });
  } catch (err) {
    console.error('[approve/auto-payout] state update failed', err);
  }
  await recordActivity({
    actorId,
    actorRole,
    action: 'WITHDRAWAL_CHAOPAOPAY_AUTO_INITIATED',
    target: w.id,
    meta: {
      trxId,
      providerTxId: result.transactionId,
      amount: Number(w.amount),
      method,
      fee: result.fee,
      netAmount: result.netAmount,
      gatewayStatus: result.status,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('withdrawals.review');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const withdrawal = await db.withdrawal.findUnique({ where: { id: params.id } });
    if (!withdrawal) return jsonError(404, 'NOT_FOUND');
    if (withdrawal.status === 'approved') {
      return jsonOk({ ok: true, alreadyApproved: true, withdrawal });
    }
    if (withdrawal.status === 'rejected') {
      return jsonError(409, 'ALREADY_REJECTED');
    }

    const amount = new Prisma.Decimal(withdrawal.amount);

    // Pre-check turnover and balance for a fast, friendly error
    // before opening the transaction. The authoritative balance
    // check re-runs INSIDE the transaction below so two concurrent
    // approvals cannot both pass a stale check and double-debit
    // the wallet.
    const wallet = await db.wallet.findUnique({ where: { userId: withdrawal.userId } });
    if (!wallet) return jsonError(409, 'WALLET_MISSING', 'User has no wallet.');
    const turnover = await computeDepositTurnover(withdrawal.userId);
    const lockedByRewards = turnover.bdtBalanceLocked + turnover.referralBalanceLocked + turnover.spinBalanceLocked;
    const available = Number(wallet.balance) - Number(wallet.lockedBalance) - lockedByRewards;
    if (available < Number(amount)) {
      return jsonError(409, 'INSUFFICIENT_FUNDS', 'User withdrawable balance is lower than the withdrawal amount.');
    }
    if (!turnover.isMet) {
      return jsonError(409, 'TURNOVER_NOT_MET', 'User turnover requirements are not complete.', {
        depositRemaining: turnover.depositRemaining,
        bettingPassRemaining: turnover.bettingPassRemaining,
        referralRemaining: turnover.referralRemaining,
        spinRemaining: turnover.spinRemaining,
      });
    }

    let updated;
    try {
      updated = await db.$transaction(async (tx) => {
      // Re-read the wallet inside the transaction so a concurrent
      // approval on the same user cannot drive the balance
      // negative. We re-check available funds the same way as the
      // pre-check but using the row we just read inside the tx.
      const liveWallet = await tx.wallet.findUnique({ where: { userId: withdrawal.userId } });
      if (!liveWallet) throw new Error('WALLET_MISSING_RACE');
      const liveAvailable = Number(liveWallet.balance) - Number(liveWallet.lockedBalance) - lockedByRewards;
      if (liveAvailable < Number(amount)) {
        throw new Error('INSUFFICIENT_FUNDS_RACE');
      }
      // Approve flips status -> approved + debits the wallet, but
      // leaves processingState null. processingState='payout_initiated'
      // is reserved for the moment a real payout API call leaves the
      // server (ChaopaoPay /payout/create.php). The earlier version
      // pre-flipped to 'payout_initiated' here which made the
      // /admin/withdrawals page hide the "Send via ChaopaoPay" button
      // because canSendViaChaopaoPay short-circuits on that state.
      const w = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'approved',
          processingState: null,
          reviewerId: session.sub,
          reviewedAt: new Date(),
          adminNote: parsed.data.adminNote ?? withdrawal.adminNote,
        },
      });
      const wdTxRow = await tx.transaction.create({
        data: {
          userId: withdrawal.userId,
          type: 'withdraw',
          status: 'completed',
          amount: amount.neg(),
          reference: `WD-${withdrawal.id.slice(-8)}`,
          description: `Withdrawal ${withdrawal.method}`,
          meta: { withdrawalId: withdrawal.id } as Prisma.JsonObject,
        },
      });

      // Debits through the central service so the ledger captures the balance
      // either side of the payout and which staff member approved it. The
      // client named withdrawals specifically: a player disputing "my balance
      // was wrong after withdrawal" is answerable only if the before and after
      // are recorded at the moment the money left.
      await applyWalletMovement({
        tx,
        userId: withdrawal.userId,
        amount: amount.neg(),
        type: LEDGER_TYPE.withdrawal,
        description: `Withdrawal ${withdrawal.method}`,
        transactionId: wdTxRow.id,
        referenceId: `WD-${withdrawal.id.slice(-8)}`,
        actorId: session.sub,
        actorRole: session.role,
        meta: { withdrawalId: withdrawal.id, method: withdrawal.method } as Prisma.JsonObject,
      });
      await tx.withdrawalEvent.create({
        data: {
          withdrawalId: withdrawal.id,
          kind: 'approved',
          actorId: session.sub,
          actorRole: session.role,
          note: parsed.data.adminNote || 'Approved by admin. Wallet debited; payout initiated.',
        },
      });
      return w;
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'INSUFFICIENT_FUNDS_RACE') {
        return jsonError(409, 'INSUFFICIENT_FUNDS', 'User withdrawable balance changed since the page loaded. Refresh and try again.');
      }
      if (e instanceof Error && e.message === 'WALLET_MISSING_RACE') {
        return jsonError(409, 'WALLET_MISSING', 'User has no wallet.');
      }
      throw e;
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WITHDRAWAL_APPROVE',
      target: withdrawal.id,
      meta: { userId: withdrawal.userId, amount: Number(amount) },
    });

    // Optional auto-payout via ChaopaoPay. Only fires when the
    // operator has set payment_chaopaopay_auto_payout_on_approve='1'
    // in /admin/payments AND the method is bKash/Nagad. Failures are
    // logged and surface as a payout_attempt_failed event so the
    // operator can retry via the manual Send via ChaopaoPay button -
    // the withdrawal still ends in 'approved' (not paid) so no
    // money is at risk if the gateway call fails.
    try {
      const flagRow = await db.systemSetting.findUnique({
        where: { key: 'payment_chaopaopay_auto_payout_on_approve' },
        select: { value: true },
      });
      if ((flagRow?.value ?? '0').trim() === '1') {
        const method = resolveChaopaopayMethod(withdrawal.method);
        if (method) {
          await runAutoPayout(req, session.sub, session.role, updated, method);
          // Reload the row in case the auto-payout flipped state so
          // the response carries the latest snapshot.
          const refreshed = await db.withdrawal.findUnique({ where: { id: updated.id } });
          if (refreshed) updated = refreshed;
        }
      }
    } catch (err) {
      console.error('[withdrawal-approve] auto-payout dispatch failed', err);
    }

    // M2I notify + track (never blocks the response).
    try {
      const user = await db.user.findUnique({ where: { id: withdrawal.userId }, select: { phone: true, email: true } });
      if (user?.phone) {
        await sendSms({
          phone: user.phone,
          userId: withdrawal.userId,
          template: 'withdrawal_approved',
          triggerKey: `withdrawal:approved:${withdrawal.id}`,
          body: `Pasha 9: Your withdrawal of ${Number(amount).toLocaleString()} BDT has been approved. The payout will reach your ${withdrawal.method} account shortly.`,
        });
      }
      await notifyWithdrawalApproved({
        userId: withdrawal.userId,
        amount: Number(amount),
        method: withdrawal.method,
        withdrawalId: withdrawal.id,
      });
      await notifyAdminsWithdrawalApproved({
        withdrawalId: withdrawal.id,
        amount: Number(amount),
        method: withdrawal.method,
        userId: withdrawal.userId,
      });
      await fireEvent({
        event: 'withdrawal',
        source: 'server',
        userId: withdrawal.userId,
        value: Number(amount),
        currency: 'BDT',
        reference: withdrawal.id,
        emailLowercase: user?.email?.toLowerCase() ?? null,
        phoneE164: user?.phone ?? null,
        payload: { method: withdrawal.method },
      });
    } catch (err) {
      console.error('[withdrawal-approve] notify/track failed', err);
    }

    return jsonOk({ withdrawal: updated });
  });
}
