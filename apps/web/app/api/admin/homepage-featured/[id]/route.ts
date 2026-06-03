// Built by Anointed Coder.
//
// PATCH  /api/admin/homepage-featured/[id]
// DELETE /api/admin/homepage-featured/[id]

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.homepageFeaturedGame.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const updated = await db.homepageFeaturedGame.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_FEATURED_PATCH',
      target: params.id,
      meta: { changes: parsed.data },
    });

    return jsonOk({ featured: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const existing = await db.homepageFeaturedGame.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    await db.homepageFeaturedGame.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_FEATURED_DELETE',
      target: params.id,
      meta: { source: existing.source, externalGameId: existing.externalGameId, nativeGameCode: existing.nativeGameCode },
    });

    return jsonOk({ ok: true });
  });
}
