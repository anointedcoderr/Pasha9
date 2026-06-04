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

  const [depositAgg, betAgg] = await Promise.all([
    db.deposit.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true },
    }),
    db.providerTransaction.aggregate({
      where: { userId, status: 'accepted' },
      _sum: { betAmount: true },
    }),
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
  };
}
