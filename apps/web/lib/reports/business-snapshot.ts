// Built by Anointed Coder.
//
// Business KPI snapshot for the /admin/reports Overview tab. Returns
// every headline metric a Pasha 9 operator needs at a glance, scoped
// to a date range. Built from the canonical tables (Deposit, Withdrawal,
// User, UserBonus, AffiliateCommission, CashbackPayout,
// ProviderTransaction) so every number is grounded in real rows.
//
// Designed to replace the all-time-only KPI bundle that /api/admin/overview
// returns. The Overview tab now shows these with a date range picker
// (default = last 30 days).

import { db } from '@/lib/db/client';

export interface BusinessSnapshotInput {
  from: Date;
  to: Date;
}

export interface BusinessSnapshot {
  range: { from: string; to: string };

  // Acquisition
  totalRegistrations: number;       // User.createdAt in range
  firstTimeDepositors: number;      // distinct users whose FIRST approved deposit is in range
  firstTimeDepositSum: number;      // BDT sum of those first deposits

  // Activity
  activeLoggedInUsers: number;      // distinct User with lastLoginAt in range
  activePlayers: number;            // distinct User who placed at least one accepted bet in range
  depositingUsers: number;          // distinct User with at least one approved deposit in range

  // Money in
  approvedDepositCount: number;
  approvedDepositSum: number;
  pendingDepositCount: number;
  pendingDepositSum: number;

  // Money out
  approvedWithdrawalCount: number;
  approvedWithdrawalSum: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalSum: number;

  // Gaming volume
  totalWagered: number;             // SUM(ABS(ProviderTransaction.betAmount)) accepted
  totalWon: number;                 // SUM(ProviderTransaction.winAmount) accepted
  grossGamingRevenue: number;       // totalWagered - totalWon (positive = house ahead)
  betCount: number;                 // count of accepted bet ProviderTransaction rows

  // Costs
  bonusGranted: number;             // SUM(UserBonus.amount) granted in range
  cashbackPaid: number;             // SUM(CashbackPayout.cashbackAmount) where walletTxId set
  affiliateCommissionPaid: number;  // SUM(AffiliateCommission.amount) status=paid

  // Net
  netCash: number;                  // deposits - withdrawals
  operatingResult: number;          // netCash - bonus - cashback - commission

  // Averages
  avgDeposit: number;               // approvedDepositSum / approvedDepositCount
  avgWithdrawal: number;            // approvedWithdrawalSum / approvedWithdrawalCount
  avgRevenuePerActivePlayer: number; // grossGamingRevenue / activePlayers

  // Wallet balance snapshot (always now, not range-bound)
  walletBalanceLive: number;        // SUM(Wallet.balance) right now
  walletLockedLive: number;         // SUM(Wallet.lockedBalance) right now
  bonusBalanceLive: number;         // SUM(Wallet.bonusBalance) right now (reward coins)
}

function n(v: unknown): number {
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function safeDiv(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) / 100 : 0;
}

