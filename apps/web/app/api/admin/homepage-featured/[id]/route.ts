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
  // Operator-uploaded thumbnail override. Empty string or null clears
  // the override and restores the provider catalogue thumbnail on the
  // public homepage. Non-empty values must match the existing upload
  // URL convention.
  customImageUrl: z.string().trim().max(500).nullable().optional(),
  showProviderLabel: z.boolean().optional(),
  showGameName: z.boolean().optional(),
  showHotBadge: z.boolean().optional(),
  showPlayButton: z.boolean().optional(),
  imageOnlyMode: z.boolean().optional(),
  imageFitMode: z.enum(['cover', 'contain']).optional(),
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

    const { customImageUrl, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (customImageUrl !== undefined) {
      const trimmed = customImageUrl?.trim() ?? '';
      data.customImageUrl = trimmed ? trimmed : null;
    }

    const updated = await db.homepageFeaturedGame.update({
      where: { id: params.id },
      data,
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

    // Remove the row and renormalize positions to 10, 20, 30, ... so
    // the curated list has no gaps and no duplicate positions. Without
    // renormalization repeated swap-position reorders eventually
    // collide on the same value and the public ordering becomes
    // ambiguous between requests.
    await db.$transaction(async (tx) => {
      await tx.homepageFeaturedGame.delete({ where: { id: params.id } });
      const remaining = await tx.homepageFeaturedGame.findMany({
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, position: true },
      });
      let next = 10;
      for (const row of remaining) {
        if (row.position !== next) {
          await tx.homepageFeaturedGame.update({ where: { id: row.id }, data: { position: next } });
        }
        next += 10;
      }
    });

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
