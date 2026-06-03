// Built by Anointed Coder.
//
// GET /api/admin/homepage-featured/search?q=&providerId=&category=&source=
//
// Powers the admin featured-game picker. Returns up to 40 games per
// call (mixed external + native). External and native sources are
// fetched in parallel and merged. Inactive games are excluded.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const LIMIT_PER_SOURCE = 40;

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const providerId = (url.searchParams.get('providerId') ?? '').trim() || null;
    const category = (url.searchParams.get('category') ?? '').trim() || null;
    const source = (url.searchParams.get('source') ?? 'both').trim();

    const wantsExternal = source === 'external' || source === 'both';
    const wantsNative = source === 'native' || source === 'both';

    const [externals, natives] = await Promise.all([
      wantsExternal
        ? db.externalGame.findMany({
            where: {
              status: 'active',
              provider: { status: 'active' },
              ...(providerId ? { providerId } : {}),
              ...(category ? { category: { contains: category, mode: 'insensitive' } } : {}),
              ...(q
                ? {
                    OR: [
                      { displayName: { contains: q, mode: 'insensitive' } },
                      { gameUid: { contains: q, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'desc' }, { displayName: 'asc' }],
            take: LIMIT_PER_SOURCE,
            select: {
              id: true,
              displayName: true,
              gameUid: true,
              category: true,
              imageUrl: true,
              provider: { select: { id: true, providerKey: true, name: true } },
              brand: { select: { displayName: true } },
            },
          })
        : Promise.resolve([] as Array<{ id: string; displayName: string; gameUid: string; category: string | null; imageUrl: string | null; provider: { id: string; providerKey: string | null; name: string }; brand: { displayName: string } | null }>),
      wantsNative
        ? db.nativeGameProvider.findMany({
            where: {
              isActive: true,
              ...(q
                ? {
                    OR: [
                      { displayName: { contains: q, mode: 'insensitive' } },
                      { gameCode: { contains: q, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            orderBy: [{ sortOrder: 'desc' }, { displayName: 'asc' }],
            take: LIMIT_PER_SOURCE,
            select: { gameCode: true, displayName: true, isFeatured: true },
          })
        : Promise.resolve([] as Array<{ gameCode: string; displayName: string; isFeatured: boolean }>),
    ]);

    return jsonOk({
      external: externals.map((g) => ({
        source: 'external',
        id: g.id,
        displayName: g.displayName,
        gameUid: g.gameUid,
        category: g.category,
        imageUrl: g.imageUrl,
        providerId: g.provider.id,
        providerKey: g.provider.providerKey,
        providerName: g.provider.name,
        brandName: g.brand?.displayName ?? null,
      })),
      native: natives.map((g) => ({
        source: 'native',
        gameCode: g.gameCode,
        displayName: g.displayName,
      })),
    });
  });
}
