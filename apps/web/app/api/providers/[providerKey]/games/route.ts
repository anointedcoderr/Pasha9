// Built by Anointed Coder.
//
// GET /api/providers/<providerKey>/games?q=&category=&offset=&limit=
//
// Public list of active external games for one provider. Used by
// the homepage rail (no params, default cap 200) and the full
// provider lobby (paginated, filterable). Bet routes (launch) gate
// by authentication separately.

export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(req: Request, { params }: { params: { providerKey: string } }) {
  const provider = await db.gameProvider.findUnique({
    where: { providerKey: params.providerKey },
    select: { id: true, name: true, status: true, launchMinBalance: true },
  });
  if (!provider) return jsonError(404, 'PROVIDER_NOT_FOUND');
  if (provider.status !== 'active') return jsonError(503, 'PROVIDER_INACTIVE');

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const category = (url.searchParams.get('category') ?? '').trim();
  const brandKeyParam = (url.searchParams.get('brand') ?? url.searchParams.get('brandKey') ?? '').trim();
  const featuredOnly = (url.searchParams.get('featured') ?? '') === '1';
  const jackpotOnly = (url.searchParams.get('jackpot') ?? '') === '1';
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 200) || 200, 1), 300);

  // M4 Phase H: resolve brand filter through ProviderBrand. The
  // /games/provider lobby uses ?brand=PGSOFT etc. so visitors can
  // browse a single aggregator brand without leaving the page.
  let brandIdFilter: string | null = null;
  if (brandKeyParam) {
    const brand = await db.providerBrand.findUnique({
      where: { providerId_brandKey: { providerId: provider.id, brandKey: brandKeyParam } },
      select: { id: true, status: true },
    });
    if (!brand) return jsonError(404, 'BRAND_NOT_FOUND');
    if (brand.status !== 'active') return jsonError(503, 'BRAND_INACTIVE');
    brandIdFilter = brand.id;
  }

  const where: Prisma.ExternalGameWhereInput = {
    providerId: provider.id,
    status: 'active',
    ...(category ? { category } : {}),
    ...(brandIdFilter ? { brandId: brandIdFilter } : {}),
    ...(featuredOnly ? { isFeatured: true } : {}),
    ...(jackpotOnly ? { isJackpot: true } : {}),
    ...(q ? { OR: [
      { displayName: { contains: q, mode: 'insensitive' as const } },
      { gameUid: { contains: q } },
    ] } : {}),
  };

  const [games, total, byCategoryRaw] = await Promise.all([
    db.externalGame.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'desc' }, { category: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true, gameUid: true, displayName: true, category: true,
        imageUrl: true, brandId: true, isFeatured: true, isJackpot: true, sortOrder: true, lastSyncAt: true,
      },
      skip: offset,
      take: limit,
    }),
    db.externalGame.count({ where }),
    db.externalGame.groupBy({
      by: ['category'],
      where: { providerId: provider.id, status: 'active' },
      _count: { _all: true },
    }),
  ]);

  const brands = await db.providerBrand.findMany({
    where: { providerId: provider.id },
    select: { id: true, brandKey: true, displayName: true, status: true },
  });
  const brandMap = new Map(brands.map((b) => [b.id, b]));

  // Per-brand active game counts so the lobby can render a brand
  // dropdown with totals next to each brand name.
  const byBrandRaw = await db.externalGame.groupBy({
    by: ['brandId'],
    where: { providerId: provider.id, status: 'active' },
    _count: { _all: true },
  });
  const byBrand = byBrandRaw
    .map((r) => {
      const brand = r.brandId ? brandMap.get(r.brandId) : null;
      if (!brand || brand.status !== 'active') return null;
      return { brandKey: brand.brandKey, brandName: brand.displayName, count: r._count._all };
    })
    .filter((x): x is { brandKey: string; brandName: string; count: number } => x != null)
    .sort((a, b) => b.count - a.count);

  const byCategory: Record<string, number> = {};
  for (const r of byCategoryRaw) byCategory[r.category ?? 'uncategorized'] = r._count._all;

  return jsonOk({
    provider: {
      providerKey: params.providerKey,
      name: provider.name,
      launchMinBalance: provider.launchMinBalance ? Number(provider.launchMinBalance) : 0,
    },
    counts: { total, returned: games.length, offset, byCategory, byBrand },
    games: games.map((g) => ({
      gameUid: g.gameUid,
      displayName: g.displayName,
      category: g.category ?? null,
      imageUrl: g.imageUrl ?? null,
      brandKey: g.brandId ? brandMap.get(g.brandId)?.brandKey ?? null : null,
      brandName: g.brandId ? brandMap.get(g.brandId)?.displayName ?? null : null,
      isFeatured: g.isFeatured ?? false,
      isJackpot: g.isJackpot ?? false,
    })),
  });
}
