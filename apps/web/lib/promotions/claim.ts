// Built by Anointed Coder.
//
// Typed promotion claim router. Redirect-only promotions never enter
// payout logic. Direct financial claims use the existing bonus engine
// inside the same Prisma transaction as PromotionClaim and ActivityLog.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { grantBonusInTx } from '@/lib/bonuses/engine';
import {
  buildPromotionDepositUrl,
  getPromotionConfig,
  promotionConfigWarning,
  promotionTargetUrl,
  resolveClaimBehavior,
} from '@/lib/promotions/config';

export type ClaimAction = 'redirect' | 'direct_claim_success' | 'not_eligible' | 'disabled' | 'config_error';

export type ClaimResult =
  | { ok: true; action: 'redirect'; url: string; message: string; ruleName: string }
  | {
      ok: true;
      action: 'direct_claim_success';
      bonusGrantId: string;
      amount: number;
      claimId: string;
      ruleName: string;
    }
  | {
      ok: false;
      action: 'not_eligible' | 'disabled' | 'config_error';
      httpStatus: number;
      code: string;
      message: string;
      meta?: Record<string, unknown>;
    };

function dayBucketFor(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO-8601 week bucket like '2026-W22'. */
export function weeklyBucket(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function bucketForPromotionType(type: string, now: Date): string {
  if (type === 'weekly') return weeklyBucket(now);
  if (type === 'first_deposit') return 'first_deposit';
  return dayBucketFor(now);
}

function flatPayout(rule: { amount: Prisma.Decimal; percentage: Prisma.Decimal; maxBonus: Prisma.Decimal }): Prisma.Decimal {
  let payout = new Prisma.Decimal(rule.amount);
  const pct = new Prisma.Decimal(rule.percentage);
  const cap = new Prisma.Decimal(rule.maxBonus);
  if (payout.lte(0) && pct.gt(0) && cap.gt(0)) payout = cap.mul(pct).div(100);
  if (cap.gt(0) && payout.gt(cap)) payout = cap;
  return payout;
}

async function eligibilityFailure(
  userId: string,
  rule: { type: string; meta: unknown },
): Promise<string | null> {
  const config = getPromotionConfig(rule.meta);
  if (rule.type === 'first_deposit') {
    const approved = await db.deposit.count({ where: { userId, status: 'approved' } });
    if (approved > 0) return 'This offer is only available before your first approved deposit.';
  }
  if (config.minApprovedDepositCount > 0) {
    const count = await db.deposit.count({ where: { userId, status: 'approved' } });
    if (count < config.minApprovedDepositCount) {
      return `At least ${config.minApprovedDepositCount} approved deposit${config.minApprovedDepositCount === 1 ? '' : 's'} required.`;
    }
  }
  if (config.minApprovedDepositTotal > 0) {
    const total = await db.deposit.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true },
    });
    if (Number(total._sum.amount ?? 0) < config.minApprovedDepositTotal) {
      return `At least ${config.minApprovedDepositTotal.toLocaleString()} BDT in approved deposits required.`;
    }
  }
  return null;
}

