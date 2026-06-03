// Built by Anointed Coder.
//
// GET  /api/admin/providers/[id]/brands     list ProviderBrand rows
// POST /api/admin/providers/[id]/brands     manually create a brand
//
// Manual creation is the escape hatch when the upstream brand
// catalog is gated. The operator types the brand key (e.g. JILI)
// confirmed from the provider panel and we upsert it directly.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const rows = await db.providerBrand.findMany({
      where: { providerId: params.id },
      orderBy: [{ displayName: 'asc' }],
    });

    // Attribute the most recent /launch test back to a brand so the
    // operator can see, per brand, whether a real launch attempt has
    // been made and what the upstream said. ProviderRequestLog stores
    // gameUid inside the request payload (set by the adapter), so we
    // join via ExternalGame.gameUid -> brandId.
    type LaunchLogRow = {
      id: string;
      status: number | null;
      errorMessage: string | null;
      requestPayload: unknown;
      responsePayload: unknown;
      createdAt: Date;
    };
    const recentLaunchLogs: LaunchLogRow[] = await db.providerRequestLog.findMany({
      where: { providerId: params.id, endpoint: { in: ['/launch', 'launch:test', 'launch'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, status: true, errorMessage: true, requestPayload: true, responsePayload: true, createdAt: true },
    });
    const gameUidsInLogs = new Set<string>();
    for (const log of recentLaunchLogs) {
      const rp = log.requestPayload as { gameUid?: unknown; game_uid?: unknown } | null;
      const uid = rp && typeof rp === 'object' ? (rp.gameUid ?? rp.game_uid) : null;
      if (typeof uid === 'string' || typeof uid === 'number') gameUidsInLogs.add(String(uid));
    }
    const gamesForLogs = gameUidsInLogs.size === 0 ? [] : await db.externalGame.findMany({
      where: { providerId: params.id, gameUid: { in: Array.from(gameUidsInLogs) } },
      select: { gameUid: true, brandId: true },
    });
    const gameUidToBrand = new Map(gamesForLogs.map((g) => [g.gameUid, g.brandId]));
    const lastLaunchByBrand = new Map<string, { status: number | null; ok: boolean; gameUid: string; error: string | null; at: Date }>();
    for (const log of recentLaunchLogs) {
      const rp = log.requestPayload as { gameUid?: unknown; game_uid?: unknown } | null;
      const uid = rp && typeof rp === 'object' ? (rp.gameUid ?? rp.game_uid) : null;
      const uidStr = typeof uid === 'string' || typeof uid === 'number' ? String(uid) : null;
      if (!uidStr) continue;
      const brandId = gameUidToBrand.get(uidStr) ?? null;
      if (!brandId || lastLaunchByBrand.has(brandId)) continue;
      const ok = typeof log.status === 'number' && log.status >= 200 && log.status < 300;
      lastLaunchByBrand.set(brandId, {
        status: log.status,
        ok,
        gameUid: uidStr,
        error: log.errorMessage,
        at: log.createdAt,
      });
    }
    const [totalCounts, activeCounts, categoryCounts] = await Promise.all([
      db.externalGame.groupBy({
        by: ['brandId'],
        where: { providerId: params.id },
        _count: { _all: true },
      }),
      db.externalGame.groupBy({
        by: ['brandId'],
        where: { providerId: params.id, status: 'active' },
        _count: { _all: true },
      }),
      db.externalGame.groupBy({
        by: ['brandId', 'category'],
        where: { providerId: params.id },
        _count: { _all: true },
      }),
    ]);
    const totalMap = new Map(totalCounts.map((c) => [c.brandId, c._count._all]));
    const activeMap = new Map(activeCounts.map((c) => [c.brandId, c._count._all]));
    const catMap = new Map<string, Record<string, number>>();
    for (const r of categoryCounts) {
      if (!r.brandId) continue;
      const prev = catMap.get(r.brandId) ?? {};
      prev[r.category ?? 'uncategorized'] = (prev[r.category ?? 'uncategorized'] ?? 0) + r._count._all;
      catMap.set(r.brandId, prev);
    }
    return jsonOk({
      brands: rows.map((b) => {
        const ll = lastLaunchByBrand.get(b.id) ?? null;
        const totalGames = totalMap.get(b.id) ?? 0;
        const activeGames = activeMap.get(b.id) ?? 0;
        const activationStatus = totalGames === 0
          ? 'no_games'
          : ll
            ? (ll.ok ? 'launch_ok' : 'launch_failed')
            : 'untested';
        return {
          id: b.id,
          brandKey: b.brandKey,
          displayName: b.displayName,
          status: b.status,
          gameCount: totalGames,
          activeGameCount: activeGames,
          categories: catMap.get(b.id) ?? {},
          lastSyncAt: b.lastSyncAt,
          createdAt: b.createdAt,
          activationStatus,
          lastLaunchTest: ll ? {
            status: ll.status,
            ok: ll.ok,
            gameUid: ll.gameUid,
            error: ll.error,
            at: ll.at,
          } : null,
        };
      }),
    });
  });
}

const createSchema = z.object({
  brandKey: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  status: z.enum(['active', 'hidden']).default('active'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
    if (!provider) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.providerBrand.findUnique({
      where: { providerId_brandKey: { providerId: provider.id, brandKey: parsed.data.brandKey } },
      select: { id: true },
    });
    let brand;
    if (existing) {
      brand = await db.providerBrand.update({
        where: { id: existing.id },
        data: { displayName: parsed.data.displayName, status: parsed.data.status, lastSyncAt: new Date() },
      });
    } else {
      brand = await db.providerBrand.create({
        data: {
          providerId: provider.id,
          brandKey: parsed.data.brandKey,
          displayName: parsed.data.displayName,
          status: parsed.data.status,
          lastSyncAt: new Date(),
        },
      });
    }

    await recordActivity({
      actorId: claims.sub, actorRole: claims.role,
      action: 'PROVIDER_BRAND_MANUAL', target: brand.id,
      meta: { providerId: provider.id, brandKey: brand.brandKey, displayName: brand.displayName, mode: existing ? 'update' : 'create' },
    });
    return jsonOk({
      brand: {
        id: brand.id,
        brandKey: brand.brandKey,
        displayName: brand.displayName,
        status: brand.status,
        lastSyncAt: brand.lastSyncAt,
      },
    }, existing ? 200 : 201);
  });
}
