// Built by Anointed Coder.
//
// GET  /api/admin/homepage-featured   list current featured curation
// POST /api/admin/homepage-featured   add a game to the curation
//
// The curation is capped at 20 rows. POST returns 409 FEATURED_LIMIT
// when the operator tries to add a 21st game.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const FEATURED_LIMIT = 20;

const postSchema = z
  .object({
    source: z.enum(['external', 'native']),
    externalGameId: z.string().trim().min(1).max(60).optional(),
    nativeGameCode: z.string().trim().min(1).max(60).optional(),
    isHot: z.boolean().optional(),
    isJackpot: z.boolean().optional(),
    position: z.number().int().min(0).max(9999).optional(),
  })
  .refine((d) => (d.source === 'external' ? Boolean(d.externalGameId) : Boolean(d.nativeGameCode)), {
    message: 'Provide externalGameId for source=external or nativeGameCode for source=native.',
  });

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const rows = await db.homepageFeaturedGame.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      take: FEATURED_LIMIT,
    });

    const externalIds = rows.filter((r) => r.source === 'external' && r.externalGameId).map((r) => r.externalGameId as string);
    const nativeCodes = rows.filter((r) => r.source === 'native' && r.nativeGameCode).map((r) => r.nativeGameCode as string);

    const [externals, natives] = await Promise.all([
      externalIds.length
        ? db.externalGame.findMany({
            where: { id: { in: externalIds } },
            select: { id: true, displayName: true, gameUid: true, category: true, status: true, imageUrl: true, provider: { select: { name: true, providerKey: true, status: true } } },
          })
        : Promise.resolve([]),
      nativeCodes.length
        ? db.nativeGameProvider.findMany({
            where: { gameCode: { in: nativeCodes } },
            select: { gameCode: true, displayName: true, isActive: true },
          })
        : Promise.resolve([]),
    ]);

    const externalById = new Map(externals.map((g) => [g.id, g]));
    const nativeByCode = new Map(natives.map((g) => [g.gameCode, g]));

    const enriched = rows.map((r) => {
      const ext = r.externalGameId ? externalById.get(r.externalGameId) ?? null : null;
      const nat = r.nativeGameCode ? nativeByCode.get(r.nativeGameCode) ?? null : null;
      const displayName = ext?.displayName ?? nat?.displayName ?? '(removed)';
      const providerName = ext?.provider?.name ?? 'Pasha Originals';
      const live = ext ? ext.status === 'active' && ext.provider?.status === 'active' : nat ? nat.isActive : false;
      return {
        id: r.id,
        source: r.source,
        externalGameId: r.externalGameId,
        nativeGameCode: r.nativeGameCode,
        isHot: r.isHot,
        isJackpot: r.isJackpot,
        position: r.position,
        addedBy: r.addedBy,
        createdAt: r.createdAt,
        displayName,
        providerName,
        category: ext?.category ?? null,
        imageUrl: ext?.imageUrl ?? null,
        live,
      };
    });

    return jsonOk({ featured: enriched, limit: FEATURED_LIMIT });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const count = await db.homepageFeaturedGame.count();
    if (count >= FEATURED_LIMIT) {
      return jsonError(409, 'FEATURED_LIMIT', `Max ${FEATURED_LIMIT} featured games. Remove one before adding another.`);
    }

    // Reject duplicate of the same underlying game.
    if (parsed.data.source === 'external' && parsed.data.externalGameId) {
      const existing = await db.homepageFeaturedGame.findFirst({ where: { source: 'external', externalGameId: parsed.data.externalGameId } });
      if (existing) return jsonError(409, 'DUPLICATE', 'This game is already on the featured list.');
      const game = await db.externalGame.findUnique({
        where: { id: parsed.data.externalGameId },
        select: { id: true, status: true, provider: { select: { status: true } } },
      });
      if (!game) return jsonError(404, 'GAME_NOT_FOUND');
      if (game.status !== 'active' || game.provider?.status !== 'active') {
        return jsonError(409, 'GAME_INACTIVE', 'Game or provider is not active.');
      }
    } else if (parsed.data.source === 'native' && parsed.data.nativeGameCode) {
      const existing = await db.homepageFeaturedGame.findFirst({ where: { source: 'native', nativeGameCode: parsed.data.nativeGameCode } });
      if (existing) return jsonError(409, 'DUPLICATE', 'This game is already on the featured list.');
      const native = await db.nativeGameProvider.findUnique({ where: { gameCode: parsed.data.nativeGameCode }, select: { gameCode: true, isActive: true } });
      if (!native) return jsonError(404, 'NATIVE_NOT_FOUND');
      if (!native.isActive) return jsonError(409, 'GAME_INACTIVE', 'Native game is not active.');
    }

    // Append at the end of the list when no position is provided.
    const position = parsed.data.position ?? ((await db.homepageFeaturedGame.aggregate({ _max: { position: true } }))._max.position ?? 0) + 10;

    const row = await db.homepageFeaturedGame.create({
      data: {
        source: parsed.data.source,
        externalGameId: parsed.data.source === 'external' ? parsed.data.externalGameId ?? null : null,
        nativeGameCode: parsed.data.source === 'native' ? parsed.data.nativeGameCode ?? null : null,
        isHot: parsed.data.isHot ?? false,
        isJackpot: parsed.data.isJackpot ?? false,
        position,
        addedBy: claims.sub,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_FEATURED_ADD',
      target: row.id,
      meta: { source: row.source, externalGameId: row.externalGameId, nativeGameCode: row.nativeGameCode },
    });

    return jsonOk({ featured: row }, 201);
  });
}
