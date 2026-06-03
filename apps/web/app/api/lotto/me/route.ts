// Built by Anointed Coder.
//
// Logged-in user's lottery snapshot: tickets, winnings and the
// accumulated approved-deposit total that drives ticket accrual.
//
// M4 Phase F additions:
//   - rules + progress now read live values from loadLottoSettings()
//     so admin edits to lotto_ticket_rate_* take effect immediately.
//   - tickets carry `source` so /lotto/my-tickets can distinguish
//     deposit-accrued from admin-granted tickets.
//   - winnings carry `resultId`, `creditedAt`, `drawId` so
//     /lotto/my-winnings can show claim state and link back.
//   - summary adds `wonToday` and `wonLifetime` totals.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensureUser } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { loadLottoSettings } from '@/lib/lotto/settings';

export async function GET() {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;
    const settings = await loadLottoSettings();

    const [agg, wallet, tickets, winnings, lifetimeAgg, todayAgg] = await Promise.all([
      db.deposit.aggregate({ where: { userId, status: 'approved' }, _sum: { amount: true } }),
      db.wallet.findUnique({ where: { userId } }),
      db.lotteryTicket.findMany({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
        take: 100,
        include: { draw: { select: { id: true, name: true, drawsAt: true } } },
      }),
      db.lotteryWinning.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: { result: { select: { drawId: true, winningNumber: true, publishedAt: true } } },
      }),
      db.lotteryWinning.aggregate({ where: { userId }, _sum: { amount: true } }),
      db.lotteryWinning.aggregate({
        where: { userId, createdAt: { gte: startOfTodayUtc() } },
        _sum: { amount: true },
      }),
    ]);

    const totalApproved = Number(agg._sum.amount ?? 0);
    const earnedTickets = Math.floor(totalApproved / settings.ticketRateAmount) * settings.ticketRateCount;
    const remainder = totalApproved % settings.ticketRateAmount;
    const toNextBlock = settings.ticketRateAmount - remainder;

    const ticketCount = tickets.length;
    const wonCount = tickets.filter((t) => t.status === 'won').length;

    return jsonOk({
      rules: {
        ticketsPerBlock: settings.ticketRateCount,
        blockAmount: settings.ticketRateAmount,
        digits: 4,
        drawTimeLabel: 'Daily 19:30 BST',
        enabled: settings.enabled,
        claimMode: settings.claimMode,
      },
      progress: {
        totalApprovedDeposits: totalApproved,
        earnedTickets,
        toNextBlock,
        blockAmount: settings.ticketRateAmount,
        ticketsPerBlock: settings.ticketRateCount,
      },
      lottoBalance: Number(wallet?.lottoBalance ?? 0),
      summary: {
        ticketCount,
        wonCount,
        winningCount: winnings.length,
        wonLifetime: Number(lifetimeAgg._sum.amount ?? 0),
        wonToday: Number(todayAgg._sum.amount ?? 0),
      },
      tickets: tickets.map((t) => ({
        id: t.id,
        number: t.number,
        status: t.status,
        source: t.source,
        drawId: t.drawId,
        generatedAt: t.generatedAt,
        draw: t.draw ? { id: t.draw.id, name: t.draw.name, drawsAt: t.draw.drawsAt } : null,
      })),
      winnings: winnings.map((w) => ({
        id: w.id,
        ticketId: w.ticketId,
        ticketNumber: w.ticketNumber,
        prizeTier: w.prizeTier,
        amount: Number(w.amount),
        status: w.status,
        createdAt: w.createdAt,
        creditedAt: w.creditedAt,
        resultId: w.resultId,
        drawId: w.result.drawId,
        winningNumber: w.result.winningNumber,
        publishedAt: w.result.publishedAt,
      })),
    });
  });
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
