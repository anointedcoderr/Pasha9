// Built by Anointed Coder.
//
// Real KPI snapshot for the /admin landing page. Aggregates straight
// from the DB so every number is grounded in real rows.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensureStaff } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  return withAuth(async () => {
    await ensureStaff();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

    const [
      totalUsers,
      activeUsersLast7,
      newUsersToday,
      depositsTotal,
      depositsToday,
      pendingDepositsCount,
      pendingDepositsAmount,
      withdrawalsTotal,
      pendingWithdrawalsCount,
      pendingWithdrawalsAmount,
      ticketsCount,
      winningsCount,
      lottoBalanceSum,
      walletBalanceSum,
      pendingDepositList,
      pendingWithdrawalList,
      recentActivity,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
      db.user.count({ where: { createdAt: { gte: todayStart } } }),
      db.deposit.aggregate({ where: { status: 'approved' }, _sum: { amount: true } }),
      db.deposit.aggregate({ where: { status: 'approved', reviewedAt: { gte: todayStart } }, _sum: { amount: true } }),
      db.deposit.count({ where: { status: 'pending' } }),
      db.deposit.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
      db.withdrawal.aggregate({ where: { status: 'approved' }, _sum: { amount: true } }),
      db.withdrawal.count({ where: { status: 'pending' } }),
      db.withdrawal.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
      db.lotteryTicket.count(),
      db.lotteryWinning.count(),
      db.wallet.aggregate({ _sum: { lottoBalance: true } }),
      db.wallet.aggregate({ _sum: { balance: true } }),
      db.deposit.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { username: true } } },
      }),
      db.withdrawal.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { username: true } } },
      }),
      db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);

    return jsonOk({
      timestamp: now.toISOString(),
      kpis: {
        totalUsers,
        activeUsersLast7,
        newUsersToday,
        approvedDepositsTotal: Number(depositsTotal._sum.amount ?? 0),
        approvedDepositsToday: Number(depositsToday._sum.amount ?? 0),
        pendingDepositsCount,
        pendingDepositsAmount: Number(pendingDepositsAmount._sum.amount ?? 0),
        approvedWithdrawalsTotal: Number(withdrawalsTotal._sum.amount ?? 0),
        pendingWithdrawalsCount,
        pendingWithdrawalsAmount: Number(pendingWithdrawalsAmount._sum.amount ?? 0),
        platformBalance: Number(walletBalanceSum._sum.balance ?? 0),
        lottoBalanceOutstanding: Number(lottoBalanceSum._sum.lottoBalance ?? 0),
        lotteryTickets: ticketsCount,
        lotteryWinnings: winningsCount,
      },
      windows: { sevenDaysAgo: sevenDaysAgo.toISOString(), todayStart: todayStart.toISOString(), oneDayMs: ONE_DAY_MS },
      pending: {
        deposits: pendingDepositList.map((d) => ({
          id: d.id,
          username: d.user.username,
          amount: Number(d.amount),
          method: d.method,
          createdAt: d.createdAt,
        })),
        withdrawals: pendingWithdrawalList.map((w) => ({
          id: w.id,
          username: w.user.username,
          amount: Number(w.amount),
          method: w.method,
          createdAt: w.createdAt,
        })),
      },
      activity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        actorRole: a.actorRole,
        target: a.target,
        detail: a.detail,
        createdAt: a.createdAt,
      })),
    });
  });
}
