// Built by Anointed Coder.
//
// Applies one explicitly selected deposit-backed promotion after the
// deposit itself is approved. The PromotionClaim, bonus grant, wallet
// ledger, Transaction, and ActivityLog are committed atomically.

import { Prisma, type BonusRule } from '@prisma/client';
import { db } from '@/lib/db/client';
import { grantBonusInTx, reachedClaimLimit, emitFreeSpinGrant, type ApplyDepositResult } from '@/lib/bonuses/engine';
import { bucketForPromotionType } from '@/lib/promotions/claim';
import {
  getPromotionConfig,
  promotionConfigWarning,
  promotionDepositAmount,
  resolveClaimBehavior,
} from '@/lib/promotions/config';

function computeDepositPayout(rule: BonusRule, depositAmount: Prisma.Decimal): Prisma.Decimal {
  const pct = new Prisma.Decimal(rule.percentage);
  const flat = new Prisma.Decimal(rule.amount);
  const cap = new Prisma.Decimal(rule.maxBonus);
  let payout = depositAmount.mul(pct).div(100).add(flat);
  if (cap.gt(0) && payout.gt(cap)) payout = cap;
  return payout.lt(0) ? new Prisma.Decimal(0) : payout;
}
export async function previewDepositPromotion(
  ruleId: string,
  depositAmount: number,
): Promise<{ rule: BonusRule; bonusPercentage: number; bonusAmount: number; totalCredit: number } | null> {
  const rule = await db.bonusRule.findUnique({ where: { id: ruleId } });
  const now = new Date();
  if (!rule || rule.status !== 'active' || resolveClaimBehavior(rule) !== 'deposit') return null;
  if (rule.startsAt && rule.startsAt > now) return null;
  if (rule.endsAt && rule.endsAt < now) return null;
  if (promotionConfigWarning(rule)) return null;
  const amount = new Prisma.Decimal(Math.max(0, depositAmount));
  const payout = amount.gte(new Prisma.Decimal(promotionDepositAmount(rule)))
    ? computeDepositPayout(rule, amount)
    : new Prisma.Decimal(0);
  return {
    rule,
    bonusPercentage: Number(rule.percentage),
    bonusAmount: Number(payout),
    totalCredit: Number(amount.add(payout)),
  };
}

export async function applySelectedDepositPromotion(input: {
  userId: string;
  depositId: string;
  ruleId: string;
  depositAmount: Prisma.Decimal;
  actorId: string;
  actorRole: string;
}): Promise<ApplyDepositResult> {
  const result: ApplyDepositResult = {
    granted: [],
    skipped: [],
    candidateCount: 1,
    error: null,
    isFirstDeposit: false,
  };
  const rule = await db.bonusRule.findUnique({ where: { id: input.ruleId } });
  if (!rule) {
    result.skipped.push({ ruleId: input.ruleId, ruleName: 'Selected promotion', ruleType: 'promo', ruleCode: null, reason: 'promotion_not_found' });
    return result;
  }

  const skip = (reason: string) => {
    result.skipped.push({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      ruleCode: rule.code,
      reason,
    });
    return result;
  };

  const now = new Date();
  if (rule.status !== 'active') return skip('promotion_inactive');
  if (rule.startsAt && rule.startsAt > now) return skip('promotion_not_started');
  if (rule.endsAt && rule.endsAt < now) return skip('promotion_ended');
  if (resolveClaimBehavior(rule) !== 'deposit') return skip('promotion_not_deposit_backed');
  const warning = promotionConfigWarning(rule);
  if (warning) return skip(`promotion_config_error:${warning}`);
  if (input.depositAmount.lt(new Prisma.Decimal(promotionDepositAmount(rule)))) return skip('minimum_deposit_not_met');

  const approvedCount = await db.deposit.count({ where: { userId: input.userId, status: 'approved' } });
  result.isFirstDeposit = approvedCount <= 1;
  if (rule.type === 'first_deposit' && !result.isFirstDeposit) return skip('not_first_deposit');

  const config = getPromotionConfig(rule.meta);
  if (config.minApprovedDepositCount > 0 && approvedCount < config.minApprovedDepositCount) {
    return skip('minimum_approved_deposit_count_not_met');
  }
  if (config.minApprovedDepositTotal > 0) {
    const total = await db.deposit.aggregate({
      where: { userId: input.userId, status: 'approved' },
      _sum: { amount: true },
    });
    if (Number(total._sum.amount ?? 0) < config.minApprovedDepositTotal) {
      return skip('minimum_approved_deposit_total_not_met');
    }
  }

  // Per-user claim limit (once per account / day / week / month). The
  // tier ladder mirrors claimPeriod/claimLimit onto the managed rule, so
  // a deposit that matches a capped tier is blocked here exactly as the
  // auto engine and the eligibility preview would block it. Without this
  // the limit was honoured in the preview but never on the grant.
  if (await reachedClaimLimit(input.userId, rule, input.depositId)) return skip('claim_limit_reached');

  const payout = computeDepositPayout(rule, input.depositAmount);
  if (payout.lte(0)) return skip('computed_payout_zero');
  const dayBucket = bucketForPromotionType(rule.type, now);

  try {
    const granted = await db.$transaction(async (tx) => {
      const claim = await tx.promotionClaim.create({
        data: {
          userId: input.userId,
          ruleId: rule.id,
          dayBucket,
          status: 'granted',
        },
      });
      const grant = await grantBonusInTx(tx, {
        userId: input.userId,
        rule,
        amount: payout,
        sourceType: 'promotion_deposit',
        sourceId: input.depositId,
        note: `Deposit promotion ${rule.name}`,
      });
      if (!grant) throw new Error('PROMOTION_GRANT_EMPTY');
      await tx.promotionClaim.update({
        where: { id: claim.id },
        data: { bonusGrantId: grant.grantId },
      });
      await tx.activityLog.create({
        data: {
          actorId: input.actorId,
          actorRole: input.actorRole,
          action: 'PROMOTION_DEPOSIT_BONUS_GRANTED',
          target: input.depositId,
          detail: rule.name,
          meta: {
            userId: input.userId,
            promotionRuleId: rule.id,
            promotionClaimId: claim.id,
            bonusGrantId: grant.grantId,
            amount: Number(grant.amount),
          } as Prisma.JsonObject,
        },
      });
      return grant;
    });
    result.granted.push({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      ruleCode: rule.code,
      grantId: granted.grantId,
      amount: Number(granted.amount),
      turnoverRequired: Number(payout.mul(new Prisma.Decimal(rule.turnoverX))),
    });
    // Free spins ride on the same rule; emit after the cash grant
    // commits. Best-effort, so it never fails the deposit promotion.
    await emitFreeSpinGrant(input.userId, rule, input.depositId);
    return result;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return skip('promotion_already_claimed_for_period');
    }
    const message = err instanceof Error ? err.message : String(err);
    result.error = `promotion_grant_failed:${message.slice(0, 300)}`;
    return skip(result.error);
  }
}
