// Built by Anointed Coder.
//
// Public list of synced external games for one provider. Rendered
// by the lobby + homepage when a provider is live. Anyone can read
// this; bet routes (launch) gate by authentication.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(_req: Request, { params }: { params: { providerKey: string } }) {
  const provider = await db.gameProvider.findUnique({
    where: { providerKey: params.providerKey },
    select: { id: true, name: true, status: true },
  });
  if (!provider) return jsonError(404, 'PROVIDER_NOT_FOUND');
  if (provider.status !== 'active') return jsonError(503, 'PROVIDER_INACTIVE');

  const games = await db.externalGame.findMany({
    where: { providerId: provider.id, status: 'active' },
    orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    select: {
      id: true, gameUid: true, displayName: true, category: true,
      imageUrl: true, brandId: true, lastSyncAt: true,
    },
    take: 200,
  });

  const brands = await db.providerBrand.findMany({
    where: { providerId: provider.id },
    select: { id: true, brandKey: true, displayName: true },
  });
  const brandMap = new Map(brands.map((b) => [b.id, b]));

  return jsonOk({
    provider: { providerKey: params.providerKey, name: provider.name },
    games: games.map((g) => ({
      gameUid: g.gameUid,
      displayName: g.displayName,
      category: g.category ?? null,
      imageUrl: g.imageUrl ?? null,
      brandKey: g.brandId ? brandMap.get(g.brandId)?.brandKey ?? null : null,
      brandName: g.brandId ? brandMap.get(g.brandId)?.displayName ?? null : null,
    })),
  });
}
