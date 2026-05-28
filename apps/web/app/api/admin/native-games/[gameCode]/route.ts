// Built by Anointed Coder.
//
// Admin PATCH for one native game. Toggles active status, min/max bet
// caps and house edge in basis points. Only super_admin or anyone with
// `settings.write` can edit.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { isSupportedGameCode } from '@/lib/native-games/config';
import { setNativeGamesEnabled, isNativeGamesEnabled } from '@/lib/native-games/flag';

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  minBet: z.coerce.number().positive().max(10_000_000).optional(),
  maxBet: z.coerce.number().positive().max(10_000_000).optional(),
  houseEdgeBps: z.coerce.number().int().min(0).max(2_000).optional(),
  displayName: z.string().trim().min(2).max(60).optional(),
  // Optional global-flag flip rides along the PATCH so the operator can
  // both enable/disable a single game and pause the whole subsystem
  // from one form.
  globalEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { gameCode: string } }) {
  return withAuth(async () => {
    if (!isSupportedGameCode(params.gameCode)) return jsonError(404, 'GAME_NOT_FOUND');
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.nativeGameProvider.findUnique({ where: { gameCode: params.gameCode } });
    if (!existing) return jsonError(404, 'GAME_NOT_FOUND');

    const min = parsed.data.minBet ?? Number(existing.minBet);
    const max = parsed.data.maxBet ?? Number(existing.maxBet);
    if (max < min) return jsonError(400, 'MAX_LESS_THAN_MIN', 'Maximum bet must be greater than or equal to the minimum.');

    if (parsed.data.globalEnabled !== undefined) {
      await setNativeGamesEnabled(parsed.data.globalEnabled);
    }

    const updated = await db.nativeGameProvider.update({
      where: { gameCode: params.gameCode },
      data: {
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.isFeatured !== undefined ? { isFeatured: parsed.data.isFeatured } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        ...(parsed.data.minBet !== undefined ? { minBet: parsed.data.minBet } : {}),
        ...(parsed.data.maxBet !== undefined ? { maxBet: parsed.data.maxBet } : {}),
        ...(parsed.data.houseEdgeBps !== undefined ? { houseEdgeBps: parsed.data.houseEdgeBps } : {}),
        ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'NATIVE_GAME_UPDATE',
      target: updated.gameCode,
      meta: {
        before: {
          isActive: existing.isActive,
          isFeatured: existing.isFeatured,
          sortOrder: existing.sortOrder,
          minBet: Number(existing.minBet),
          maxBet: Number(existing.maxBet),
          houseEdgeBps: existing.houseEdgeBps,
          displayName: existing.displayName,
        },
        after: {
          isActive: updated.isActive,
          isFeatured: updated.isFeatured,
          sortOrder: updated.sortOrder,
          minBet: Number(updated.minBet),
          maxBet: Number(updated.maxBet),
          houseEdgeBps: updated.houseEdgeBps,
          displayName: updated.displayName,
        },
        globalEnabled: parsed.data.globalEnabled,
      },
    });

    return jsonOk({
      enabled: await isNativeGamesEnabled(),
      game: {
        gameCode: updated.gameCode,
        displayName: updated.displayName,
        isActive: updated.isActive,
        isFeatured: updated.isFeatured,
        sortOrder: updated.sortOrder,
        houseEdgeBps: updated.houseEdgeBps,
        minBet: Number(updated.minBet),
        maxBet: Number(updated.maxBet),
        config: updated.config ?? null,
      },
    });
  });
}