export async function getBusinessSnapshot(input: BusinessSnapshotInput): Promise<BusinessSnapshot> {
  const { from, to } = input;

  const [
    regCount,
    ftdRows,
    loggedInDistinct,
    activePlayerDistinct,
    depositingDistinct,
    depApproved,
    depPending,
    wdApproved,
    wdPending,
    betsAgg,
    winsAgg,
    betCount,
    bonusAgg,
    cashbackAgg,
    commissionAgg,
    walletAgg,
  ] = await Promise.all([
    // totalRegistrations
    db.user.count({ where: { createdAt: { gte: from, lte: to } } }),

    // firstTimeDepositors + firstTimeDepositSum (window query)
    db.$queryRaw<Array<{ count: bigint; sum: string | null }>>`
      SELECT COUNT(*)::bigint AS count, COALESCE(SUM(amt), 0)::text AS sum FROM (
        SELECT d."amount" AS amt,
               ROW_NUMBER() OVER (PARTITION BY d."userId" ORDER BY d."createdAt" ASC) AS rn
        FROM "Deposit" d
        WHERE d."status" = 'approved'
      ) ranked
      WHERE rn = 1 AND ranked.amt IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "Deposit" d2
          WHERE d2."status" = 'approved'
            AND d2."createdAt" BETWEEN ${from} AND ${to}
            AND d2."amount" = ranked.amt
        )
    `,
    // ^ Note: the EXISTS-by-amount above is a heuristic; safer is the
    // direct query below. Re-implement cleanly:

    // activeLoggedInUsers
    db.user.count({ where: { lastLoginAt: { gte: from, lte: to } } }),

    // activePlayers (distinct ProviderTransaction.userId accepted in range)
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "ProviderTransaction"
      WHERE "status" = 'accepted' AND "userId" IS NOT NULL
        AND "createdAt" BETWEEN ${from} AND ${to}
    `,

    // depositingUsers (distinct Deposit.userId approved in range)
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "Deposit"
      WHERE "status" = 'approved'
        AND "createdAt" BETWEEN ${from} AND ${to}
    `,

    // depApproved
    db.deposit.aggregate({
      where: { status: 'approved', createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // depPending - always current, not range-bound (these are "stuck" alerts)
    db.deposit.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // wdApproved
    db.withdrawal.aggregate({
      where: { status: 'approved', createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // wdPending
    db.withdrawal.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    // totalWagered: SUM(ABS(betAmount))
    db.$queryRaw<Array<{ sum: string | null }>>`
      SELECT COALESCE(SUM(ABS("betAmount")), 0)::text AS sum
      FROM "ProviderTransaction"
      WHERE "status" = 'accepted' AND "createdAt" BETWEEN ${from} AND ${to}
    `,
    // totalWon
    db.$queryRaw<Array<{ sum: string | null }>>`
      SELECT COALESCE(SUM("winAmount"), 0)::text AS sum
      FROM "ProviderTransaction"
      WHERE "status" = 'accepted' AND "createdAt" BETWEEN ${from} AND ${to}
    `,
    // betCount
    db.providerTransaction.count({
      where: { status: 'accepted', createdAt: { gte: from, lte: to } },
    }),

    // bonusGranted
    db.userBonus.aggregate({
      where: { claimedAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    // cashbackPaid (only payouts that actually credited the wallet)
    db.cashbackPayout.aggregate({
      where: { createdAt: { gte: from, lte: to }, walletTxId: { not: null } },
      _sum: { cashbackAmount: true },
    }),
    // affiliateCommissionPaid
    db.affiliateCommission.aggregate({
      where: { status: 'paid', createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),

    // Wallet balances (always now)
    db.wallet.aggregate({
      _sum: { balance: true, lockedBalance: true, bonusBalance: true },
    }),
  ]);

  // FTD is computed via a cleaner separate query because the inline
  // EXISTS heuristic above isn't reliable. Override with a dedicated
  // pass that picks each user's first approved deposit and counts
  // those whose createdAt is in range.
  const ftd = await db.$queryRaw<Array<{ count: bigint; sum: string | null }>>`
    SELECT COUNT(*)::bigint AS count, COALESCE(SUM(amt), 0)::text AS sum FROM (
      SELECT d."amount" AS amt,
             d."createdAt" AS ts,
             ROW_NUMBER() OVER (PARTITION BY d."userId" ORDER BY d."createdAt" ASC) AS rn
      FROM "Deposit" d
      WHERE d."status" = 'approved'
    ) ranked
    WHERE rn = 1 AND ranked.ts BETWEEN ${from} AND ${to}
  `;

  void ftdRows; // unused; kept just to keep the parallel Promise.all shape stable

  const ftdCount = Number(ftd[0]?.count ?? 0);
  const ftdSum = n(ftd[0]?.sum);

  const activePlayersCount = Number(activePlayerDistinct[0]?.count ?? 0);
  const depositingCount = Number(depositingDistinct[0]?.count ?? 0);

  const approvedDepositSum = n(depApproved._sum.amount);
  const approvedDepositCount = depApproved._count._all;
  const pendingDepositSum = n(depPending._sum.amount);
  const pendingDepositCount = depPending._count._all;
  const approvedWithdrawalSum = n(wdApproved._sum.amount);
  const approvedWithdrawalCount = wdApproved._count._all;
  const pendingWithdrawalSum = n(wdPending._sum.amount);
  const pendingWithdrawalCount = wdPending._count._all;

  const totalWagered = n(betsAgg[0]?.sum);
  const totalWon = n(winsAgg[0]?.sum);
  const grossGamingRevenue = Math.round((totalWagered - totalWon) * 100) / 100;

  const bonusGranted = n(bonusAgg._sum.amount);
  const cashbackPaid = n(cashbackAgg._sum.cashbackAmount);
  const affiliateCommissionPaid = n(commissionAgg._sum.amount);

  const netCash = Math.round((approvedDepositSum - approvedWithdrawalSum) * 100) / 100;
  const operatingResult = Math.round((netCash - bonusGranted - cashbackPaid - affiliateCommissionPaid) * 100) / 100;

  return {
    range: { from: from.toISOString(), to: to.toISOString() },

    totalRegistrations: regCount,
    firstTimeDepositors: ftdCount,
    firstTimeDepositSum: ftdSum,

    activeLoggedInUsers: loggedInDistinct,
    activePlayers: activePlayersCount,
    depositingUsers: depositingCount,

    approvedDepositCount,
    approvedDepositSum,
    pendingDepositCount,
    pendingDepositSum,

    approvedWithdrawalCount,
    approvedWithdrawalSum,
    pendingWithdrawalCount,
    pendingWithdrawalSum,

    totalWagered,
    totalWon,
    grossGamingRevenue,
    betCount,

    bonusGranted,
    cashbackPaid,
    affiliateCommissionPaid,

    netCash,
    operatingResult,

    avgDeposit: safeDiv(approvedDepositSum, approvedDepositCount),
    avgWithdrawal: safeDiv(approvedWithdrawalSum, approvedWithdrawalCount),
    avgRevenuePerActivePlayer: safeDiv(grossGamingRevenue, activePlayersCount),

    walletBalanceLive: n(walletAgg._sum.balance),
    walletLockedLive: n(walletAgg._sum.lockedBalance),
    bonusBalanceLive: n(walletAgg._sum.bonusBalance),
  };
}
