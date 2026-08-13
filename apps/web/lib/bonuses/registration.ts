// Built by Anointed Coder.
//
// Registration Bonus System.
//
// A new player is credited a bonus at sign-up. That money is LOCKED: it sits
// in the bonus/locked pockets, not the spendable balance, so it cannot be
// withdrawn and cannot leave the platform until the player has earned it.
//
// THE UNLOCK RULE, as agreed with the client:
//
//   Once the player's approved deposits reach the required percentage of the
//   bonus amount, their winnings unlock into the spendable balance, capped at
//   the maximum winning limit.
//
// Worked example with amount 100, required deposit 50%, max winning 500:
//   register            -> 100 locked, 0 spendable
//   deposit 50 approved -> requirement met (50 is 50% of 100)
//   winnings unlock, up to 500. Anything above 500 is forfeited, which is what
//   a maximum winning limit means.
//
// EVERY money movement here goes through applyWalletMovement, so the wallet
// and the ledger move together and the whole thing is visible in Wallet Audit
// like any other credit. No direct wallet writes.
//
// The grant is a UserBonus row with no bonusRuleId. That field is optional
// precisely so a grant can exist without an unrelated BonusRule, which matters
// here because the live database is evolved with db push and never re-seeded,
// so a rule row cannot be assumed to exist.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';

type Tx = Prisma.TransactionClient;

export const REGISTRATION_BONUS_KEYS = {
  enabled: 'regbonus_enabled',
  amount: 'regbonus_amount',
  maxWinning: 'regbonus_max_winning',
  requiredDepositPercent: 'regbonus_required_deposit_percent',
  turnoverMultiplier: 'regbonus_turnover_multiplier',
  eligibleGames: 'regbonus_eligible_games',
  lockWinnings: 'regbonus_lock_winnings',
} as const;

export interface RegistrationBonusConfig {
  enabled: boolean;
  /** Credited at sign-up. */
  amount: Prisma.Decimal;
  /** Most a player can keep from this bonus. 0 means no cap. */
  maxWinning: Prisma.Decimal;
  /** Percent OF THE BONUS AMOUNT the player must deposit to unlock. */
  requiredDepositPercent: Prisma.Decimal;
  /** Wagering requirement = amount * this. */
  turnoverMultiplier: Prisma.Decimal;
  /** Game uids that count toward the requirement. Empty means all games. */
  eligibleGames: string[];
  /** When false the bonus is spendable immediately (no locked winnings). */
  lockWinnings: boolean;
}

export const DEFAULT_REGISTRATION_BONUS: RegistrationBonusConfig = {
  // OFF by default. A bonus that switched itself on during a deploy would
  // start giving money away without anyone deciding to.
  enabled: false,
  amount: new Prisma.Decimal(0),
  maxWinning: new Prisma.Decimal(0),
  requiredDepositPercent: new Prisma.Decimal(0),
  turnoverMultiplier: new Prisma.Decimal(0),
  eligibleGames: [],
  lockWinnings: true,
};

const SOURCE_TYPE = 'registration_bonus';

function dec(v: string | undefined, fallback: Prisma.Decimal): Prisma.Decimal {
  if (v == null || v.trim() === '') return fallback;
  try {
    const d = new Prisma.Decimal(v.trim());
    return d.isNegative() ? fallback : d;
  } catch {
    return fallback;
  }
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  const s = v.trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(s)) return true;
  if (['false', '0', 'off', 'no'].includes(s)) return false;
  return fallback;
}

/** Read the whole configuration in one query. Never throws. */
export async function loadRegistrationBonusConfig(): Promise<RegistrationBonusConfig> {
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await db.systemSetting.findMany({
      where: { key: { in: Object.values(REGISTRATION_BONUS_KEYS) } },
      select: { key: true, value: true },
    });
  } catch {
    return { ...DEFAULT_REGISTRATION_BONUS };
  }
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const K = REGISTRATION_BONUS_KEYS;

  return {
    enabled: bool(m.get(K.enabled), DEFAULT_REGISTRATION_BONUS.enabled),
    amount: dec(m.get(K.amount), DEFAULT_REGISTRATION_BONUS.amount),
    maxWinning: dec(m.get(K.maxWinning), DEFAULT_REGISTRATION_BONUS.maxWinning),
    requiredDepositPercent: dec(m.get(K.requiredDepositPercent), DEFAULT_REGISTRATION_BONUS.requiredDepositPercent),
    turnoverMultiplier: dec(m.get(K.turnoverMultiplier), DEFAULT_REGISTRATION_BONUS.turnoverMultiplier),
    eligibleGames: (m.get(K.eligibleGames) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    lockWinnings: bool(m.get(K.lockWinnings), DEFAULT_REGISTRATION_BONUS.lockWinnings),
  };
}

