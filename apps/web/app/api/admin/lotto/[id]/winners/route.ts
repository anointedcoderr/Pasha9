// Built by Anointed Coder.
//
// GET /api/admin/lotto/[id]/winners
//
// Lists every LotteryWinning row for a given LottoDraw, plus a
// per-tier aggregation (count + sum) and a claim breakdown
// (pending_credit / credited / cancelled). Powers the View
// Winners button on each draw card in /admin/lotto.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('lotto.write');

    const draw = await db.lottoDraw.findUnique({
      where: { id: params.id },
      include: { result: true },
    });
    if (!draw) return jsonError(404, 'DRAW_NOT_FOUND');
    if (!draw.result) {
      return jsonOk({
        draw: { id: draw.id, name: draw.name, drawsAt: draw.drawsAt, status: draw.status },
        result: null,
        winners: [],
        byTier: {},
        byStatus: {},
        total: 0,
        sumAmount: 0,
      });
    }

    const winners = await db.lotteryWinning.findMany({
      where: { resultId: draw.result.id },
      orderBy: [{ prizeTier: 'asc' }, { amount: 'desc' }],
      take: 500,
      include: {
        user: { select: { id: true, username: true, phone: true } },
      },
    });

    // Per-tier aggregation: { tierKey: { count, sumAmount } }.
    const byTier: Record<string, { count: number; sumAmount: number }> = {};
    for (const w of winners) {
      const tier = w.prizeTier;
      if (!byTier[tier]) byTier[tier] = { count: 0, sumAmount: 0 };
      byTier[tier].count += 1;
      byTier[tier].sumAmount += Number(w.amount);
    }
    // Per-status aggregation for the claimed/unclaimed view.
    const byStatus: Record<string, { count: number; sumAmount: number }> = {};
    for (const w of winners) {
      const s = w.status;
      if (!byStatus[s]) byStatus[s] = { count: 0, sumAmount: 0 };
      byStatus[s].count += 1;
      byStatus[s].sumAmount += Number(w.amount);
    }

    return jsonOk({
      draw: {
        id: draw.id,
        name: draw.name,
        drawsAt: draw.drawsAt,
        status: draw.status,
      },
      result: {
        id: draw.result.id,
        winningNumber: draw.result.winningNumber,
        publishedAt: draw.result.publishedAt,
        totalPaid: Number(draw.result.totalPaid),
        ticketBaseValue: Number(draw.result.ticketBaseValue),
      },
      winners: winners.map((w) => ({
        id: w.id,
        ticketNumber: w.ticketNumber,
        prizeTier: w.prizeTier,
        amount: Number(w.amount),
        status: w.status,
        createdAt: w.createdAt,
        creditedAt: w.creditedAt,
        user: w.user ? { id: w.user.id, username: w.user.username, phone: w.user.phone } : null,
      })),
      byTier,
      byStatus,
      total: winners.length,
      sumAmount: winners.reduce((acc, w) => acc + Number(w.amount), 0),
    });
  });
}
