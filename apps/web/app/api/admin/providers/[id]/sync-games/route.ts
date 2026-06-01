// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/sync-games
// Body: { brandKey: string }
// Pulls games for one brand and upserts ExternalGame rows.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { logRequest } from '@/lib/providers/log';

const schema = z.object({ brandKey: z.string().trim().min(1).max(120) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const creds = await loadProviderCredsById(params.id);
    if (!creds) return jsonError(404, 'NOT_FOUND');
    const adapter = getAdapter(creds.adapterKey);
    if (!adapter) return jsonError(500, 'ADAPTER_NOT_REGISTERED');

    const brand = await db.providerBrand.findUnique({
      where: { providerId_brandKey: { providerId: creds.id, brandKey: parsed.data.brandKey } },
      select: { id: true, brandKey: true },
    });
    if (!brand) return jsonError(404, 'BRAND_NOT_SYNCED', 'Run Sync Brands first.');

    try {
      const { result, rawRequest, rawResponse } = await adapter.listGames(creds, brand.brandKey);
      let inserted = 0;
      let updated = 0;
      for (const g of result) {
        const existing = await db.externalGame.findUnique({
          where: { providerId_gameUid: { providerId: creds.id, gameUid: g.gameUid } },
          select: { id: true },
        });
        if (existing) {
          await db.externalGame.update({
            where: { id: existing.id },
            data: {
              brandId: brand.id,
              displayName: g.displayName,
              category: g.category ?? null,
              imageUrl: g.imageUrl ?? null,
              rawMeta: (g.raw ?? null) as Prisma.InputJsonValue,
              lastSyncAt: new Date(),
            },
          });
          updated += 1;
        } else {
          await db.externalGame.create({
            data: {
              providerId: creds.id,
              brandId: brand.id,
              gameUid: g.gameUid,
              displayName: g.displayName,
              category: g.category ?? null,
              imageUrl: g.imageUrl ?? null,
              rawMeta: (g.raw ?? null) as Prisma.InputJsonValue,
              lastSyncAt: new Date(),
            },
          });
          inserted += 1;
        }
      }
      await db.providerBrand.update({ where: { id: brand.id }, data: { lastSyncAt: new Date() } });
      await db.gameProvider.update({ where: { id: params.id }, data: { lastSyncAt: new Date() } });
      await logRequest({
        providerId: params.id, direction: 'outbound', endpoint: 'games', method: 'GET',
        status: 200,
        requestPayload: rawRequest,
        responsePayload: { brandKey: brand.brandKey, count: result.length, inserted, updated },
      });
      await recordActivity({
        actorId: claims.sub, actorRole: claims.role, action: 'PROVIDER_SYNC_GAMES', target: params.id,
        meta: { brandKey: brand.brandKey, count: result.length, inserted, updated },
      });
      return jsonOk({ brandKey: brand.brandKey, count: result.length, inserted, updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logRequest({
        providerId: params.id, direction: 'outbound', endpoint: 'games', method: 'GET',
        status: 0, errorMessage: msg,
      });
      return jsonError(502, 'SYNC_FAILED', msg);
    }
  });
}
