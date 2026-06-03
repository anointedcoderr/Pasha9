// Built by Anointed Coder.
//
// GET    /api/admin/homepage-blocks/[id]/items   list items with enriched data
// POST   /api/admin/homepage-blocks/[id]/items   add an item
// PUT    /api/admin/homepage-blocks/[id]/items   bulk reorder (positions[])

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const ITEM_LIMIT = 30;

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

const reorderSchema = z.object({
  positions: z.array(z.object({ id: z.string().min(1), position: z.number().int().min(0).max(9999) })).min(1).max(ITEM_LIMIT),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const block = await db.homepageGameBlock.findUnique({ where: { id: params.id } });
    if (!block) return jsonError(404, 'NOT_FOUND');

    const items = await db.homepageGameBlockItem.findMany({
      where: { blockId: block.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    const externalIds = items.filter((r) => r.source === 'external' && r.externalGameId).map((r) => r.externalGameId as string);
    const nativeCodes = items.filter((r) => r.source === 'native' && r.nativeGameCode).map((r) => r.nativeGameCode as string);

    const [externals, natives] = await Promise.all([
      externalIds.length
        ? db.externalGame.findMany({
            where: { id: { in: externalIds } },
            select: {
              id: true, displayName: true, gameUid: true, category: true, status: true, imageUrl: true, isJackpot: true,
              provider: { select: { name: true, providerKey: true, status: true } },
              brand: { select: { displayName: true, brandKey: true } },
            },
          })
        : Promise.resolve([]),
      nativeCodes.length
        ? db.nativeGameProvider.findMany({ where: { gameCode: { in: nativeCodes } }, select: { gameCode: true, displayName: true, isActive: true } })
        : Promise.resolve([]),
    ]);

    const externalById = new Map(externals.map((g) => [g.id, g]));
    const nativeByCode = new Map(natives.map((g) => [g.gameCode, g]));

    const enriched = items.map((r) => {
      const ext = r.externalGameId ? externalById.get(r.externalGameId) ?? null : null;
      const nat = r.nativeGameCode ? nativeByCode.get(r.nativeGameCode) ?? null : null;
      const live = ext ? ext.status === 'active' && ext.provider?.status === 'active' : nat ? nat.isActive : false;
      return {
        id: r.id,
        source: r.source,
        externalGameId: r.externalGameId,
        nativeGameCode: r.nativeGameCode,
        isHot: r.isHot,
        isJackpot: r.isJackpot,
        position: r.position,
        displayName: ext?.displayName ?? nat?.displayName ?? '(removed)',
        providerName: ext?.provider?.name ?? 'Pasha Originals',
        brandName: ext?.brand?.displayName ?? null,
        brandKey: ext?.brand?.brandKey ?? null,
        category: ext?.category ?? null,
        imageUrl: ext?.imageUrl ?? null,
        live,
      };
    });

    return jsonOk({ items: enriched, limit: ITEM_LIMIT });
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const block = await db.homepageGameBlock.findUnique({ where: { id: params.id } });
    if (!block) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const count = await db.homepageGameBlockItem.count({ where: { blockId: block.id } });
    if (count >= ITEM_LIMIT) {
      return jsonError(409, 'BLOCK_FULL', `Max ${ITEM_LIMIT} games per block. Remove one before adding another.`);
    }

    if (parsed.data.source === 'external' && parsed.data.externalGameId) {
      const dup = await db.homepageGameBlockItem.findFirst({
        where: { blockId: block.id, source: 'external', externalGameId: parsed.data.externalGameId },
      });
      if (dup) return jsonError(409, 'DUPLICATE', 'This game is already in the block.');
      const game = await db.externalGame.findUnique({ where: { id: parsed.data.externalGameId }, select: { id: true } });
      if (!game) return jsonError(404, 'GAME_NOT_FOUND');
    } else if (parsed.data.source === 'native' && parsed.data.nativeGameCode) {
      const dup = await db.homepageGameBlockItem.findFirst({
        where: { blockId: block.id, source: 'native', nativeGameCode: parsed.data.nativeGameCode },
      });
      if (dup) return jsonError(409, 'DUPLICATE', 'This game is already in the block.');
      const native = await db.nativeGameProvider.findUnique({ where: { gameCode: parsed.data.nativeGameCode }, select: { gameCode: true } });
      if (!native) return jsonError(404, 'NATIVE_NOT_FOUND');
    }

    const maxPos = (await db.homepageGameBlockItem.aggregate({ where: { blockId: block.id }, _max: { position: true } }))._max.position ?? 0;
    const row = await db.homepageGameBlockItem.create({
      data: {
        blockId: block.id,
        source: parsed.data.source,
        externalGameId: parsed.data.source === 'external' ? parsed.data.externalGameId ?? null : null,
        nativeGameCode: parsed.data.source === 'native' ? parsed.data.nativeGameCode ?? null : null,
        isHot: parsed.data.isHot ?? false,
        isJackpot: parsed.data.isJackpot ?? false,
        position: parsed.data.position ?? maxPos + 10,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_BLOCK_ITEM_ADD',
      target: row.id,
      meta: { blockId: block.id, source: row.source },
    });
    return jsonOk({ item: row }, 201);
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const block = await db.homepageGameBlock.findUnique({ where: { id: params.id } });
    if (!block) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    await db.$transaction(parsed.data.positions.map((p) =>
      db.homepageGameBlockItem.updateMany({ where: { id: p.id, blockId: block.id }, data: { position: p.position } }),
    ));

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_BLOCK_REORDER',
      target: block.id,
      meta: { count: parsed.data.positions.length },
    });
    return jsonOk({ ok: true });
  });
}
