// Built by Anointed Coder.
//
// Admin approves a deposit. In one transaction:
//   1. flips the Deposit row to status="approved"
//   2. credits the user's main wallet
//   3. writes a Transaction (deposit / completed)
// After the transaction commits, two follow-on hooks run OUTSIDE the
// deposit transaction so partial failures cannot roll back the credit:
//   4. accrueLotteryTickets brings the ticket count up to
//      floor(totalApproved / 1200) * 2
//   5. applyDepositBonuses (M2D) issues welcome / deposit-match /
//      reload grants and credits Wallet.bonusBalance + lockedBalance
//
// Idempotent: re-approving an already-approved deposit is a no-op.
// M2D hotfix: the bonus result (granted + skipped + error) is
// returned in the response AND written to ActivityLog with action
// BONUS_GRANTED or BONUS_NOT_GRANTED so the live ops team can see
// exactly what the engine did from /admin/activity.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { accrueLotteryTickets } from '@/lib/lotto/tickets';
import { applyDepositBonuses, type ApplyDepositResult } from '@/lib/bonuses/engine';

const schema = z.object({
  adminNote: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('deposits.review');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const deposit = await db.deposit.findUnique({ where: { id: params.id } });
    if (!deposit) return jsonError(404, 'NOT_FOUND');
    if (deposit.status === 'approved') {
      return jsonOk({ ok: true, alreadyApproved: true, deposit });
    }
    if (deposit.status === 'rejected') {
      return jsonError(409, 'ALREADY_REJECTED');
    }

    const amount = new Prisma.Decimal(deposit.amount);

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'approved',
          reviewerId: session.sub,
          reviewedAt: new Date(),
          adminNote: parsed.data.adminNote ?? deposit.adminNote,
        },
      });

      // Credit the main wallet (create if missing).
      const wallet = await tx.wallet.findUnique({ where: { userId: deposit.userId } });
      if (wallet) {
        await tx.wallet.update({
          where: { userId: deposit.userId },
          data: { balance: { increment: amount } },
        });
      } else {
        await tx.wallet.create({
          data: { userId: deposit.userId, balance: amount },
        });
      }

      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          type: 'deposit',
          status: 'completed',
          amount,
          reference: deposit.transactionId,
          description: `Deposit ${deposit.method}`,
          meta: { depositId: deposit.id } as Prisma.JsonObject,
        },
      });

      return d;
    });

    // Ticket accrual runs after the transaction so a partial failure
    // here cannot roll back the credited deposit.
    let accrual: { generated: number; targetTotal: number; existing: number } = {
      generated: 0,
      targetTotal: 0,
      existing: 0,
    };
    try {
      accrual = await accrueLotteryTickets(deposit.userId);
    } catch (err) {
      console.error('[deposit-approve] lottery accrual failed', err);
    }

    // M2D bonus engine. Runs outside the deposit transaction (same
    // pattern as lottery accrual) so a bonus failure does not roll
    // back the credit AND the failure is visible in logs + response.
    let bonusResult: ApplyDepositResult = {
      granted: [],
      skipped: [],
      candidateCount: 0,
      error: null,
      isFirstDeposit: false,
    };
    try {
      bonusResult = await applyDepositBonuses(deposit.userId, deposit.id, amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[deposit-approve] bonus engine threw unexpectedly', err);
      bonusResult.error = `engine_threw: ${msg.slice(0, 300)}`;
    }

    // Headline ActivityLog row (existing M1 behaviour).
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_APPROVE',
      target: deposit.id,
      meta: {
        userId: deposit.userId,
        amount: Number(amount),
        ticketsGenerated: accrual.generated,
        targetTotalTickets: accrual.targetTotal,
        bonusesGranted: bonusResult.granted.length,
        bonusGrantIds: bonusResult.granted.map((g) => g.grantId),
        bonusEngineError: bonusResult.error,
      },
    });

    // Separate ActivityLog row dedicated to the bonus decision so it
    // is filterable + auditable. Action key signals success/failure
    // at a glance in /admin/activity.
    const summaryDetail = bonusResult.granted.length > 0
      ? bonusResult.granted.map((g) => `${g.ruleName}(${g.ruleType})=${g.amount}`).join(' ; ')
      : bonusResult.error
        ? `ERROR ${bonusResult.error}`
        : bonusResult.skipped.length > 0
          ? bonusResult.skipped.map((s) => `${s.ruleName}:${s.reason}`).slice(0, 4).join(' ; ')
          : `no_active_rules (candidates=${bonusResult.candidateCount})`;
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: bonusResult.granted.length > 0 ? 'BONUS_GRANTED' : 'BONUS_NOT_GRANTED',
      target: deposit.id,
      detail: summaryDetail.slice(0, 480),
      meta: {
        userId: deposit.userId,
        depositAmount: Number(amount),
        isFirstDeposit: bonusResult.isFirstDeposit,
        candidateCount: bonusResult.candidateCount,
        granted: bonusResult.granted,
        skipped: bonusResult.skipped,
        error: bonusResult.error,
      },
    });

    return jsonOk({
      deposit: updated,
      accrual,
      bonuses: {
        granted: bonusResult.granted,
        skipped: bonusResult.skipped,
        candidateCount: bonusResult.candidateCount,
        isFirstDeposit: bonusResult.isFirstDeposit,
        error: bonusResult.error,
        // headline summary for the admin Deposits page toast
        bonusApplied: bonusResult.granted.length > 0,
        bonusAmount: bonusResult.granted.reduce((acc, g) => acc + g.amount, 0),
        bonusRuleCode: bonusResult.granted[0]?.ruleCode ?? null,
        bonusRuleName: bonusResult.granted[0]?.ruleName ?? null,
        bonusSkippedReason: bonusResult.granted.length === 0
          ? (bonusResult.error ?? (bonusResult.skipped[0]?.reason ?? (bonusResult.candidateCount === 0 ? 'no_active_rules' : 'no_eligible_rule')))
          : null,
      },
    });
  });
}
