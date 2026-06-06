// Built by Anointed Coder.
//
// Deposit turnover gate for the withdrawal flow.
//
// Rule (intentionally simple, lifetime-aggregate; no schema change):
//   required  = SUM(Deposit.amount where status='approved') * multiplier
//   completed = SUM(ProviderTransaction.betAmount where status='accepted')
//   remaining = max(0, required - completed)
//
// The multiplier comes from SystemSetting key `deposit_turnover_multiplier`,
// default 1.0 (every BDT deposited must be wagered once before withdrawal).
// Admin sets it to 0 to disable the gate entirely, or higher to require
// more wagering. Per-row historical snapshotting is NOT done here so a
// multiplier change applies forward AND backward to the lifetime
// aggregate. If you need per-deposit lock-in, the next iteration would
// add Deposit.turnoverRequired/Completed columns.
//
// Cancelled / refunded / rolled-back bets are excluded by the
// status='accepted' filter on ProviderTransaction (same filter used by
// the bonus turnover engine, kept consistent on purpose).

import { db } from '@/lib/db/client';

const SETTING_KEY = 'deposit_turnover_multiplier';
const DEFAULT_MULTIPLIER = 1.0;

export interface DepositTurnoverStatus {
  multiplier: number;
  approvedDepositTotal: number;
  requiredTurnover: number;
  completedTurnover: number;
  remainingTurnover: number;
  isMet: boolean;
  // Sum of active rewards credited directly to Wallet.balance but
  // still under a turnover requirement (currently Betting Pass
  // BDT Balance grants). This is NOT included in the deposit gate's
  // remaining number; the caller subtracts it from the withdrawable
  // balance instead, because the money is already in the main wallet
  // by design (operator surface), just not yet free to withdraw.
  bdtBalanceLocked: number;
}

// Active UserBonus grants with this sourceType represent BDT Balance
// rewards that were credited to Wallet.balance but are still waiting
// for the player to complete their wager. Withdrawals must subtract
// this from the available balance until the grant is released.
const BDT_BALANCE_LOCK_SOURCE_TYPE = 'betting_pass_bdt';

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

  const [depositAgg, betAgg, bdtBalanceLocked] = await Promise.all([
    db.deposit.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true },
    }),
    db.providerTransaction.aggregate({
      where: { userId, status: 'accepted' },
      _sum: { betAmount: true },
    }),
    computeBdtBalanceLocked(userId),
  ]);

  const approvedDepositTotal = Number(depositAgg._sum?.amount ?? 0);
  const completedTurnover = Math.abs(Number(betAgg._sum?.betAmount ?? 0));
  const requiredTurnover = approvedDepositTotal * multiplier;
  const remainingTurnover = Math.max(0, requiredTurnover - completedTurnover);
  const isMet = remainingTurnover <= 0;

  return {
    multiplier,
    approvedDepositTotal,
    requiredTurnover,
    completedTurnover,
    remainingTurnover,
    isMet,
    bdtBalanceLocked,
  };
}
