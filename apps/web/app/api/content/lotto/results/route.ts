// Built by Anointed Coder.
//
// Public list of recently published lottery results. Returns the
// winning number, the draw name, published timestamp and aggregate
// payout stats so the public /lotto page can render a "latest
// results" panel without authenticating.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 30;

export async function GET() {
  const rows = await db.lotteryDrawResult.findMany({
    orderBy: { publishedAt: 'desc' },
    take: 10,
    include: { draw: { select: { id: true, name: true, drawsAt: true } } },
  });
  return jsonOk({
    results: rows.map((r) => ({
      id: r.id,
      drawId: r.drawId,
      drawName: r.draw.name,
      drawsAt: r.draw.drawsAt,
      winningNumber: r.winningNumber,
      publishedAt: r.publishedAt,
      totalWinners: r.totalWinners,
      totalPaid: Number(r.totalPaid),
      ticketBaseValue: Number(r.ticketBaseValue),
      prize1xMult: Number(r.prize1xMult),
    })),
  });
}
