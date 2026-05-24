// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
  nameEn: z.string().trim().min(1).max(80).optional(),
  nameBn: z.string().trim().min(1).max(80).optional(),
  iconKey: z.string().trim().min(1).max(40).optional(),
  iconImageUrl: z.string().trim().max(500).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('categories.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const category = await db.gameCategory.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CATEGORY_UPDATE',
      target: category.id,
    });
    return jsonOk({ category });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('categories.write');
    await db.gameCategory.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CATEGORY_DELETE',
      target: params.id,
    });
    return jsonOk({ deleted: true });
  });
}
