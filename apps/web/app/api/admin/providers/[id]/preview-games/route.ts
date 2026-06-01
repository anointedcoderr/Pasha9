// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/preview-games
// Body: { brandKey: string }
//
// Dry-run version of /sync-games. Calls adapter.listGames but does
// NOT touch the database. Used by the admin "Test brand ID" panel
// so the operator can confirm a brand_id returns rows before
// committing them to ExternalGame.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { logRequest } from '@/lib/providers/log';
import { ProviderAdapterError } from '@/lib/providers/types';

const schema = z.object({ brandKey: z.string().trim().min(1).max(120) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const creds = await loadProviderCredsById(params.id);
    if (!creds) return jsonError(404, 'NOT_FOUND');
    const adapter = getAdapter(creds.adapterKey);
    if (!adapter) return jsonError(500, 'ADAPTER_NOT_REGISTERED');

    try {
      const { result, rawRequest, rawResponse } = await adapter.listGames(creds, parsed.data.brandKey);
      await logRequest({
        providerId: params.id,
        direction: 'outbound',
        endpoint: 'games:preview',
        method: 'GET',
        status: 200,
        requestPayload: rawRequest,
        responsePayload: { brandKey: parsed.data.brandKey, count: result.length, dryRun: true },
      });
      return jsonOk({
        brandKey: parsed.data.brandKey,
        count: result.length,
        sample: result.slice(0, 20),
        dryRun: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof ProviderAdapterError ? err.code : 'PREVIEW_FAILED';
      const snippet = err instanceof ProviderAdapterError ? err.snippet : undefined;
      const status = err instanceof ProviderAdapterError ? err.status : 502;
      await logRequest({
        providerId: params.id,
        direction: 'outbound',
        endpoint: 'games:preview',
        method: 'GET',
        status,
        responsePayload: snippet ? { snippet, brandKey: parsed.data.brandKey } : undefined,
        errorMessage: msg,
      });
      return jsonError(status, code, msg, snippet ? { snippet } : undefined);
    }
  });
}
