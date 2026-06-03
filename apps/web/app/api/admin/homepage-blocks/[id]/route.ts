// Built by Anointed Coder.
//
// PATCH  /api/admin/homepage-blocks/[id]   edit block title/source/order/visibility
// DELETE /api/admin/homepage-blocks/[id]   remove a block (cascades items)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const SOURCE_TYPES = ['manual', 'category', 'brand', 'jackpot', 'featured'] as const;

const patchSchema = z.object({
  titleEn: z.string().trim().min(1).max(120).optional(),
  titleBn: z.string().trim().max(200).optional().nullable(),
  subtitleEn: z.string().trim().max(200).optional().nullable(),
  subtitleBn: z.string().trim().max(200).optional().nullable(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  category: z.string().trim().max(60).optional().nullable(),
  brandId: z.string().trim().max(60).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  position: z.coerce.number().int().min(0).max(9999).optional(),
  isVisible: z.boolean().optional(),
  layout: z.string().trim().max(20).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const block = await db.homepageGameBlock.findUnique({ where: { id: params.id } });
    if (!block) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const next = await db.homepageGameBlock.update({
      where: { id: block.id },
      data: {
        ...(parsed.data.titleEn !== undefined ? { titleEn: parsed.data.titleEn } : {}),
        ...(parsed.data.titleBn !== undefined ? { titleBn: parsed.data.titleBn } : {}),
        ...(parsed.data.subtitleEn !== undefined ? { subtitleEn: parsed.data.subtitleEn } : {}),
        ...(parsed.data.subtitleBn !== undefined ? { subtitleBn: parsed.data.subtitleBn } : {}),
        ...(parsed.data.sourceType !== undefined ? { sourceType: parsed.data.sourceType } : {}),
        ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
        ...(parsed.data.brandId !== undefined ? { brandId: parsed.data.brandId } : {}),
        ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
        ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
        ...(parsed.data.isVisible !== undefined ? { isVisible: parsed.data.isVisible } : {}),
        ...(parsed.data.layout !== undefined ? { layout: parsed.data.layout } : {}),
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_BLOCK_PATCH',
      target: next.id,
      meta: { key: next.key },
    });
    return jsonOk({ block: next });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const block = await db.homepageGameBlock.findUnique({ where: { id: params.id } });
    if (!block) return jsonError(404, 'NOT_FOUND');
    await db.homepageGameBlock.delete({ where: { id: block.id } });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_BLOCK_DELETE',
      target: block.id,
      meta: { key: block.key },
    });
    return jsonOk({ ok: true });
  });
}