/**
 * Credit the registration bonus. Call inside the registration transaction so a
 * failed sign-up cannot leave a bonus behind.
 *
 * Returns null when the feature is off, the amount is zero, or the player
 * already has one.
 *
 * DELIBERATELY THROWS on a real failure rather than swallowing it. This
 * function does two things that must both happen or neither: it creates the
 * UserBonus row carrying the turnover REQUIREMENT, and it moves the bonus
 * MONEY. An earlier version wrapped the whole body in try/catch and returned
 * null on error. Because the caller runs it inside db.$transaction and that
 * catch meant nothing ever propagated, the transaction COMMITTED anyway - so
 * a failure in the money movement left the requirement row behind with no
 * bonus attached. The player ended up owing turnover for money they never
 * received, which is the worst possible way for this to fail.
 *
 * The sign-up is still protected: the caller wraps this in its own .catch(),
 * so a throw here rolls this transaction back and lets the registration
 * itself continue. Failing loudly is what makes the rollback work.
 */
export async function grantRegistrationBonus(tx: Tx, userId: string): Promise<{ grantId: string } | null> {
  {
    const cfg = await loadRegistrationBonusConfig();
    if (!cfg.enabled || cfg.amount.lte(0)) return null;

    // One per player, ever. Cheap insurance against a retried sign-up.
    const existing = await tx.userBonus.findFirst({
      where: { userId, sourceType: SOURCE_TYPE },
      select: { id: true },
    });
    if (existing) return null;

    const turnoverRequired = cfg.amount.mul(cfg.turnoverMultiplier);

    const grant = await tx.userBonus.create({
      data: {
        userId,
        amount: cfg.amount,
        status: 'active',
        turnoverRequired,
        turnoverProgress: 0,
        sourceType: SOURCE_TYPE,
        note: `Registration bonus. Unlocks after depositing ${cfg.requiredDepositPercent.toFixed(0)}% of ${cfg.amount.toFixed(2)}.`,
      },
      select: { id: true },
    });

    if (cfg.lockWinnings) {
      // Locked: the pockets move, the spendable balance does not. amount stays
      // 0 so the money is not counted twice against the wallet total.
      await applyWalletMovement({
        tx,
        userId,
        amount: new Prisma.Decimal(0),
        bonusDelta: cfg.amount,
        lockedDelta: cfg.amount,
        type: LEDGER_TYPE.bonusGrant,
        description: 'Registration bonus (locked until deposit requirement is met)',
        bonusSource: SOURCE_TYPE,
        referenceId: grant.id,
      });
    } else {
      // Operator chose to hand it over outright.
      await applyWalletMovement({
        tx,
        userId,
        amount: cfg.amount,
        type: LEDGER_TYPE.bonusGrant,
        description: 'Registration bonus',
        bonusSource: SOURCE_TYPE,
        referenceId: grant.id,
      });
    }

    return { grantId: grant.id };
  }
}

export interface RegistrationBonusStatus {
  active: boolean;
  grantId: string | null;
  amount: string;
  /** Total approved deposits counted toward the requirement. */
  deposited: string;
  /** Absolute figure the player must deposit. */
  requiredDeposit: string;
  requiredDepositPercent: string;
  depositMet: boolean;
  maxWinning: string;
  /** Still locked, in the locked pocket. */
  locked: string;
  unlocked: boolean;
  /** Set once the cap has bitten, so the popup can say so. */
  cappedAt: string | null;
  turnoverRequired: string;
  turnoverProgress: string;
  eligibleGames: string[];
}

/** Read-only view for the player's popup and the admin screen. */
export async function getRegistrationBonusStatus(userId: string): Promise<RegistrationBonusStatus | null> {
  const cfg = await loadRegistrationBonusConfig();

  const grant = await db.userBonus.findFirst({
    where: { userId, sourceType: SOURCE_TYPE },
    orderBy: { claimedAt: 'desc' },
  });
  if (!grant) return null;

  const amount = new Prisma.Decimal(grant.amount);
  const requiredDeposit = amount.mul(cfg.requiredDepositPercent).div(100);

  const depositAgg = await db.deposit.aggregate({
    where: { userId, status: 'approved' },
    _sum: { amount: true },
  });
  const deposited = new Prisma.Decimal(depositAgg._sum.amount ?? 0);

  const wallet = await db.wallet.findUnique({
    where: { userId },
    select: { lockedBalance: true },
  });

  return {
    active: grant.status === 'active',
    grantId: grant.id,
    amount: amount.toFixed(2),
    deposited: deposited.toFixed(2),
    requiredDeposit: requiredDeposit.toFixed(2),
    requiredDepositPercent: cfg.requiredDepositPercent.toFixed(0),
    depositMet: deposited.gte(requiredDeposit),
    maxWinning: cfg.maxWinning.toFixed(2),
    locked: new Prisma.Decimal(wallet?.lockedBalance ?? 0).toFixed(2),
    unlocked: grant.status === 'completed',
    cappedAt: cfg.maxWinning.gt(0) ? cfg.maxWinning.toFixed(2) : null,
    turnoverRequired: new Prisma.Decimal(grant.turnoverRequired).toFixed(2),
    turnoverProgress: new Prisma.Decimal(grant.turnoverProgress).toFixed(2),
    eligibleGames: cfg.eligibleGames,
  };
}

