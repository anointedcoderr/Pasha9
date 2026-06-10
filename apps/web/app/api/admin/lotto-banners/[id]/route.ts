// Built by Anointed Coder.
//
// PATCH  /api/admin/lotto-banners/[id]   partial update
// DELETE /api/admin/lotto-banners/[id]   destroy

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  kind: z.enum(['image', 'video']).optional(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  videoUrl: z.string().trim().max(500).optional().nullable(),
  posterUrl: z.string().trim().max(500).optional().nullable(),
  titleEn: z.string().trim().max(160).optional().nullable(),
  titleBn: z.string().trim().max(160).optional().nullable(),
  ctaUrl: z.string().trim().max(500).optional().nullable(),
  autoplay: z.boolean().optional(),
  muted: z.boolean().optional(),
  loop: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.lottoBanner.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const updated = await db.lottoBanner.update({ where: { id: params.id }, data: parsed.data });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'LOTTO_BANNER_PATCH',
      target: params.id,
      meta: { changes: parsed.data },
    });

    return jsonOk({ banner: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const existing = await db.lottoBanner.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    await db.lottoBanner.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'LOTTO_BANNER_DELETE',
      target: params.id,
      detail: existing.titleEn ?? existing.kind,
    });

    return jsonOk({ ok: true });
  });
}
