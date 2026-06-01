// Built by Anointed Coder.
//
// POST /api/providers/<providerKey>/launch
// Body: { gameUid }
//
// Server-side game launch. Token and secret never touch the
// browser; the adapter does the AES-256-ECB encryption + signed
// query string and we hand the player only the resulting launchUrl.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { db } from '@/lib/db/client';
import { loadProviderCreds } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { logRequest } from '@/lib/providers/log';
import { ProviderAdapterError } from '@/lib/providers/types';
import { getOrCreateMemberAccount } from '@/lib/providers/player-account';

const schema = z.object({ gameUid: z.string().trim().min(1).max(120) });

export async function POST(req: NextRequest, { params }: { params: { providerKey: string } }) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`provider-launch:${session.sub}:${params.providerKey}`, 20, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const creds = await loadProviderCreds(params.providerKey);
    if (!creds) return jsonError(404, 'PROVIDER_NOT_FOUND');
    if (!creds.active) return jsonError(503, 'PROVIDER_INACTIVE');

    const adapter = getAdapter(creds.adapterKey);
    if (!adapter) return jsonError(500, 'ADAPTER_NOT_REGISTERED');

    // Make sure the gameUid is one we synced for this provider, to
    // avoid the user passing arbitrary uids.
    const game = await db.externalGame.findUnique({
      where: { providerId_gameUid: { providerId: creds.id, gameUid: parsed.data.gameUid } },
      select: { gameUid: true, status: true, displayName: true },
    });
    if (!game || game.status !== 'active') return jsonError(404, 'GAME_NOT_FOUND');

    // Read wallet balance so we can pass it to the provider. (We do
    // NOT block on zero balance here; the lobby's DepositRequiredModal
    // is responsible for that UX flow.)
    const wallet = await db.wallet.findUnique({ where: { userId: session.sub }, select: { balance: true } });
    const balance = wallet ? Number(wallet.balance) : 0;

    const origin = new URL(req.url).origin;
    const callbackUrl = `${origin}${creds.callbackPath || `/api/providers/${creds.providerKey}/callback`}?key=${encodeURIComponent(creds.callbackSecret)}`;
    const returnUrl = `${origin}/games/provider/return?p=${encodeURIComponent(creds.providerKey)}`;

    // Resolve or allocate the numeric memberAccount the provider
    // requires. The internal cuid is NEVER sent upstream.
    const memberAccount = await getOrCreateMemberAccount(creds.id, session.sub);

    try {
      const { result, rawRequest, rawResponse } = await adapter.launch(creds, {
        userId: session.sub,
        memberAccount,
        balance,
        gameUid: parsed.data.gameUid,
        token: creds.apiKey,
        returnUrl,
        callbackUrl,
        currencyCode: creds.currencyCode,
        language: creds.language,
      });
      await logRequest({
        providerId: creds.id,
        direction: 'outbound',
        endpoint: '/launch',
        method: 'GET',
        status: 200,
        requestPayload: rawRequest,
        responsePayload: rawResponse,
      });
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'PROVIDER_LAUNCH',
        target: parsed.data.gameUid,
        meta: { providerKey: creds.providerKey, gameUid: parsed.data.gameUid },
      });
      return jsonOk({ launchUrl: result.launchUrl, mode: result.mode });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logRequest({
        providerId: creds.id,
        direction: 'outbound',
        endpoint: '/launch',
        method: 'GET',
        status: err instanceof ProviderAdapterError ? err.status : 500,
        errorMessage: msg,
      });
      if (err instanceof ProviderAdapterError) {
        return jsonError(err.status, err.code, msg);
      }
      console.error('[providers/launch] unexpected', err);
      return jsonError(500, 'LAUNCH_FAILED');
    }
  });
}
