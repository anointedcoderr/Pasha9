// Built by Anointed Coder.
//
// Betting Pass engine. Two award entry points and one claim entry
// point. All three are idempotent and safe to retry.
//
//   accrueBettingPassOnDeposit  - called from POST /api/admin/deposits/[id]/approve
//   accrueBettingPassOnBet      - called from addTurnover() in lib/bonuses/engine.ts
//   claimBettingPassReward      - called from POST /api/betting-pass/claim/[id]
//
// Idempotency:
//   - BettingPassEvent.idempotencyKey is UNIQUE. Re-firing the same
//     deposit or the same provider transaction is a no-op.
//   - BettingPassClaim has @@unique([userId, ruleId]) so re-claim is
//     409 ALREADY_CLAIMED.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { loadBettingPassConfig } from './config';

export interface AccrueResult {
  pointsAwarded: number;
  pointsTotalAfter: number;
  newTier: number;
  skippedReason?: 'disabled' | 'duplicate' | 'zero_points';
}

async function rebuildProgress(tx: Prisma.TransactionClient, userId: string): Promise<{ pointsTotal: number; currentTier: number }> {
  const aggregate = await tx.bettingPassEvent.aggregate({
    where: { userId },
    _sum: { points: true, pointsFromDeposit: true, pointsFromBet: true },
  });
  const total = Number(aggregate._sum?.points ?? 0);
  const fromDeposit = Number(aggregate._sum?.pointsFromDeposit ?? 0);
  const fromBet = Number(aggregate._sum?.pointsFromBet ?? 0);

  const reachedRule = await tx.bettingPassRule.findFirst({
    where: { isActive: true, pointsRequired: { lte: total } },
    orderBy: { pointsRequired: 'desc' },
    select: { tier: true },
  });
  const currentTier = reachedRule?.tier ?? 0;

  await tx.userBettingPassProgress.upsert({
    where: { userId },
    update: {
      pointsTotal: total,
      pointsFromDeposit: fromDeposit,
      pointsFromBet: fromBet,
      currentTier,
      lastEventAt: new Date(),
    },
    create: {
      userId,
      pointsTotal: total,
      pointsFromDeposit: fromDeposit,
      pointsFromBet: fromBet,
      currentTier,
      lastEventAt: new Date(),
    },
  });

  return { pointsTotal: total, currentTier };
}

export async function accrueBettingPassOnDeposit(userId: string, depositId: string, amount: number): Promise<AccrueResult> {
  const config = await loadBettingPassConfig();
  if (!config.enabled) {
    return { pointsAwarded: 0, pointsTotalAfter: 0, newTier: 0, skippedReason: 'disabled' };
  }

  const points = Math.max(0, amount * config.pointsPerBdtDeposit);
  if (points <= 0) {
    return { pointsAwarded: 0, pointsTotalAfter: 0, newTier: 0, skippedReason: 'zero_points' };
  }

  const idempotencyKey = `${config.seasonKey}:deposit:${depositId}`;

  return await db.$transaction(async (tx) => {
    const existing = await tx.bettingPassEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      const progress = await tx.userBettingPassProgress.findUnique({ where: { userId } });
      return {
        pointsAwarded: 0,
        pointsTotalAfter: Number(progress?.pointsTotal ?? 0),
        newTier: progress?.currentTier ?? 0,
        skippedReason: 'duplicate',
      };
    }

    await tx.bettingPassEvent.create({
      data: {
        userId,
        source: 'deposit',
        sourceId: depositId,
        points,
        pointsFromDeposit: points,
        pointsFromBet: 0,
        idempotencyKey,
      },
    });

    const { pointsTotal, currentTier } = await rebuildProgress(tx, userId);

    return {
      pointsAwarded: points,
      pointsTotalAfter: pointsTotal,
      newTier: currentTier,
    };
  });
}

export async function accrueBettingPassOnBet(userId: string, providerTxId: string, betAmount: number): Promise<AccrueResult> {
  const config = await loadBettingPassConfig();
  if (!config.enabled) {
    return { pointsAwarded: 0, pointsTotalAfter: 0, newTier: 0, skippedReason: 'disabled' };
  }

  const points = Math.max(0, betAmount * config.pointsPerBdtBet);
  if (points <= 0) {
    return { pointsAwarded: 0, pointsTotalAfter: 0, newTier: 0, skippedReason: 'zero_points' };
  }

  const idempotencyKey = `${config.seasonKey}:bet:${providerTxId}`;

  return await db.$transaction(async (tx) => {
    const existing = await tx.bettingPassEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      const progress = await tx.userBettingPassProgress.findUnique({ where: { userId } });
      return {
        pointsAwarded: 0,
        pointsTotalAfter: Number(progress?.pointsTotal ?? 0),
        newTier: progress?.currentTier ?? 0,
        skippedReason: 'duplicate',
      };
    }

    await tx.bettingPassEvent.create({
      data: {
        userId,
        source: 'bet',
        sourceId: providerTxId,
        points,
        pointsFromDeposit: 0,
        pointsFromBet: points,
        idempotencyKey,
      },
    });

    const { pointsTotal, currentTier } = await rebuildProgress(tx, userId);

    return {
      pointsAwarded: points,
      pointsTotalAfter: pointsTotal,
      newTier: currentTier,
    };
  });
}

export type ClaimResult =
  | { ok: true; claimId: string; rewardKind: string; rewardAmount: number }
  | { ok: false; code: 'TIER_LOCKED' | 'ALREADY_CLAIMED' | 'RULE_INACTIVE' | 'RULE_NOT_FOUND' };

export async function claimBettingPassReward(userId: string, ruleId: string): Promise<ClaimResult> {
  return await db.$transaction(async (tx) => {
    const rule = await tx.bettingPassRule.findUnique({ where: { id: ruleId } });
    if (!rule) return { ok: false, code: 'RULE_NOT_FOUND' };
    if (!rule.isActive) return { ok: false, code: 'RULE_INACTIVE' };

    const progress = await tx.userBettingPassProgress.findUnique({ where: { userId } });
    const total = Number(progress?.pointsTotal ?? 0);
    if (total < rule.pointsRequired) return { ok: false, code: 'TIER_LOCKED' };

    const dup = await tx.bettingPassClaim.findUnique({ where: { userId_ruleId: { userId, ruleId } } });
    if (dup) return { ok: false, code: 'ALREADY_CLAIMED' };

    const rewardAmount = Number(rule.rewardAmount);

    if (rule.rewardKind === 'coins' && rewardAmount > 0) {
      await tx.wallet.upsert({
        where: { userId },
        update: { bonusBalance: { increment: rewardAmount } },
        create: { userId, balance: 0, bonusBalance: rewardAmount, lockedBalance: 0, currency: 'BDT' },
      });
    } else if (rule.rewardKind === 'freebet' && rewardAmount > 0) {
      await tx.wallet.upsert({
        where: { userId },
        update: { lockedBalance: { increment: rewardAmount } },
        create: { userId, balance: 0, bonusBalance: 0, lockedBalance: rewardAmount, currency: 'BDT' },
      });
    }
    // For rewardKind='bonus' or 'physical' the operator handles the
    // payout offline. The claim row + RewardClaim-style audit is
    // enough for the admin to fulfil it.

    const claim = await tx.bettingPassClaim.create({
      data: {
        userId,
        ruleId,
        tier: rule.tier,
        rewardKind: rule.rewardKind,
        rewardAmount: rule.rewardAmount,
        status: 'paid',
      },
    });

    return { ok: true, claimId: claim.id, rewardKind: rule.rewardKind, rewardAmount };
  });
}
