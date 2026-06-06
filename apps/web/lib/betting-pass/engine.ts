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

export interface ClaimWalletSnapshot {
  balance: number;
  bonusBalance: number;
  lockedBalance: number;
  lottoBalance: number;
}

export type ClaimResult =
  | {
      ok: true;
      claimId: string;
      rewardKind: string;
      rewardAmount: number;
      pointsSpent: number;
      pointsTotalAfter: number;
      currentTier: number;
      walletBalances: ClaimWalletSnapshot;
      bonusGrantId: string | null;
      turnoverRequired: number;
    }
  | { ok: false; code: 'TIER_LOCKED' | 'ALREADY_CLAIMED' | 'RULE_INACTIVE' | 'RULE_NOT_FOUND' | 'INSUFFICIENT_POINTS' };

export async function claimBettingPassReward(userId: string, ruleId: string): Promise<ClaimResult> {
  // Resolve config OUTSIDE the tx because loadBettingPassConfig hits
  // SystemSetting; keeping the tx tight reduces lock duration.
  const config = await loadBettingPassConfig();

  return await db.$transaction(async (tx) => {
    const rule = await tx.bettingPassRule.findUnique({ where: { id: ruleId } });
    if (!rule) return { ok: false, code: 'RULE_NOT_FOUND' };
    if (!rule.isActive) return { ok: false, code: 'RULE_INACTIVE' };

    const dup = await tx.bettingPassClaim.findUnique({ where: { userId_ruleId: { userId, ruleId } } });
    if (dup) return { ok: false, code: 'ALREADY_CLAIMED' };

    const progress = await tx.userBettingPassProgress.findUnique({ where: { userId } });
    const totalBefore = new Prisma.Decimal(progress?.pointsTotal ?? 0);
    const required = new Prisma.Decimal(rule.pointsRequired);
    if (totalBefore.lt(required)) return { ok: false, code: 'INSUFFICIENT_POINTS' };

    const rewardAmount = new Prisma.Decimal(rule.rewardAmount);
    const turnoverX = new Prisma.Decimal(rule.turnoverX ?? 0);
    const turnoverRequired = rewardAmount.mul(turnoverX);

    // ---------- Wallet credit per reward kind ----------
    let bonusGrantId: string | null = null;

    if (rule.rewardKind === 'coins' && rewardAmount.gt(0)) {
      await tx.wallet.upsert({
        where: { userId },
        update: { bonusBalance: { increment: rewardAmount } },
        create: { userId, balance: 0, bonusBalance: rewardAmount, lockedBalance: 0, currency: 'BDT' },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: 'bonus',
          amount: rewardAmount,
          status: 'completed',
          reference: `betting_pass:${ruleId}`,
          description: `Betting Pass coins reward (tier ${rule.tier})`,
          meta: { source: 'betting_pass_claim', ruleId, tier: rule.tier, rewardKind: 'coins' } as Prisma.JsonObject,
        },
      });
    } else if (rule.rewardKind === 'freebet' && rewardAmount.gt(0)) {
      await tx.wallet.upsert({
        where: { userId },
        update: { lockedBalance: { increment: rewardAmount } },
        create: { userId, balance: 0, bonusBalance: 0, lockedBalance: rewardAmount, currency: 'BDT' },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: 'bonus',
          amount: rewardAmount,
          status: 'completed',
          reference: `betting_pass:${ruleId}`,
          description: `Betting Pass freebet reward (tier ${rule.tier})`,
          meta: { source: 'betting_pass_claim', ruleId, tier: rule.tier, rewardKind: 'freebet' } as Prisma.JsonObject,
        },
      });
    } else if (rule.rewardKind === 'bonus' && rewardAmount.gt(0)) {
      // Bonus rewards land in lockedBalance with a traceable UserBonus
      // row so the existing turnover engine (lib/bonuses/engine.ts
      // addTurnover) can release them once the player wagers
      // amount * turnoverX. Mirrors the spin wheel pattern from
      // f3cf57d so the wallet ledger stays consistent.
      const bpRule = await tx.bonusRule.upsert({
        where: { code: 'bp_payout' },
        update: {},
        create: {
          code: 'bp_payout',
          name: 'Betting Pass Reward',
          type: 'manual',
          status: 'active',
          amount: 0,
          turnoverX: 0,
          validityDays: 30,
          description: 'Bonus issued by the Betting Pass tier claim flow.',
        },
        select: { id: true },
      });
      await tx.wallet.upsert({
        where: { userId },
        update: { lockedBalance: { increment: rewardAmount } },
        create: { userId, balance: 0, bonusBalance: 0, lockedBalance: rewardAmount, currency: 'BDT' },
      });
      const grant = await tx.userBonus.create({
        data: {
          userId,
          bonusRuleId: bpRule.id,
          amount: rewardAmount,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'active',
          turnoverRequired,
          turnoverProgress: 0,
          sourceType: 'betting_pass',
          sourceId: ruleId,
          note: `Betting Pass tier ${rule.tier}`,
        },
      });
      bonusGrantId = grant.id;
      await tx.transaction.create({
        data: {
          userId,
          type: 'bonus',
          amount: rewardAmount,
          status: 'completed',
          reference: `betting_pass:${ruleId}`,
          description: `Betting Pass bonus reward (tier ${rule.tier})`,
          meta: {
            source: 'betting_pass_claim',
            ruleId,
            tier: rule.tier,
            rewardKind: 'bonus',
            turnoverRequired: Number(turnoverRequired),
            bonusGrantId: grant.id,
          } as Prisma.JsonObject,
        },
      });
    }
    // rewardKind='physical' writes no wallet movement; the operator
    // fulfils via the BettingPassClaim row below.

    // ---------- Claim row (unique guard on userId+ruleId) ----------
    const claim = await tx.bettingPassClaim.create({
      data: {
        userId,
        ruleId,
        tier: rule.tier,
        rewardKind: rule.rewardKind,
        rewardAmount: rule.rewardAmount,
        status: 'paid',
        bonusGrantId,
      },
    });

    // ---------- Spend the points via a negative ledger event ----------
    // BettingPassEvent.points is Decimal; aggregating positives and
    // negatives in rebuildProgress yields the spendable balance.
    // idempotencyKey scoped to the claim id so retries are no-ops.
    await tx.bettingPassEvent.create({
      data: {
        userId,
        source: 'claim',
        sourceId: claim.id,
        points: required.neg(),
        pointsFromDeposit: 0,
        pointsFromBet: 0,
        idempotencyKey: `${config.seasonKey}:claim:${claim.id}`,
      },
    });

    const { pointsTotal, currentTier } = await rebuildProgress(tx, userId);

    const walletAfter = await tx.wallet.findUnique({
      where: { userId },
      select: { balance: true, bonusBalance: true, lockedBalance: true, lottoBalance: true },
    });

    return {
      ok: true,
      claimId: claim.id,
      rewardKind: rule.rewardKind,
      rewardAmount: Number(rewardAmount),
      pointsSpent: rule.pointsRequired,
      pointsTotalAfter: pointsTotal,
      currentTier,
      walletBalances: {
        balance: Number(walletAfter?.balance ?? 0),
        bonusBalance: Number(walletAfter?.bonusBalance ?? 0),
        lockedBalance: Number(walletAfter?.lockedBalance ?? 0),
        lottoBalance: Number(walletAfter?.lottoBalance ?? 0),
      },
      bonusGrantId,
      turnoverRequired: Number(turnoverRequired),
    };
  });
}