export async function runPromotionClaim(input: {
  ruleId: string;
  userId: string;
  actorRole: string;
}): Promise<ClaimResult> {
  const { ruleId, userId, actorRole } = input;
  const now = new Date();
  const rule = await db.bonusRule.findUnique({ where: { id: ruleId } });

  if (!rule) {
    return { ok: false, action: 'not_eligible', httpStatus: 404, code: 'NOT_FOUND', message: 'Promotion not found.' };
  }
  if (rule.status !== 'active') {
    return { ok: false, action: 'disabled', httpStatus: 409, code: 'INACTIVE', message: 'This promotion is not active right now.' };
  }
  if (rule.startsAt && rule.startsAt > now) {
    return { ok: false, action: 'not_eligible', httpStatus: 409, code: 'OUT_OF_WINDOW', message: 'This promotion has not started yet.' };
  }
  if (rule.endsAt && rule.endsAt < now) {
    return { ok: false, action: 'not_eligible', httpStatus: 409, code: 'OUT_OF_WINDOW', message: 'This promotion has ended.' };
  }

  const behavior = resolveClaimBehavior(rule);
  if (behavior === 'disabled') {
    return {
      ok: false,
      action: 'disabled',
      httpStatus: 409,
      code: 'CLAIM_DISABLED',
      message: 'This promotion is not available for self-claim right now.',
    };
  }

  const warning = promotionConfigWarning(rule);
  if (warning) {
    return {
      ok: false,
      action: 'config_error',
      httpStatus: 409,
      code: 'PROMOTION_CONFIG_ERROR',
      message: 'This promotion is temporarily unavailable. Please try another offer.',
    };
  }

  const bucket = bucketForPromotionType(rule.type, now);
  const prior = await db.promotionClaim.findUnique({
    where: { userId_ruleId_dayBucket: { userId, ruleId, dayBucket: bucket } },
  });
  if (prior?.status === 'granted') {
    return {
      ok: false,
      action: 'not_eligible',
      httpStatus: 409,
      code: 'ALREADY_CLAIMED',
      message: rule.type === 'weekly'
        ? 'You have already claimed this promotion this week.'
        : 'You have already claimed this promotion today.',
      meta: { previousClaimId: prior.id, previousGrantId: prior.bonusGrantId },
    };
  }

  const eligibility = await eligibilityFailure(userId, rule);
  if (eligibility) {
    return { ok: false, action: 'not_eligible', httpStatus: 403, code: 'NOT_ELIGIBLE', message: eligibility };
  }

  if (behavior === 'deposit') {
    return {
      ok: true,
      action: 'redirect',
      url: buildPromotionDepositUrl(rule),
      message: 'Continue to deposit to claim this promotion.',
      ruleName: rule.name,
    };
  }

  if (behavior === 'redirect') {
    const url = promotionTargetUrl(rule);
    if (!url) {
      return {
        ok: false,
        action: 'config_error',
        httpStatus: 409,
        code: 'PROMOTION_CONFIG_ERROR',
        message: 'This promotion destination is temporarily unavailable.',
      };
    }
    return { ok: true, action: 'redirect', url, message: 'Continue to this promotion.', ruleName: rule.name };
  }

  const payout = flatPayout(rule);
  if (payout.lte(0)) {
    return {
      ok: false,
      action: 'config_error',
      httpStatus: 409,
      code: 'PROMOTION_CONFIG_ERROR',
      message: 'This promotion is temporarily unavailable. Please try another offer.',
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const claim = await tx.promotionClaim.create({
        data: { userId, ruleId, dayBucket: bucket, status: 'granted' },
      });
      const grant = await grantBonusInTx(tx, {
        userId,
        rule,
        amount: payout,
        sourceType: 'promotion_claim',
        sourceId: claim.id,
        note: `Promotion claim ${rule.name}`,
      });
      if (!grant) throw new Error('PROMOTION_GRANT_EMPTY');
      await tx.promotionClaim.update({
        where: { id: claim.id },
        data: { bonusGrantId: grant.grantId },
      });
      await tx.activityLog.create({
        data: {
          actorId: userId,
          actorRole,
          action: 'PROMOTION_CLAIM_GRANT',
          target: rule.id,
          detail: rule.name,
          meta: {
            claimId: claim.id,
            bonusGrantId: grant.grantId,
            amount: Number(grant.amount),
            action: 'direct_claim_success',
          } as Prisma.JsonObject,
        },
      });
      return { claimId: claim.id, grantId: grant.grantId, amount: Number(grant.amount) };
    });
    return {
      ok: true,
      action: 'direct_claim_success',
      bonusGrantId: result.grantId,
      amount: result.amount,
      claimId: result.claimId,
      ruleName: rule.name,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return {
        ok: false,
        action: 'not_eligible',
        httpStatus: 409,
        code: 'ALREADY_CLAIMED',
        message: rule.type === 'weekly'
          ? 'You have already claimed this promotion this week.'
          : 'You have already claimed this promotion today.',
      };
    }
    console.error('[promotions/claim] grant failed', err);
    return {
      ok: false,
      action: 'config_error',
      httpStatus: 500,
      code: 'CLAIM_FAILED',
      message: 'Claim could not be processed. Please try again.',
    };
  }
}
