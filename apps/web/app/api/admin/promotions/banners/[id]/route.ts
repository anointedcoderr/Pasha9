// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  titleEn: z.string().trim().min(1).max(120).optional(),
  titleBn: z.string().trim().max(120).optional().nullable(),
  subtitleEn: z.string().trim().max(280).optional().nullable(),
  subtitleBn: z.string().trim().max(280).optional().nullable(),
  imageUrl: z.string().trim().max(600).optional().nullable(),
  ctaUrl: z.string().trim().max(600).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const existing = await db.promotionBanner.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const banner = await db.promotionBanner.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMOTION_BANNER_UPDATE',
      target: banner.id,
      meta: { changes: parsed.data },
    });
    return jsonOk({ banner });
  });
}
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.promotionBanner.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    await db.promotionBanner.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMOTION_BANNER_DELETE',
      target: params.id,
      meta: { titleEn: existing.titleEn },
    });
    return jsonOk({ ok: true });
  });
}
