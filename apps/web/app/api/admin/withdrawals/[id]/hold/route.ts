// Built by Anointed Coder.
//
// Admin marks a pending withdrawal as on hold (and back). Useful when
// support needs to investigate before approving or rejecting. The row
// stays at status='pending' so it does not leave the queue; only the
// processingState column flips.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  hold: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('withdrawals.review');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const w = await db.withdrawal.findUnique({ where: { id: params.id } });
    if (!w) return jsonError(404, 'NOT_FOUND');
    if (w.status !== 'pending') {
      return jsonError(409, 'NOT_PENDING', 'Hold / release only applies to pending withdrawals.');
    }

    const nextState = parsed.data.hold ? 'on_hold' : null;
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.withdrawal.update({
        where: { id: w.id },
        data: { processingState: nextState },
      });
      await tx.withdrawalEvent.create({
        data: {
          withdrawalId: w.id,
          kind: parsed.data.hold ? 'held' : 'released',
          actorId: session.sub,
          actorRole: session.role,
          note: parsed.data.note || (parsed.data.hold ? 'Held by admin pending investigation.' : 'Released back to the queue.'),
        },
      });
      return u;
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: parsed.data.hold ? 'WITHDRAWAL_HOLD' : 'WITHDRAWAL_RELEASE',
      target: w.id,
    });

    return jsonOk({ withdrawal: updated });
  });
}
