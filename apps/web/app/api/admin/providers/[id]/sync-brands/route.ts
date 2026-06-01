// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/sync-brands
// Pulls brands from the provider and upserts ProviderBrand rows.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { logRequest } from '@/lib/providers/log';
import { ProviderAdapterError } from '@/lib/providers/types';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const creds = await loadProviderCredsById(params.id);
    if (!creds) return jsonError(404, 'NOT_FOUND');
    const adapter = getAdapter(creds.adapterKey);
    if (!adapter) return jsonError(500, 'ADAPTER_NOT_REGISTERED');

    try {
      const { result, rawRequest, rawResponse } = await adapter.listBrands(creds);
      let inserted = 0;
      let updated = 0;
      for (const b of result) {
        const existing = await db.providerBrand.findUnique({
          where: { providerId_brandKey: { providerId: creds.id, brandKey: b.brandKey } },
          select: { id: true },
        });
        if (existing) {
          await db.providerBrand.update({
            where: { id: existing.id },
            data: { displayName: b.displayName, rawMeta: (b.raw ?? null) as Prisma.InputJsonValue, lastSyncAt: new Date() },
          });
          updated += 1;
        } else {
          await db.providerBrand.create({
            data: {
              providerId: creds.id,
              brandKey: b.brandKey,
              displayName: b.displayName,
              rawMeta: (b.raw ?? null) as Prisma.InputJsonValue,
              lastSyncAt: new Date(),
            },
          });
          inserted += 1;
        }
      }
      await db.gameProvider.update({ where: { id: params.id }, data: { lastSyncAt: new Date() } });
      await logRequest({
        providerId: params.id,
        direction: 'outbound',
        endpoint: 'brands',
        method: 'GET',
        status: 200,
        requestPayload: rawRequest,
        responsePayload: { count: result.length, inserted, updated },
      });
      await recordActivity({
        actorId: claims.sub, actorRole: claims.role, action: 'PROVIDER_SYNC_BRANDS', target: params.id,
        meta: { count: result.length, inserted, updated },
      });
      return jsonOk({ count: result.length, inserted, updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof ProviderAdapterError ? err.code : 'SYNC_FAILED';
      const snippet = err instanceof ProviderAdapterError ? err.snippet : undefined;
      const status = err instanceof ProviderAdapterError ? err.status : 502;
      await logRequest({
        providerId: params.id,
        direction: 'outbound',
        endpoint: 'brands',
        method: 'GET',
        status,
        responsePayload: snippet ? { snippet } : undefined,
        errorMessage: msg,
      });
      return jsonError(status, code, msg, snippet ? { snippet } : undefined);
    }
  });
}
