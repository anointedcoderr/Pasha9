// Built by Anointed Coder.
//
// GET /api/admin/providers/[id]/health-check
//
// Live verification checklist for an external provider. Aggregates
// the six readiness signals an operator should confirm before
// activating real betting:
//
//   1. Public base URL is HTTPS (not localhost / private network).
//   2. Callback secret is set.
//   3. IP whitelist is configured (or explicitly empty by choice).
//   4. At least one callback has been received from the provider.
//   5. At least one ProviderTransaction has been accepted.
//   6. Duplicate-callback protection has been observed at least once.
//
// The result is consumed by the admin Setup tab to render the
// checklist tile and the overall ready-or-not chip.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { resolveProviderUrls } from '@/lib/providers/site-url';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');

    const creds = await loadProviderCredsById(params.id);
    if (!creds) return jsonError(404, 'NOT_FOUND');

    const origin = new URL(req.url).origin;
    const urls = resolveProviderUrls(creds, origin);

    const [callbackCount, lastCallback, txAccepted, txDuplicate, gamesCount, activeGames] = await Promise.all([
      db.providerCallbackLog.count({ where: { providerId: creds.id } }),
      db.providerCallbackLog.findFirst({
        where: { providerId: creds.id },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true, ip: true, callbackKeyValid: true, error: true },
      }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'accepted' } }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'duplicate' } }),
      db.externalGame.count({ where: { providerId: creds.id } }),
      db.externalGame.count({ where: { providerId: creds.id, status: 'active' } }),
    ]);

    const checks = {
      baseUrlIsHttps: urls.baseUrl.isHttps,
      baseUrlIsPublic: !urls.baseUrl.isPrivateHost,
      baseUrlSource: urls.baseUrl.source,
      callbackSecretSet: creds.callbackSecret.length > 0,
      ipWhitelistConfigured: creds.ipWhitelist.length > 0,
      gameCatalogImported: gamesCount > 0,
      callbackReceived: callbackCount > 0,
      transactionProcessed: txAccepted > 0,
      duplicateProtectionTested: txDuplicate > 0,
    };

    const allRequiredPass = checks.baseUrlIsHttps
      && checks.baseUrlIsPublic
      && checks.callbackSecretSet
      && checks.callbackReceived
      && checks.transactionProcessed;

    return jsonOk({
      ready: allRequiredPass,
      providerActive: creds.active,
      urls: {
        baseUrl: urls.baseUrl.base,
        baseUrlSource: urls.baseUrl.source,
        callbackUrl: urls.callbackUrlMasked,
        returnUrl: urls.returnUrl,
      },
      checks,
      counts: {
        callbacks: callbackCount,
        accepted: txAccepted,
        duplicates: txDuplicate,
        games: gamesCount,
        activeGames,
      },
      lastCallback,
    });
  });
}
