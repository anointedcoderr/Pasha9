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
import { accrueCommissionsOnDeposit, type AccrualResult as CommissionAccrualResult } from '@/lib/affiliate/engine';
import {
  creditFirstDepositCoinsIfEligible,
  creditReferralSuccessfulCoins,
  creditReferredFirstDepositCoins,
} from '@/lib/rewards/coin-grants';
import { notifyDepositBonusAwarded } from '@/lib/notifications/notify';
import { accrueBettingPassOnDeposit } from '@/lib/betting-pass/engine';
import { sendSms } from '@/lib/sms/service';
import { fireEvent } from '@/lib/tracking/dispatcher';
import { notifyDepositApproved } from '@/lib/notifications/notify';
import { applySelectedDepositPromotion } from '@/lib/promotions/deposit';
import { pickBestTier, resolveActiveTierRule } from '@/lib/bonuses/deposit-tiers';

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
      const commissions = await accrueCommissionsOnDeposit(deposit.userId, deposit.id, new Prisma.Decimal(deposit.amount));
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'REFERRAL_ACCRUAL_RETRY',
        target: deposit.id,
        meta: {
          accrued: commissions.accrued,
          skipped: commissions.skipped,
          autoPaid: commissions.autoPaid,
          error: commissions.error,
        },
      });
      return jsonOk({ ok: true, alreadyApproved: true, deposit, commissions });
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
    // here cannot roll back the credited deposit. The error is
    // surfaced on the response so the operator sees the player has
    // a balance but no tickets and can re-run accrual from
    // /admin/lotto -> Diagnostics.
    let accrual: { generated: number; targetTotal: number; existing: number; error: string | null } = {
      generated: 0,
      targetTotal: 0,
      existing: 0,
      error: null,
    };
    try {
      const r = await accrueLotteryTickets(deposit.userId);
      accrual = { ...r, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[deposit-approve] lottery accrual failed', err);
      accrual.error = msg;
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
    // Recover the promotion rule for pre-existing deposits that were
    // submitted before /api/deposits started snapping the synced
    // tier BonusRule onto the row. If the deposit promised a bonus
    // (bonusAmount > 0) but lost the rule reference, re-resolve from
    // the best matching tier so the player is credited correctly.
    //
    // The resolver self-heals: when the tier-synced BonusRule is
    // missing or inactive it runs syncTierToBonusRule inline and
    // re-reads. Before this change a tier that drifted out of sync
    // (rule deleted out of band, or a tier created before the sync
    // code shipped) left the deposit row with promotionRuleId=NULL,
    // the recovery lookup also returned NULL, the approve route
    // fell through to applyDepositBonuses() which iterates the
    // active reload/promo/first_deposit list but did not find the
    // tier rule, and the player got the deposit with no bonus
    // grant - exactly the symptom the operator reported.
    let effectivePromotionRuleId: string | null = deposit.promotionRuleId;
    if (!effectivePromotionRuleId && Number(deposit.bonusAmount ?? 0) > 0) {
      try {
        const tierPreview = await pickBestTier(Number(amount));
        if (tierPreview?.tier && tierPreview.bonusAmount > 0) {
          const matchingTier = await db.depositBonusTier.findUnique({ where: { id: tierPreview.tier.id } });
          if (matchingTier) {
            const resolved = await resolveActiveTierRule(matchingTier);
            if (resolved) {
              effectivePromotionRuleId = resolved.id;
              await db.deposit.update({
                where: { id: deposit.id },
                data: { promotionRuleId: resolved.id, promotionCode: resolved.code },
              });
            }
          }
        }
      } catch (err) {
        console.error('[deposit-approve] tier rule recovery failed', err);
      }
    }

    try {
      bonusResult = effectivePromotionRuleId
        ? await applySelectedDepositPromotion({
            userId: deposit.userId,
            depositId: deposit.id,
            ruleId: effectivePromotionRuleId,
            depositAmount: amount,
            actorId: session.sub,
            actorRole: session.role,
          })
        : await applyDepositBonuses(deposit.userId, deposit.id, amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[deposit-approve] bonus engine threw unexpectedly', err);
      bonusResult.error = `engine_threw: ${msg.slice(0, 300)}`;
    }

    // M2E affiliate commission engine. Same after-transaction pattern.
    // Walks the referral chain up to 3 levels and writes an
    // AffiliateCommission row at the appropriate tier rate per level.
    let commissionResult: CommissionAccrualResult = {
      accrued: [],
      skipped: [],
      chainDepth: 0,
      error: null,
      autoPaid: [],
    };
    try {
      commissionResult = await accrueCommissionsOnDeposit(deposit.userId, deposit.id, amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[deposit-approve] commission engine threw unexpectedly', err);
      commissionResult.error = `engine_threw: ${msg.slice(0, 300)}`;
    }

    // Reward coin grants. Three independent triggers - each gated by
    // its own SystemSetting amount and skipped silently when the
    // operator left it at 0. All fire-and-forget; a coin-grant failure
    // never fails the deposit approval response. Idempotency is owned
    // by the helper (it skips on duplicate Transaction.reference).
    try {
      // 1. Depositor's own first-deposit coin grant.
      await creditFirstDepositCoinsIfEligible(deposit.userId, deposit.id);

      // 2. + 3. Referrer-side grants. Both only fire when this deposit
      // is also the trigger for the affiliate first-deposit reward.
      // We look that up by querying AffiliateCommission rows the
      // engine just wrote with basis='first_deposit_reward' on this
      // deposit; each one names a level-1 ancestor we should reward.
      const firstDepositCommissions = await db.affiliateCommission.findMany({
        where: { depositId: deposit.id, basis: 'first_deposit_reward' },
        select: { affiliateId: true },
      });
      for (const row of firstDepositCommissions) {
        await creditReferralSuccessfulCoins(row.affiliateId, deposit.userId);
        await creditReferredFirstDepositCoins(row.affiliateId, deposit.userId, deposit.id);
      }
    } catch (err) {
      console.error('[deposit-approve] reward coin grant failed', err);
    }

    // One Reward Celebration popup per bonus grant. The bonus engine
    // creates the UserBonus row + ledger Transaction; this only writes
    // a Notification so the player sees a popup on next page load.
    try {
      for (const g of bonusResult.granted) {
        await notifyDepositBonusAwarded({
          userId: deposit.userId,
          amount: g.amount,
          bonusRuleName: g.ruleName,
          depositId: deposit.id,
        });
      }
    } catch (err) {
      console.error('[deposit-approve] deposit-bonus notify failed', err);
    }

    // Betting Pass points accrual. Uses BettingPassEvent.idempotencyKey
    // = `<season>:deposit:<depositId>` so re-approving the same deposit
    // never double-awards points. Fail-safe: errors are logged and the
    // approve response still ships.
    let bettingPassDeposit: { pointsAwarded: number; pointsTotalAfter: number; newTier: number; error?: string } = {
      pointsAwarded: 0,
      pointsTotalAfter: 0,
      newTier: 0,
    };
    try {
      const r = await accrueBettingPassOnDeposit(deposit.userId, deposit.id, Number(amount));
      bettingPassDeposit = {
        pointsAwarded: r.pointsAwarded,
        pointsTotalAfter: r.pointsTotalAfter,
        newTier: r.newTier,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[deposit-approve] betting-pass accrual failed', err);
      bettingPassDeposit.error = `engine_threw: ${msg.slice(0, 300)}`;
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
        promotionRuleId: deposit.promotionRuleId,
        promotionCode: deposit.promotionCode,
        commissionsAccrued: commissionResult.accrued.length,
        commissionTotal: commissionResult.accrued.reduce((acc, c) => acc + c.amount, 0),
        commissionEngineError: commissionResult.error,
        referralAutoPaid: commissionResult.autoPaid,
        bettingPassPointsAwarded: bettingPassDeposit.pointsAwarded,
        bettingPassTotal: bettingPassDeposit.pointsTotalAfter,
        bettingPassNewTier: bettingPassDeposit.newTier,
        bettingPassError: bettingPassDeposit.error ?? null,
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
        promotionRuleId: deposit.promotionRuleId,
        promotionCode: deposit.promotionCode,
      },
    });

    // Separate dedicated COMMISSION_ACCRUED / COMMISSION_NONE row so
    // the audit feed is filterable by commission events.
    const commissionDetail = commissionResult.accrued.length > 0
      ? commissionResult.accrued.map((c) => `L${c.level}:${c.tierName ?? '?'}@${c.ratePct}%=${c.amount}`).join(' ; ')
      : commissionResult.error
        ? `ERROR ${commissionResult.error}`
        : commissionResult.skipped.length > 0
          ? commissionResult.skipped.map((s) => `L${s.level}:${s.reason}`).slice(0, 4).join(' ; ')
          : `no_upline (chainDepth=${commissionResult.chainDepth})`;
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: commissionResult.accrued.length > 0 ? 'COMMISSION_ACCRUED' : 'COMMISSION_NONE',
      target: deposit.id,
      detail: commissionDetail.slice(0, 480),
      meta: {
        userId: deposit.userId,
        depositAmount: Number(amount),
        chainDepth: commissionResult.chainDepth,
        accrued: commissionResult.accrued,
        skipped: commissionResult.skipped,
        error: commissionResult.error,
        autoPaid: commissionResult.autoPaid,
      },
    });

    // M2I: notify the user + fire conversion event. Both fail safe -
    // wrapped in try/catch and logged. Never blocks the approve
    // response. Both go through NotificationLog / TrackingEvent so
    // /admin/notifications shows what happened.
    try {
      const user = await db.user.findUnique({ where: { id: deposit.userId }, select: { phone: true, email: true } });
      if (user?.phone) {
        await sendSms({
          phone: user.phone,
          userId: deposit.userId,
          template: 'deposit_approved',
          triggerKey: `deposit:approved:${deposit.id}`,
          body: `Pasha 9: Your deposit of ${Number(amount).toLocaleString()} BDT has been approved and credited to your wallet.`,
        });
      }
      await notifyDepositApproved({
        userId: deposit.userId,
        amount: Number(amount),
        method: deposit.method,
        depositId: deposit.id,
      });
      await fireEvent({
        event: 'deposit',
        source: 'server',
        userId: deposit.userId,
        value: Number(amount),
        currency: 'BDT',
        reference: deposit.id,
        emailLowercase: user?.email?.toLowerCase() ?? null,
        phoneE164: user?.phone ?? null,
        payload: { method: deposit.method, isFirstDeposit: bonusResult.isFirstDeposit },
      });
    } catch (err) {
      console.error('[deposit-approve] notify/track failed', err);
    }

    return jsonOk({
      deposit: updated,
      accrual,
      commissions: {
        accrued: commissionResult.accrued,
        skipped: commissionResult.skipped,
        chainDepth: commissionResult.chainDepth,
        error: commissionResult.error,
        autoPaid: commissionResult.autoPaid,
        total: commissionResult.accrued.reduce((acc, c) => acc + c.amount, 0),
        count: commissionResult.accrued.length,
      },
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
