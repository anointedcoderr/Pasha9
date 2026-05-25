// Built by Anointed Coder.
//
// Admin manually applies turnover to a single grant. Useful before
// the live betting engine is wired so support staff can credit
// turnover earned in offline channels (or correct a stuck grant).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { addTurnover } from '@/lib/bonuses/engine';

const schema = z.object({
  amount: z.coerce.number().min(1).max(10_000_000),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const grant = await db.userBonus.findUnique({ where: { id: params.id } });
    if (!grant) return jsonError(404, 'GRANT_NOT_FOUND');
    if (grant.status !== 'active') return jsonError(400, 'GRANT_NOT_ACTIVE');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    // Engine distributes across the user's grants in FIFO order. To
    // target a single grant when there are multiple actives, the
    // simpler path here is to apply to this grant directly inside a
    // mini transaction. Reuses the same release helper through the
    // engine path by writing the event + updating the grant ourselves
    // and falling back to the engine when there's only one active.

    const others = await db.userBonus.count({
      where: { userId: grant.userId, status: 'active', id: { not: grant.id } },
    });

    if (others === 0) {
      const r = await addTurnover({
        userId: grant.userId,
        amount: parsed.data.amount,
        kind: 'admin_adjust',
        reference: grant.id,
        meta: { note: parsed.data.note ?? null } as Prisma.JsonObject,
      });
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'BONUS_TURNOVER_ADJUST',
        target: grant.id,
        meta: { amount: parsed.data.amount, applied: r.applied },
      });
      return jsonOk({ ok: true, applied: r.applied });
    }

    // Multiple active grants for this user: apply only to the picked
    // one by editing the row + writing an event manually.
    const applyAmount = new Prisma.Decimal(parsed.data.amount);
    const updated = await db.$transaction(async (tx) => {
      const fresh = await tx.userBonus.findUnique({ where: { id: grant.id } });
      if (!fresh || fresh.status !== 'active') throw new Error('GRANT_RACE');
      const progressAfter = new Prisma.Decimal(fresh.turnoverProgress).add(applyAmount);
      const required = new Prisma.Decimal(fresh.turnoverRequired);
      const release = progressAfter.gte(required);

      await tx.userBonus.update({
        where: { id: fresh.id },
        data: {
          turnoverProgress: progressAfter,
          ...(release ? { status: 'completed', releasedAt: new Date() } : {}),
        },
      });
      await tx.turnoverEvent.create({
        data: {
          userId: fresh.userId,
          bonusGrantId: fresh.id,
          amount: applyAmount,
          kind: 'admin_adjust',
          reference: fresh.id,
          meta: { note: parsed.data.note ?? null } as Prisma.JsonObject,
        },
      });
      if (release) {
        await tx.wallet.update({
          where: { userId: fresh.userId },
          data: {
            lockedBalance: { decrement: new Prisma.Decimal(fresh.amount) },
            balance: { increment: new Prisma.Decimal(fresh.amount) },
          },
        });
      }
      return { release, progressAfter: Number(progressAfter), required: Number(required) };
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_TURNOVER_ADJUST',
      target: grant.id,
      meta: { amount: parsed.data.amount, ...updated },
    });

    return jsonOk({ ok: true, ...updated });
  });
}
