// Built by Anointed Coder.
//
// GET /api/admin/providers/[id]/games?brandId=&limit=
// Lists synced ExternalGame rows for the provider, optionally
// filtered by brandId. Used by the admin Games tab.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const url = new URL(req.url);
    const brandId = url.searchParams.get('brandId') || undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 200) || 200, 1), 500);

    const rows = await db.externalGame.findMany({
      where: {
        providerId: params.id,
        ...(brandId ? { brandId } : {}),
      },
      orderBy: [{ displayName: 'asc' }],
      take: limit,
    });

    return jsonOk({
      games: rows.map((g) => ({
        id: g.id,
        gameUid: g.gameUid,
        brandId: g.brandId,
        displayName: g.displayName,
        category: g.category,
        imageUrl: g.imageUrl,
        status: g.status,
        lastSyncAt: g.lastSyncAt,
      })),
    });
  });
}
