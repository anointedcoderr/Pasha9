// Built by Anointed Coder.
//
// PATCH  /api/admin/homepage-blocks/[id]/items/[itemId]   toggle isHot / isJackpot / set position
// DELETE /api/admin/homepage-blocks/[id]/items/[itemId]   remove from the block

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const patchSchema = z.object({
  isHot: z.boolean().optional(),
  isJackpot: z.boolean().optional(),
  position: z.number().int().min(0).max(9999).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const item = await db.homepageGameBlockItem.findUnique({ where: { id: params.itemId } });
    if (!item || item.blockId !== params.id) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const next = await db.homepageGameBlockItem.update({
      where: { id: item.id },
      data: {
        ...(parsed.data.isHot !== undefined ? { isHot: parsed.data.isHot } : {}),
        ...(parsed.data.isJackpot !== undefined ? { isJackpot: parsed.data.isJackpot } : {}),
        ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_BLOCK_ITEM_PATCH',
      target: next.id,
      meta: { blockId: params.id },
    });
    return jsonOk({ item: next });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const item = await db.homepageGameBlockItem.findUnique({ where: { id: params.itemId } });
    if (!item || item.blockId !== params.id) return jsonError(404, 'NOT_FOUND');
    await db.homepageGameBlockItem.delete({ where: { id: item.id } });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_BLOCK_ITEM_DELETE',
      target: item.id,
      meta: { blockId: params.id },
    });
    return jsonOk({ ok: true });
  });
}
