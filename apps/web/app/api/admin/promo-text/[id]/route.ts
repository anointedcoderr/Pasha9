// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  message: z.string().min(1).max(280).optional(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('promo.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const item = await db.promoText.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'PROMO_UPDATE', target: item.id });
    return jsonOk({ item });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('promo.write');
    await db.promoText.delete({ where: { id: params.id } });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'PROMO_DELETE', target: params.id });
    return jsonOk({ deleted: true });
  });
}
