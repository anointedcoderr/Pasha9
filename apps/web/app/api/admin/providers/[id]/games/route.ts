// Built by Anointed Coder.
//
// GET /api/admin/providers/[id]/games?brandId=&category=&status=&q=&limit=
//
// Lists synced ExternalGame rows for the provider with optional
// filters. Used by the admin Games tab. Returns the row list plus
// aggregate counts (total, by status, by category) so the tab can
// render stat tiles + a category filter populated from real data
// without a second roundtrip.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const url = new URL(req.url);
    const brandId = url.searchParams.get('brandId') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 200) || 200, 1), 500);

    const where: Prisma.ExternalGameWhereInput = {
      providerId: params.id,
      ...(brandId ? { brandId } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(q ? { OR: [
        { displayName: { contains: q, mode: 'insensitive' as const } },
        { gameUid: { contains: q } },
      ] } : {}),
    };

    const [rows, byCategoryRaw, byStatusRaw, total] = await Promise.all([
      db.externalGame.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'desc' }, { displayName: 'asc' }],
        take: limit,
      }),
      db.externalGame.groupBy({ by: ['category'], where: { providerId: params.id }, _count: { _all: true } }),
      db.externalGame.groupBy({ by: ['status'], where: { providerId: params.id }, _count: { _all: true } }),
      db.externalGame.count({ where: { providerId: params.id } }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const r of byCategoryRaw) byCategory[r.category ?? 'uncategorized'] = r._count._all;
    const byStatus: Record<string, number> = {};
    for (const r of byStatusRaw) byStatus[r.status ?? 'unknown'] = r._count._all;

    return jsonOk({
      games: rows.map((g) => ({
        id: g.id,
        gameUid: g.gameUid,
        brandId: g.brandId,
        displayName: g.displayName,
        category: g.category,
        imageUrl: g.imageUrl,
        status: g.status,
        isFeatured: g.isFeatured ?? false,
        sortOrder: g.sortOrder ?? 0,
        lastSyncAt: g.lastSyncAt,
      })),
      counts: {
        total,
        filtered: rows.length,
        byStatus,
        byCategory,
      },
    });
  });
}
