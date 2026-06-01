// Built by Anointed Coder.
//
// Pings the provider via adapter.healthCheck. Stores the result on
// lastHealthCheckAt/lastHealthCheckOk so /admin/integrations and the
// homepage placeholder can flip to "Live" only after a real probe.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { logRequest } from '@/lib/providers/log';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const creds = await loadProviderCredsById(params.id);
    if (!creds) return jsonError(404, 'NOT_FOUND');
    const adapter = getAdapter(creds.adapterKey);
    if (!adapter) return jsonError(500, 'ADAPTER_NOT_REGISTERED');

    const result = await adapter.healthCheck(creds);
    await db.gameProvider.update({
      where: { id: params.id },
      data: { lastHealthCheckAt: new Date(), lastHealthCheckOk: result.ok },
    });
    await logRequest({
      providerId: params.id,
      direction: 'outbound',
      endpoint: 'health',
      method: 'GET',
      status: result.ok ? 200 : 0,
      durationMs: result.latencyMs,
      responsePayload: { detail: result.detail ?? null },
      errorMessage: result.ok ? undefined : result.detail,
    });
    return jsonOk({ ok: result.ok, latencyMs: result.latencyMs, detail: result.detail ?? null });
  });
}