/**
 * Unlock the bonus once the deposit requirement is met. Safe to call after
 * every deposit approval: it does nothing unless the requirement has just been
 * satisfied, and nothing at all on a second call.
 *
 * The maximum winning limit is applied HERE, at the moment money becomes the
 * player's to keep. Anything above the cap is forfeited, which is what a
 * maximum winning limit means, and the forfeit is recorded as its own ledger
 * entry rather than quietly reducing a figure.
 */
export async function unlockRegistrationBonusIfEligible(userId: string): Promise<{ unlocked: boolean; released: string } | null> {
  try {
    const cfg = await loadRegistrationBonusConfig();

    const grant = await db.userBonus.findFirst({
      where: { userId, sourceType: SOURCE_TYPE, status: 'active' },
      orderBy: { claimedAt: 'desc' },
      select: { id: true, amount: true },
    });
    if (!grant) return null;

    const amount = new Prisma.Decimal(grant.amount);
    const requiredDeposit = amount.mul(cfg.requiredDepositPercent).div(100);

    const depositAgg = await db.deposit.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true },
    });
    const deposited = new Prisma.Decimal(depositAgg._sum.amount ?? 0);
    if (deposited.lt(requiredDeposit)) return { unlocked: false, released: '0.00' };

    return await db.$transaction(async (tx) => {
      // Re-read inside the transaction so two concurrent deposit approvals
      // cannot both unlock the same grant.
      const fresh = await tx.userBonus.findFirst({
        where: { id: grant.id, status: 'active' },
        select: { id: true },
      });
      if (!fresh) return { unlocked: false, released: '0.00' };

      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { lockedBalance: true },
      });
      const locked = new Prisma.Decimal(wallet?.lockedBalance ?? 0);
      if (locked.lte(0)) {
        await tx.userBonus.update({
          where: { id: grant.id },
          data: { status: 'completed', releasedAt: new Date() },
        });
        return { unlocked: true, released: '0.00' };
      }

      // Cap applies to what the player keeps.
      const cap = cfg.maxWinning;
      const release = cap.gt(0) && locked.gt(cap) ? cap : locked;
      const forfeit = locked.sub(release);

      await applyWalletMovement({
        tx,
        userId,
        amount: release,
        lockedDelta: release.neg(),
        type: LEDGER_TYPE.bonusRelease,
        description: `Registration bonus unlocked after ${cfg.requiredDepositPercent.toFixed(0)}% deposit requirement met`,
        bonusSource: SOURCE_TYPE,
        referenceId: grant.id,
      });

      if (forfeit.gt(0)) {
        // Recorded, not silently dropped, so the player and the operator can
        // both see why the figure differs from the locked total.
        await applyWalletMovement({
          tx,
          userId,
          amount: new Prisma.Decimal(0),
          bonusDelta: forfeit.neg(),
          lockedDelta: forfeit.neg(),
          type: LEDGER_TYPE.bonusClawback,
          description: `Above the ${cap.toFixed(2)} maximum winning limit, forfeited`,
          bonusSource: SOURCE_TYPE,
          referenceId: grant.id,
        });
      }

      await tx.userBonus.update({
        where: { id: grant.id },
        data: { status: 'completed', releasedAt: new Date() },
      });

      return { unlocked: true, released: release.toFixed(2) };
    });
  } catch (err) {
    // A deposit approval must not fail because the unlock did.
    console.error('[registration-bonus] unlock failed', err);
    return null;
  }
}

/** Does this game count toward the requirement? Empty list means all do. */
export function isEligibleGame(cfg: RegistrationBonusConfig, gameUid: string | null | undefined): boolean {
  if (cfg.eligibleGames.length === 0) return true;
  if (!gameUid) return false;
  return cfg.eligibleGames.includes(gameUid);
}
