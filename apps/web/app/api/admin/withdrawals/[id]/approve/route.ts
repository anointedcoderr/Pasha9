// Built by Anointed Coder.
//
// Admin approves a withdrawal. Transactional:
//   1. flips the Withdrawal row to status="approved"
//   2. deducts the amount from the user's main wallet balance
//   3. writes a Transaction (withdraw / completed)
// No payout gateway side-effect - the operator pays the user out of
// band per M1 design.
//
// Idempotent + safety-checked: rejects if wallet would go negative or
// row is already resolved.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { sendSms } from '@/lib/sms/service';
import { fireEvent } from '@/lib/tracking/dispatcher';
import { computeDepositTurnover } from '@/lib/turnover/deposit-gate';

const schema = z.object({ adminNote: z.string().max(500).optional() });

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

    const wallet = await db.wallet.findUnique({ where: { userId: withdrawal.userId } });
    if (!wallet) return jsonError(409, 'WALLET_MISSING', 'User has no wallet.');
    const turnover = await computeDepositTurnover(withdrawal.userId);
    const available = Number(wallet.balance) - Number(wallet.lockedBalance) - turnover.bdtBalanceLocked - turnover.referralBalanceLocked;
    if (available < Number(amount)) {
      return jsonError(409, 'INSUFFICIENT_FUNDS', 'User withdrawable balance is lower than the withdrawal amount.');
    }
    if (!turnover.isMet) {
      return jsonError(409, 'TURNOVER_NOT_MET', 'User turnover requirements are not complete.', {
        depositRemaining: turnover.depositRemaining,
        bettingPassRemaining: turnover.bettingPassRemaining,
        referralRemaining: turnover.referralRemaining,
      });
    }

    const updated = await db.$transaction(async (tx) => {
      const w = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'approved',
          processingState: 'payout_initiated',
          reviewerId: session.sub,
          reviewedAt: new Date(),
          adminNote: parsed.data.adminNote ?? withdrawal.adminNote,
        },
      });
      await tx.wallet.update({
        where: { userId: withdrawal.userId },
        data: { balance: { decrement: amount } },
      });
      await tx.transaction.create({
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

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WITHDRAWAL_APPROVE',
      target: withdrawal.id,
      meta: { userId: withdrawal.userId, amount: Number(amount) },
    });

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
