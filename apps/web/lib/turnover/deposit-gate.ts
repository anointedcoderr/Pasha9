// Built by Anointed Coder.
//
// Turnover gate for the withdrawal flow. Combines three real gates:
//
//   1. Deposit gate (existing). lifetime-aggregate:
//        depositRequired  = SUM(Deposit.amount where status='approved') * multiplier
//        depositCompleted = SUM(ProviderTransaction.betAmount where status='accepted')
//
//   2. Betting Pass BDT Balance gate (per-grant). Each claim of a
//        rewardKind='bdt_balance' tier creates an active UserBonus row
//        with sourceType='betting_pass_bdt' and turnoverRequired =
//        rewardAmount * tier.turnoverX. The bonus engine's
//        addTurnover() loop ticks down UserBonus.turnoverProgress as
//        the player wagers, and flips status to 'completed' (via
//        releaseBonus, which is a no-op for this sourceType because
//        the money landed in Wallet.balance at claim time, not
//        lockedBalance).
//
//   3. Referral reward gate (per-grant). Paid fixed rewards and
//        percentage commissions land in Wallet.balance and create
//        active UserBonus rows until their configured turnover is met.
//
// Combined totals reported to the UI and used by the POST gate:
//   requiredTurnover  = depositRequired + bettingPassRequired
//   completedTurnover = depositCompleted + bettingPassCompleted
//   remainingTurnover = max(0, requiredTurnover - completedTurnover)
//
// The same accepted bet ticks down BOTH gates (deposit completed +
// the FIFO-distributed UserBonus.turnoverProgress). That is intentional
// per client spec: a 100 BDT @ 20x BP reward must add 2000 BDT to the
// total required turnover, and a 1000 BDT wager closes 1000 BDT of
// the required total (against the BP grant FIFO).

import { db } from '@/lib/db/client';

const SETTING_KEY = 'deposit_turnover_multiplier';
const DEFAULT_MULTIPLIER = 1.0;

// Active UserBonus grants with this sourceType represent BDT Balance
// rewards that landed in Wallet.balance and are still under a wager
// requirement. They also drive the withdrawable-balance subtraction.
const BDT_BALANCE_LOCK_SOURCE_TYPE = 'betting_pass_bdt';
const REFERRAL_LOCK_SOURCE_TYPES = ['referral_first_deposit', 'referral_commission'];

export interface DepositTurnoverStatus {
  multiplier: number;
  approvedDepositTotal: number;

  // ----- Per-source breakdown (UI uses these to render two rows) -----
  depositRequired: number;
  depositCompleted: number;
  depositRemaining: number;

  bettingPassRequired: number;
  bettingPassCompleted: number;
  bettingPassRemaining: number;

  referralRequired: number;
  referralCompleted: number;
  referralRemaining: number;

  // ----- Combined totals (what the gate enforces) -----
  requiredTurnover: number;
  completedTurnover: number;
  remainingTurnover: number;
  isMet: boolean;

  // Sum of active rewards credited directly to Wallet.balance but
  // still under a turnover requirement. Subtracted from the
  // withdrawable balance independently of the gate above so that the
  // available-balance check fails fast even if the deposit gate is
  // disabled (multiplier=0).
  bdtBalanceLocked: number;
  referralBalanceLocked: number;
}

export async function computeBdtBalanceLocked(userId: string): Promise<number> {
  try {
    const agg = await db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: BDT_BALANCE_LOCK_SOURCE_TYPE },
      _sum: { amount: true },
    });
    return Math.max(0, Number(agg._sum?.amount ?? 0));
  } catch {
    return 0;
  }
}

export async function computeReferralBalanceLocked(userId: string): Promise<number> {
  try {
    const agg = await db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: REFERRAL_LOCK_SOURCE_TYPES } },
      _sum: { amount: true },
    });
    return Math.max(0, Number(agg._sum?.amount ?? 0));
  } catch {
    return 0;
  }
}

export async function loadDepositTurnoverMultiplier(): Promise<number> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
    if (!row) return DEFAULT_MULTIPLIER;
    const v = Number(row.value);
    if (!Number.isFinite(v) || v < 0) return DEFAULT_MULTIPLIER;
    return v;
  } catch {
    return DEFAULT_MULTIPLIER;
  }
}

export async function computeDepositTurnover(userId: string): Promise<DepositTurnoverStatus> {
  const multiplier = await loadDepositTurnoverMultiplier();

  const [depositAgg, betAgg, bpAgg, referralAgg, bdtBalanceLocked, referralBalanceLocked] = await Promise.all([
    db.deposit.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true },
    }),
    db.providerTransaction.aggregate({
      where: { userId, status: 'accepted' },
      _sum: { betAmount: true },
    }),
    db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: BDT_BALANCE_LOCK_SOURCE_TYPE },
      _sum: { turnoverRequired: true, turnoverProgress: true },
    }),
    db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: REFERRAL_LOCK_SOURCE_TYPES } },
      _sum: { turnoverRequired: true, turnoverProgress: true },
    }),
    computeBdtBalanceLocked(userId),
    computeReferralBalanceLocked(userId),
  ]);

  const approvedDepositTotal = Number(depositAgg._sum?.amount ?? 0);
  const depositCompleted = Math.abs(Number(betAgg._sum?.betAmount ?? 0));
  const depositRequired = approvedDepositTotal * multiplier;
  const depositRemaining = Math.max(0, depositRequired - depositCompleted);

  const bettingPassRequired = Math.max(0, Number(bpAgg._sum?.turnoverRequired ?? 0));
  const bettingPassCompleted = Math.max(0, Math.min(bettingPassRequired, Number(bpAgg._sum?.turnoverProgress ?? 0)));
  const bettingPassRemaining = Math.max(0, bettingPassRequired - bettingPassCompleted);

  const referralRequired = Math.max(0, Number(referralAgg._sum?.turnoverRequired ?? 0));
  const referralCompleted = Math.max(0, Math.min(referralRequired, Number(referralAgg._sum?.turnoverProgress ?? 0)));
  const referralRemaining = Math.max(0, referralRequired - referralCompleted);

  const requiredTurnover = depositRequired + bettingPassRequired + referralRequired;
  const completedTurnover = depositCompleted + bettingPassCompleted + referralCompleted;
  const remainingTurnover = Math.max(0, requiredTurnover - completedTurnover);
  // Gate is met only when BOTH gates are individually met. We could
  // also check remainingTurnover <= 0 but the per-source check is
  // more honest when the deposit gate completed > deposit required
  // (the player over-wagered for deposits but still owes BP wager).
  const isMet = depositRemaining <= 0 && bettingPassRemaining <= 0 && referralRemaining <= 0;

  return {
    multiplier,
    approvedDepositTotal,
    depositRequired,
    depositCompleted,
    depositRemaining,
    bettingPassRequired,
    bettingPassCompleted,
    bettingPassRemaining,
    referralRequired,
    referralCompleted,
    referralRemaining,
    requiredTurnover,
    completedTurnover,
    remainingTurnover,
    isMet,
    bdtBalanceLocked,
    referralBalanceLocked,
  };
}
