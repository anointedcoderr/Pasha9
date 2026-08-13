// Built by Anointed Coder.
//
// GET  /api/admin/users/[id]/turnover   current requirement + adjustment history
// POST /api/admin/users/[id]/turnover   { mode, amount, reason }
//
// Operator control over a player's outstanding wagering requirement, from
// User Management. mode is one of:
//   increase  add to the remaining requirement
//   decrease  reduce it (never below what the player has already wagered)
//   set       make the remaining requirement exactly this amount
//
// Every adjustment records Turnover Before -> Change -> Turnover After, the
// responsible staff member, the time and a required reason. This is money-
// adjacent: lowering a requirement lets a player withdraw sooner, so it needs
// the same accountability as a balance change.
//
// The requirement itself lives on the player's ACTIVE UserBonus grants
// (turnoverRequired against turnoverProgress). There is no single field to
// edit, so an adjustment is applied across those grants; the arithmetic is
// done on the remaining requirement, which is what an operator actually
// means when they say "reduce his turnover by 500".

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { computeDepositTurnover } from '@/lib/turnover/deposit-gate';

const schema = z.object({
  mode: z.enum(['increase', 'decrease', 'set']),
  amount: z.coerce.number().min(0).max(100_000_000),
  reason: z.string().trim().min(3, 'A reason is required.').max(500),
});

const ZERO = new Prisma.Decimal(0);

