// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  schedule: z.string().max(80).optional().nullable(),
  drawsAt: z.string().datetime().optional().nullable(),
  digitsCount: z.coerce.number().int().min(1).max(10).optional(),
  ticketPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  prizePool: z.coerce.number().min(0).max(1_000_000_000).optional(),
  accent: z.enum(['yellow', 'blue', 'red', 'royal']).optional(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = {
      ...parsed.data,
      drawsAt: parsed.data.drawsAt === undefined ? undefined : parsed.data.drawsAt ? new Date(parsed.data.drawsAt) : null,
    };
    const draw = await db.lottoDraw.update({ where: { id: params.id }, data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'LOTTO_UPDATE', target: draw.id });
    return jsonOk({ draw });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');
    await db.lottoDraw.delete({ where: { id: params.id } });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'LOTTO_DELETE', target: params.id });
    return jsonOk({ deleted: true });
  });
}
