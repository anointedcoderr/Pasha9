// Built by Anointed Coder.
//
// GET /api/admin/lotto/tickets
//
// Operator-facing paginated browse of every LotteryTicket row in
// the system. Filters by drawId, userId, status, ticket number
// substring, and date range. Used by the View Tickets tab in
// /admin/lotto. Hard cap of 500 rows per page so the admin shell
// never has to download an unbounded list.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const querySchema = z.object({
  drawId: z.string().min(1).max(40).optional(),
  userId: z.string().min(1).max(40).optional(),
  status: z.enum(['issued', 'won', 'lost', 'void']).optional(),
  number: z.string().min(1).max(8).optional(),
  source: z.string().min(1).max(40).optional(),
  take: z.coerce.number().int().min(1).max(500).default(50),
  skip: z.coerce.number().int().min(0).max(100_000).default(0),
});

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('lotto.write');

    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const filters: Record<string, unknown> = {};
    if (parsed.data.drawId) filters.drawId = parsed.data.drawId;
    if (parsed.data.userId) filters.userId = parsed.data.userId;
    if (parsed.data.status) filters.status = parsed.data.status;
    if (parsed.data.source) filters.source = parsed.data.source;
    if (parsed.data.number) filters.number = { contains: parsed.data.number };

    const [total, rows] = await Promise.all([
      db.lotteryTicket.count({ where: filters }),
      db.lotteryTicket.findMany({
        where: filters,
        orderBy: { generatedAt: 'desc' },
        take: parsed.data.take,
        skip: parsed.data.skip,
        include: {
          draw: { select: { id: true, name: true, drawsAt: true } },
          user: { select: { id: true, username: true, phone: true } },
        },
      }),
    ]);

    return jsonOk({
      total,
      take: parsed.data.take,
      skip: parsed.data.skip,
      tickets: rows.map((t) => ({
        id: t.id,
        number: t.number,
        status: t.status,
        source: t.source,
        generatedAt: t.generatedAt,
        draw: t.draw ? { id: t.draw.id, name: t.draw.name, drawsAt: t.draw.drawsAt } : null,
        user: t.user ? { id: t.user.id, username: t.user.username, phone: t.user.phone } : null,
      })),
    });
  });
}
