// Built by Anointed Coder.
//
// PATCH /api/admin/providers/[id]/games/[gameId]
// Body: { displayName?, category?, imageUrl?, status?, brandKey? }
//
// Single-row edit for ExternalGame. Used by the admin Games tab
// "Edit" action so the operator can correct a name, change the
// category, replace a broken image, hide a game, or reassign it to
// a different brand without touching the bulk endpoints.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { normalizeCategory } from '@/lib/providers/category';

const schema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  imageUrl: z.string().trim().max(500).optional().or(z.literal('')),
  status: z.enum(['active', 'maintenance', 'hidden']).optional(),
  brandKey: z.string().trim().max(120).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; gameId: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!provider) return jsonError(404, 'PROVIDER_NOT_FOUND');

    const game = await db.externalGame.findUnique({ where: { id: params.gameId }, select: { id: true, providerId: true, gameUid: true, displayName: true } });
    if (!game || game.providerId !== provider.id) return jsonError(404, 'GAME_NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const data: Prisma.ExternalGameUncheckedUpdateInput = {};
    if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
    if (parsed.data.category !== undefined) data.category = normalizeCategory(parsed.data.category || undefined);
    if (parsed.data.imageUrl !== undefined) data.imageUrl = parsed.data.imageUrl || null;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;

    if (parsed.data.brandKey !== undefined) {
      const key = parsed.data.brandKey.trim();
      if (key === '') {
        data.brandId = null;
      } else {
        const brand = await db.providerBrand.findUnique({
          where: { providerId_brandKey: { providerId: provider.id, brandKey: key } },
          select: { id: true },
        });
        if (!brand) return jsonError(400, 'BRAND_NOT_FOUND', `Brand "${key}" is not synced for this provider.`);
        data.brandId = brand.id;
      }
    }

    const updated = await db.externalGame.update({
      where: { id: game.id },
      data,
      select: {
        id: true, gameUid: true, displayName: true, category: true,
        imageUrl: true, status: true, brandId: true, lastSyncAt: true,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_GAME_EDIT',
      target: game.id,
      meta: {
        providerId: provider.id,
        gameUid: game.gameUid,
        changes: Object.keys(parsed.data),
      },
    });

    return jsonOk({ game: updated });
  });
}
