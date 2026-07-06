// Built by Anointed Coder.
//
// Admin single-tournament operations.
//   PATCH  /api/admin/tournaments/[id]   edit (only while draft)     (bonuses.write)
//   POST   /api/admin/tournaments/[id]   action: preview|void|settle (bonuses.write)
//   DELETE /api/admin/tournaments/[id]   delete a draft              (bonuses.write)
//   GET    /api/admin/tournaments/[id]   detail + standings + payouts (bonuses.read)
//
// preview = dryRun settlement: computes final standings + intended prizes
//           and credits NOTHING (safe admin preview).
// void    = terminal; a draft/active/ended tournament that has not paid
//           can be voided and will never pay.
// settle  = force-settle now: ends the tournament (if still live) then
//           runs the idempotent payout. Safe to press twice - already-paid
//           ranks are no-ops via the unique idempotencyKey.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { computeStandings, settleTournament, parsePrizes } from '@/lib/tournaments/engine';

const prizeSchema = z.object({
  rank: z.coerce.number().int().min(1).max(1000),
  amount: z.coerce.number().positive().max(10_000_000),
});

function prizesAreContiguous(prizes: Array<{ rank: number; amount: number }>): boolean {
  const ranks = prizes.map((p) => p.rank);
  const unique = new Set(ranks);
  if (unique.size !== ranks.length) return false;
  if (Math.max(...ranks) !== ranks.length) return false;
  for (let r = 1; r <= ranks.length; r += 1) if (!unique.has(r)) return false;
  return true;
}

const patchSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(120).optional(),
    nameBn: z.string().trim().max(120).optional().nullable(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    turnoverX: z.coerce.number().min(0).max(100).optional(),
    minTurnover: z.coerce.number().min(0).max(100_000_000).optional(),
    prizes: z.array(prizeSchema).min(1).max(1000).optional(),
  })
  .refine((d) => !d.prizes || prizesAreContiguous(d.prizes), {
    message: 'Prize ranks must be 1..N contiguous and unique.',
    path: ['prizes'],
  });

const actionSchema = z.object({ action: z.enum(['preview', 'void', 'settle']) });

