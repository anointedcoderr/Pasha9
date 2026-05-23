// Built by Anointed Coder.
//
// Logged-in user's lottery snapshot: tickets, winnings and the
// accumulated approved-deposit total that drives ticket accrual.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensureUser } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { LOTTERY_RULES } from '@/lib/lotto/tickets';

export async function GET() {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;

    const [agg, wallet, tickets, winnings] = await Promise.all([
      db.deposit.aggregate({ where: { userId, status: 'approved' }, _sum: { amount: true } }),
      db.wallet.findUnique({ where: { userId } }),
      db.lotteryTicket.findMany({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
        take: 50,
        include: {
          draw: { select: { id: true, name: true, drawsAt: true } },
        },
      }),
      db.lotteryWinning.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { result: { select: { winningNumber: true, publishedAt: true } } },
      }),
    ]);

    const totalApproved = Number(agg._sum.amount ?? 0);
    const earnedTickets = Math.floor(totalApproved / LOTTERY_RULES.blockAmount) * LOTTERY_RULES.ticketsPerBlock;
    const remainder = totalApproved % LOTTERY_RULES.blockAmount;
    const toNextBlock = LOTTERY_RULES.blockAmount - remainder;

    const ticketCount = tickets.length;
    const wonCount = tickets.filter((t) => t.status === 'won').length;

    return jsonOk({
      rules: LOTTERY_RULES,
      progress: {
        totalApprovedDeposits: totalApproved,
        earnedTickets,
        toNextBlock,
        blockAmount: LOTTERY_RULES.blockAmount,
        ticketsPerBlock: LOTTERY_RULES.ticketsPerBlock,
      },
      lottoBalance: Number(wallet?.lottoBalance ?? 0),
      summary: { ticketCount, wonCount, winningCount: winnings.length },
      tickets: tickets.map((t) => ({
        id: t.id,
        number: t.number,
        status: t.status,
        generatedAt: t.generatedAt,
        draw: t.draw ? { id: t.draw.id, name: t.draw.name, drawsAt: t.draw.drawsAt } : null,
      })),
      winnings: winnings.map((w) => ({
        id: w.id,
        ticketNumber: w.ticketNumber,
        prizeTier: w.prizeTier,
        amount: Number(w.amount),
        status: w.status,
        createdAt: w.createdAt,
        winningNumber: w.result.winningNumber,
        publishedAt: w.result.publishedAt,
      })),
    });
  });
}