/** Remaining requirement across a player's active grants. */
function remainingFor(grants: Array<{ turnoverRequired: Prisma.Decimal; turnoverProgress: Prisma.Decimal }>): Prisma.Decimal {
  return grants.reduce((sum, g) => {
    const left = new Prisma.Decimal(g.turnoverRequired).sub(new Prisma.Decimal(g.turnoverProgress));
    return sum.add(left.gt(ZERO) ? left : ZERO);
  }, ZERO);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');

    const [grants, history, gate] = await Promise.all([
      db.userBonus.findMany({
        where: { userId: params.id, status: 'active' },
        select: { id: true, amount: true, sourceType: true, turnoverRequired: true, turnoverProgress: true },
        orderBy: { claimedAt: 'asc' },
      }),
      db.turnoverEvent.findMany({
        where: { userId: params.id, kind: { in: ['admin_set', 'admin_increase', 'admin_decrease', 'admin_adjust'] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      // THE figure the player is actually held to. Deposit and betting pass
      // turnover are not bonus grants, so counting only UserBonus rows showed
      // an operator 0 while the player was blocked by thousands. Both sides
      // now read this one function, so they cannot disagree again.
      computeDepositTurnover(params.id),
    ]);

    return jsonOk({
      // What the player sees on the withdrawal page, to the decimal.
      remaining: Number(gate.remainingTurnover),
      required: Number(gate.requiredTurnover),
      completed: Number(gate.completedTurnover),
      isMet: gate.isMet,
      // Where that total comes from, so an operator can see which part is
      // outstanding instead of guessing.
      breakdown: {
        deposit: {
          required: Number(gate.depositRequired),
          completed: Number(gate.depositCompleted),
          remaining: Number(gate.depositRemaining),
        },
        bettingPass: {
          required: Number(gate.bettingPassRequired),
          completed: Number(gate.bettingPassCompleted),
          remaining: Number(gate.bettingPassRemaining),
        },
        referral: {
          required: Number(gate.referralRequired),
          completed: Number(gate.referralCompleted),
          remaining: Number(gate.referralRemaining),
        },
        spin: {
          required: Number(gate.spinRequired),
          completed: Number(gate.spinCompleted),
          remaining: Number(gate.spinRemaining),
        },
        registration: {
          required: Number(gate.registrationRequired),
          completed: Number(gate.registrationCompleted),
          remaining: Number(gate.registrationRemaining),
        },
      },
      // Bonus-grant requirement only. Kept separate and clearly named because
      // the adjustment controls below still operate on these grants, so an
      // operator needs to know how much of the total they can actually move.
      grantsRemaining: Number(remainingFor(grants)),
      grants: grants.map((g) => ({
        id: g.id,
        sourceType: g.sourceType,
        amount: Number(g.amount),
        required: Number(g.turnoverRequired),
        progress: Number(g.turnoverProgress),
        remaining: Math.max(0, Number(g.turnoverRequired) - Number(g.turnoverProgress)),
      })),
      history: history.map((h) => ({
        at: h.createdAt,
        kind: h.kind,
        change: Number(h.amount),
        before: h.turnoverBefore == null ? null : Number(h.turnoverBefore),
        after: h.turnoverAfter == null ? null : Number(h.turnoverAfter),
        reason: h.reason,
        actorId: h.actorId,
        actorRole: h.actorRole,
      })),
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.balance.adjust');

    // This route shares its permission code with the balance route, which
    // means a staff member granted Balance Management could reach this
    // endpoint too, without ever having a dedicated turnover permission of
    // their own. That is exactly the loophole the client flagged: staff must
    // have no way to add, reduce, clear, or zero-out a turnover requirement
    // manually, by any path. So the role check sits on top of the
    // permission check rather than replacing it, and is not skippable by
    // granting a different permission - reaching this line at all already
    // proves the caller is not a super_admin.
    if (session.role !== 'super_admin') {
      return jsonError(403, 'SUPER_ADMIN_ONLY', 'Only a Super Admin can manually adjust a player\'s turnover requirement.');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const user = await db.user.findUnique({ where: { id: params.id }, select: { id: true, username: true } });
    if (!user) return jsonError(404, 'NOT_FOUND', 'User not found.');

    const { mode, amount, reason } = parsed.data;
    const requested = new Prisma.Decimal(amount);

    const result = await db.$transaction(async (tx) => {
      const grants = await tx.userBonus.findMany({
        where: { userId: user.id, status: 'active' },
        select: { id: true, turnoverRequired: true, turnoverProgress: true },
        orderBy: { claimedAt: 'asc' },
      });

      const before = remainingFor(grants);
      if (grants.length === 0) {
        // Nothing to adjust. Reported rather than silently succeeding, so an
        // operator does not believe they lowered a requirement that never
        // existed.
        return { noGrants: true as const, before };
      }

      const target = mode === 'set'
        ? requested
        : mode === 'increase'
          ? before.add(requested)
          : before.sub(requested);
      // Never below zero: a negative requirement would read as "already met"
      // in one place and as a negative number in another.
      const clamped = target.lt(ZERO) ? ZERO : target;
      const delta = clamped.sub(before);

      if (delta.isZero()) return { unchanged: true as const, before };

      if (delta.isPositive()) {
        // The whole increase goes onto the oldest grant. Splitting it across
        // grants would be an arbitrary choice that is harder to explain to a
        // player and harder to undo.
        const g = grants[0];
        await tx.userBonus.update({
          where: { id: g.id },
          data: { turnoverRequired: new Prisma.Decimal(g.turnoverRequired).add(delta) },
        });
      } else {
        // Reducing: take from each grant only as much as it still owes, so a
        // grant is never driven below its own progress. That would mark it
        // complete out of order and release its locked money early - a real
        // money leak, not a display problem.
        let toRemove = delta.abs();
        for (const g of grants) {
          if (toRemove.lte(ZERO)) break;
          const req = new Prisma.Decimal(g.turnoverRequired);
          const owes = req.sub(new Prisma.Decimal(g.turnoverProgress));
          if (owes.lte(ZERO)) continue;
          const take = owes.gt(toRemove) ? toRemove : owes;
          await tx.userBonus.update({
            where: { id: g.id },
            data: { turnoverRequired: req.sub(take) },
          });
          toRemove = toRemove.sub(take);
        }
      }

      await tx.turnoverEvent.create({
        data: {
          userId: user.id,
          amount: delta,
          kind: mode === 'set' ? 'admin_set' : mode === 'increase' ? 'admin_increase' : 'admin_decrease',
          turnoverBefore: before,
          turnoverAfter: clamped,
          actorId: session.sub,
          actorRole: session.role,
          reason,
          meta: { mode, requested: requested.toString() } as Prisma.JsonObject,
        },
      });

      return { before, after: clamped, delta };
    });

    if ('noGrants' in result) {
      return jsonError(409, 'NO_ACTIVE_TURNOVER', 'This player has no active wagering requirement to adjust.');
    }
    if ('unchanged' in result) {
      return jsonOk({ ok: true, unchanged: true, remaining: Number(result.before) });
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TURNOVER_ADJUST',
      target: user.id,
      detail: reason.slice(0, 240),
      meta: {
        username: user.username,
        mode,
        requested: amount,
        turnoverBefore: Number(result.before),
        turnoverAfter: Number(result.after),
        change: Number(result.delta),
      },
    });

    return jsonOk({
      ok: true,
      turnover: {
        before: Number(result.before),
        after: Number(result.after),
        change: Number(result.delta),
      },
    });
  });
}
