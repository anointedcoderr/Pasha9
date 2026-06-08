// Built by Anointed Coder.
//
// GET  /api/admin/homepage-featured   list current featured curation
// POST /api/admin/homepage-featured   add a game to the curation
//
// The curation is capped at 60 rows (matches the public assembler's
// FEATURED_LIMIT in lib/homepage/sections.ts). POST returns 409 DUPLICATE when
// the operator tries to add a game that is already on the list (the
// dedupe check runs BEFORE the limit check so a full-list re-add gets
// the accurate 409 code, not the misleading FEATURED_LIMIT). On
// success the response includes both the inserted row AND the full
// enriched, ordered curation list so the admin client renders the
// new state in a single roundtrip.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const FEATURED_LIMIT = 60;

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

interface EnrichedRow {
  id: string;
  source: 'external' | 'native';
  externalGameId: string | null;
  nativeGameCode: string | null;
  isHot: boolean;
  isJackpot: boolean;
  position: number;
  addedBy: string;
  createdAt: Date;
  displayName: string;
  providerName: string;
  category: string | null;
  // Effective rendering image: operator override when set, falling
  // back to the underlying provider/native catalogue thumbnail. This
  // is what the public homepage renders.
  imageUrl: string | null;
  // The operator-uploaded override on its own, so the admin UI can
  // show a Reset button only when a real override exists.
  customImageUrl: string | null;
  // Underlying provider thumbnail, surfaced so the admin curation
  // page can preview the fallback alongside the override.
  providerImageUrl: string | null;
  // Per-card overlay visibility surfaced to the admin so each row's
  // checkboxes hydrate correctly.
  showProviderLabel: boolean;
  showGameName: boolean;
  showHotBadge: boolean;
  showPlayButton: boolean;
  imageOnlyMode: boolean;
  live: boolean;
}

// Shared enrichment used by both GET and POST. Always returns rows in
// canonical (position asc, createdAt asc) order so the admin client can
// trust the order it receives.
async function loadEnrichedFeaturedList(): Promise<EnrichedRow[]> {
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

  return rows.map((r) => {
    const ext = r.externalGameId ? externalById.get(r.externalGameId) ?? null : null;
    const nat = r.nativeGameCode ? nativeByCode.get(r.nativeGameCode) ?? null : null;
    const displayName = ext?.displayName ?? nat?.displayName ?? '(removed)';
    const providerName = ext?.provider?.name ?? 'Pasha Originals';
    const live = ext ? ext.status === 'active' && ext.provider?.status === 'active' : nat ? nat.isActive : false;
    const providerImageUrl = ext?.imageUrl ?? null;
    const customImageUrl = r.customImageUrl ?? null;
    return {
      id: r.id,
      source: r.source as 'external' | 'native',
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
      imageUrl: customImageUrl ?? providerImageUrl,
      customImageUrl,
      providerImageUrl,
      showProviderLabel: r.showProviderLabel,
      showGameName: r.showGameName,
      showHotBadge: r.showHotBadge,
      showPlayButton: r.showPlayButton,
      imageOnlyMode: r.imageOnlyMode,
      live,
    };
  });
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const featured = await loadEnrichedFeaturedList();
    return jsonOk({ featured, limit: FEATURED_LIMIT });
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

    // Reject duplicate of the same underlying game BEFORE the limit
    // check. Re-adding an already-curated game on a full list should
    // surface DUPLICATE 409, not the misleading FEATURED_LIMIT.
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

    const count = await db.homepageFeaturedGame.count();
    if (count >= FEATURED_LIMIT) {
      return jsonError(409, 'FEATURED_LIMIT', `Max ${FEATURED_LIMIT} featured games. Remove one before adding another.`);
    }

    // Position-allocation race fix. Default Postgres isolation is
    // READ COMMITTED, so two concurrent POSTs of DIFFERENT games can
    // both read max(position)=50 and both write position=60. Use
    // Serializable isolation so the second transaction sees a
    // serialization failure on commit; retry a bounded number of
    // times with a fresh max() read each attempt. The duplicate
    // check above already protects against the SAME game racing.
    const buildCreateData = () => ({
      source: parsed.data.source,
      externalGameId: parsed.data.source === 'external' ? parsed.data.externalGameId ?? null : null,
      nativeGameCode: parsed.data.source === 'native' ? parsed.data.nativeGameCode ?? null : null,
      isHot: parsed.data.isHot ?? false,
      isJackpot: parsed.data.isJackpot ?? false,
      addedBy: claims.sub,
    });

    let row: Awaited<ReturnType<typeof db.homepageFeaturedGame.create>> | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        row = await db.$transaction(
          async (tx) => {
            const max = (await tx.homepageFeaturedGame.aggregate({ _max: { position: true } }))._max.position ?? 0;
            const position = parsed.data.position ?? max + 10;
            return tx.homepageFeaturedGame.create({ data: { ...buildCreateData(), position } });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (err) {
        // P2034 = transaction failed due to a write conflict or
        // deadlock (Prisma's surface for Postgres SQLSTATE 40001
        // serialization failure / 40P01 deadlock). Anything else is a
        // real error and should not be retried.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    if (!row) {
      console.error('[homepage-featured] POST exhausted serialization retries', lastError);
      return jsonError(503, 'CONCURRENCY_RETRY_EXHAUSTED', 'Could not allocate a unique position after several attempts. Please try again.');
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_FEATURED_ADD',
      target: row.id,
      meta: { source: row.source, externalGameId: row.externalGameId, nativeGameCode: row.nativeGameCode },
    });

    // Return the full ordered list so the admin client refreshes
    // curation in a single roundtrip.
    const featured = await loadEnrichedFeaturedList();
    return jsonOk({ featured: row, list: featured }, 201);
  });
}
