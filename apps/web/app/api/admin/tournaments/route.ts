// Built by Anointed Coder.
//
// Admin CRUD for WinGo tournaments.
//   GET  /api/admin/tournaments   list with status + payout summary (bonuses.read)
//   POST /api/admin/tournaments   create a draft tournament          (bonuses.write)
//
// A created tournament starts as 'draft'. It auto-activates when its
// startsAt window opens (the cron/lazy tick promotes draft -> active) and
// auto-settles when it ends, so no manual publish step is needed. Ships
// with no active tournament by default.
//
// Prize table validation (zod + a refinement): ranks must be 1..N
// contiguous and unique, every amount > 0, and endsAt > startsAt.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { parsePrizes } from '@/lib/tournaments/engine';

const prizeSchema = z.object({
  rank: z.coerce.number().int().min(1).max(1000),
  amount: z.coerce.number().positive().max(10_000_000),
});

const createSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(120),
    nameBn: z.string().trim().max(120).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    turnoverX: z.coerce.number().min(0).max(100).default(1),
    minTurnover: z.coerce.number().min(0).max(100_000_000).default(0),
    prizes: z.array(prizeSchema).min(1).max(1000),
  })
  .refine((d) => new Date(d.endsAt).getTime() > new Date(d.startsAt).getTime(), {
    message: 'endsAt must be after startsAt.',
    path: ['endsAt'],
  })
  .refine((d) => prizesAreContiguous(d.prizes), {
    message: 'Prize ranks must be 1..N contiguous and unique.',
    path: ['prizes'],
  });

// Ranks must be exactly the set {1, 2, ..., N} with no gaps or duplicates.
function prizesAreContiguous(prizes: Array<{ rank: number; amount: number }>): boolean {
  const ranks = prizes.map((p) => p.rank);
  const unique = new Set(ranks);
  if (unique.size !== ranks.length) return false;
  const max = Math.max(...ranks);
  if (max !== ranks.length) return false;
  for (let r = 1; r <= ranks.length; r += 1) {
    if (!unique.has(r)) return false;
  }
  return true;
}

function serialize(
  t: Awaited<ReturnType<typeof db.tournament.findMany>>[number] & { _count?: { payouts: number } },
) {
  return {
    id: t.id,
    nameEn: t.nameEn,
    nameBn: t.nameBn,
    status: t.status,
    scope: t.scope,
    rankMetric: t.rankMetric,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    turnoverX: Number(t.turnoverX),
    minTurnover: Number(t.minTurnover),
    prizes: parsePrizes(t.prizes),
    settledAt: t.settledAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    payoutCount: t._count?.payouts ?? 0,
  };
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const rows = await db.tournament.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
      include: { _count: { select: { payouts: true } } },
    });
    return jsonOk({ tournaments: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    // Normalise prizes into ascending-rank order for storage.
    const prizes = [...data.prizes].sort((a, b) => a.rank - b.rank).map((p) => ({ rank: p.rank, amount: p.amount }));

    const created = await db.tournament.create({
      data: {
        nameEn: data.nameEn,
        nameBn: data.nameBn ?? null,
        status: 'draft',
        scope: 'wingo',
        rankMetric: 'turnover',
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        turnoverX: new Prisma.Decimal(data.turnoverX),
        minTurnover: new Prisma.Decimal(data.minTurnover),
        prizes: prizes as unknown as Prisma.InputJsonValue,
        createdById: session.sub,
      },
      include: { _count: { select: { payouts: true } } },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TOURNAMENT_CREATE',
      target: created.id,
      detail: created.nameEn,
      meta: { prizeSlots: prizes.length, turnoverX: data.turnoverX, minTurnover: data.minTurnover },
    });

    return jsonOk({ tournament: serialize(created) }, 201);
  });
}