function serialize(t: NonNullable<Awaited<ReturnType<typeof db.tournament.findUnique>>>) {
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
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const t = await db.tournament.findUnique({ where: { id: params.id } });
    if (!t) return jsonError(404, 'NOT_FOUND', 'Tournament not found.');

    const standings = await computeStandings(t);
    const payouts = await db.tournamentPayout.findMany({
      where: { tournamentId: t.id },
      orderBy: { rank: 'asc' },
    });

    return jsonOk({
      tournament: serialize(t),
      standings: standings.rows.slice(0, 200),
      participants: standings.participants,
      payouts: payouts.map((p) => ({
        id: p.id,
        userId: p.userId,
        rank: p.rank,
        score: Number(p.score),
        amount: Number(p.amount),
        status: p.status,
        walletTxId: p.walletTxId,
        userBonusId: p.userBonusId,
        createdAt: p.createdAt,
      })),
    });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const existing = await db.tournament.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND', 'Tournament not found.');
    // Only a draft may be edited; once live/ended/paid/void the window and
    // prize table are frozen.
    if (existing.status !== 'draft') {
      return jsonError(409, 'NOT_EDITABLE', `A ${existing.status} tournament cannot be edited.`);
    }

    const nextStarts = data.startsAt ? new Date(data.startsAt) : existing.startsAt;
    const nextEnds = data.endsAt ? new Date(data.endsAt) : existing.endsAt;
    if (nextEnds.getTime() <= nextStarts.getTime()) {
      return jsonError(400, 'VALIDATION', 'endsAt must be after startsAt.');
    }

    const update: Prisma.TournamentUpdateInput = {};
    if (data.nameEn !== undefined) update.nameEn = data.nameEn;
    if (data.nameBn !== undefined) update.nameBn = data.nameBn ?? null;
    if (data.startsAt !== undefined) update.startsAt = nextStarts;
    if (data.endsAt !== undefined) update.endsAt = nextEnds;
    if (data.turnoverX !== undefined) update.turnoverX = new Prisma.Decimal(data.turnoverX);
    if (data.minTurnover !== undefined) update.minTurnover = new Prisma.Decimal(data.minTurnover);
    if (data.prizes !== undefined) {
      const prizes = [...data.prizes].sort((a, b) => a.rank - b.rank).map((p) => ({ rank: p.rank, amount: p.amount }));
      update.prizes = prizes as unknown as Prisma.InputJsonValue;
    }

    const saved = await db.tournament.update({ where: { id: params.id }, data: update });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TOURNAMENT_UPDATE',
      target: saved.id,
      detail: saved.nameEn,
    });

    return jsonOk({ tournament: serialize(saved) });
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const { action } = parsed.data;

    const existing = await db.tournament.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND', 'Tournament not found.');

    // ----- Preview: dryRun settlement, zero writes. -----
    if (action === 'preview') {
      const [preview, standings] = await Promise.all([
        settleTournament(params.id, { dryRun: true }),
        computeStandings(existing),
      ]);
      return jsonOk({ preview, standings: standings.rows.slice(0, 200), participants: standings.participants });
    }

    // ----- Void: terminal, never pays. -----
    if (action === 'void') {
      if (existing.status === 'paid') return jsonError(409, 'ALREADY_PAID', 'A paid tournament cannot be voided.');
      if (existing.status === 'void') return jsonOk({ tournament: serialize(existing), voided: false });
      // Guarded so a concurrent settle cannot pay a tournament we are voiding.
      const res = await db.tournament.updateMany({
        where: { id: params.id, status: { in: ['draft', 'active', 'ended'] } },
        data: { status: 'void' },
      });
      if (res.count !== 1) {
        const fresh = await db.tournament.findUnique({ where: { id: params.id } });
        return jsonError(409, 'VOID_CONFLICT', `Tournament is ${fresh?.status ?? 'unknown'} and cannot be voided.`);
      }
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'TOURNAMENT_VOID',
        target: params.id,
        detail: existing.nameEn,
      });
      const fresh = await db.tournament.findUnique({ where: { id: params.id } });
      return jsonOk({ tournament: fresh ? serialize(fresh) : null, voided: true });
    }

    // ----- Settle now: force-end (if live) then idempotent payout. -----
    if (existing.status === 'paid') {
      // Idempotent: re-running settle on a paid tournament only finishes
      // any unpaid ranks; safe to press again.
    } else if (existing.status === 'void') {
      return jsonError(409, 'VOIDED', 'A voided tournament never pays.');
    } else if (existing.status === 'draft' || existing.status === 'active') {
      // Force the window closed so settlement can claim ended -> paid.
      await db.tournament.updateMany({
        where: { id: params.id, status: { in: ['draft', 'active'] } },
        data: { status: 'ended' },
      });
    }

    const result = await settleTournament(params.id, { actorId: session.sub, actorRole: session.role });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TOURNAMENT_SETTLE',
      target: params.id,
      detail: existing.nameEn,
      meta: { paidCount: result.paidCount, totalPaid: result.totalPaid, claimed: result.claimed },
    });

    return jsonOk({ settlement: result });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.tournament.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND', 'Tournament not found.');
    // Only a draft can be deleted; anything that went live keeps its audit
    // trail. Void an unwanted live tournament instead.
    if (existing.status !== 'draft') {
      return jsonError(409, 'NOT_DELETABLE', `A ${existing.status} tournament cannot be deleted. Void it instead.`);
    }
    await db.tournament.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TOURNAMENT_DELETE',
      target: params.id,
      detail: existing.nameEn,
    });
    return jsonOk({ deleted: true });
  });
}
