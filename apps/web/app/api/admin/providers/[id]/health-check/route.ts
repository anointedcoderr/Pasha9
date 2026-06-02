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

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      callbackCount, lastCallback,
      txAccepted, txDuplicate, txRejected, txRolledBack,
      gamesCount, activeGames,
      lastLaunchReq, lastAcceptedTx,
      callbacks24h, accepted24h, duplicates24h, rejected24h, launch24h,
    ] = await Promise.all([
      db.providerCallbackLog.count({ where: { providerId: creds.id } }),
      db.providerCallbackLog.findFirst({
        where: { providerId: creds.id },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true, ip: true, callbackKeyValid: true, error: true },
      }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'accepted' } }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'duplicate' } }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'rejected' } }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'rolled_back' } }),
      db.externalGame.count({ where: { providerId: creds.id } }),
      db.externalGame.count({ where: { providerId: creds.id, status: 'active' } }),
      db.providerRequestLog.findFirst({
        where: { providerId: creds.id, direction: 'outbound', endpoint: { contains: 'launch' } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, endpoint: true, status: true },
      }),
      db.providerTransaction.findFirst({
        where: { providerId: creds.id, status: 'accepted' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, gameRound: true, winAmount: true, betAmount: true },
      }),
      db.providerCallbackLog.count({ where: { providerId: creds.id, receivedAt: { gte: dayAgo } } }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'accepted', createdAt: { gte: dayAgo } } }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'duplicate', createdAt: { gte: dayAgo } } }),
      db.providerTransaction.count({ where: { providerId: creds.id, status: 'rejected', createdAt: { gte: dayAgo } } }),
      db.providerRequestLog.count({
        where: { providerId: creds.id, direction: 'outbound', endpoint: { contains: 'launch' }, createdAt: { gte: dayAgo } },
      }),
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

    // Headline diagnostic: launches without callbacks means the
    // provider portal is dialling the wrong callback URL, the IP is
    // not whitelisted, or the key is wrong. The headline tile turns
    // rose when this fires so the operator notices immediately.
    const launchWithoutCallback = launch24h > 0 && callbacks24h === 0;

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
        rejected: txRejected,
        rolledBack: txRolledBack,
        games: gamesCount,
        activeGames,
      },
      lastCallback,
      last24h: {
        callbacks: callbacks24h,
        accepted: accepted24h,
        duplicates: duplicates24h,
        rejected: rejected24h,
        launches: launch24h,
      },
      lastLaunchAt: lastLaunchReq?.createdAt ?? null,
      lastAcceptedAt: lastAcceptedTx?.createdAt ?? null,
      lastAcceptedRound: lastAcceptedTx?.gameRound ?? null,
      diagnostics: {
        launchWithoutCallback,
      },
    });
  });
}
