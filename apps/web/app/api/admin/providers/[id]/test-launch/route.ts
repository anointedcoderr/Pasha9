// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/test-launch
// Body: { gameUid: string, userId?: string }
//
// Admin-only round trip that runs the launch flow against the
// upstream provider WITHOUT redirecting the operator. Used to
// confirm manually imported gameUids actually work before exposing
// them to players. Token + secret never reach the response: the
// adapter's rawResponse is run through maskPayload, and any
// embedded encrypted blob in the launchUrl is left intact for the
// operator to copy but only delivered to admin-permissioned callers.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { logRequest } from '@/lib/providers/log';
import { maskPayload } from '@/lib/providers/mask';
import { ProviderAdapterError } from '@/lib/providers/types';

const schema = z.object({
  gameUid: z.string().trim().min(1).max(120),
  userId: z.string().trim().min(1).max(120).optional(),
});

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

    // Validate the game is registered for this provider. We do NOT
    // require status='active' so the operator can test maintenance
    // entries before flipping them live.
    const game = await db.externalGame.findUnique({
      where: { providerId_gameUid: { providerId: creds.id, gameUid: parsed.data.gameUid } },
      select: { gameUid: true, displayName: true, status: true },
    });
    if (!game) return jsonError(404, 'GAME_NOT_FOUND', 'Game is not registered for this provider. Add it manually first.');

    // Pick the test user. Default to the calling admin so the operator
    // tries the flow against their own wallet. If a userId is supplied
    // it must resolve to a non-blocked user row.
    const targetUserId = parsed.data.userId ?? claims.sub;
    const user = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, status: true },
    });
    if (!user) return jsonError(404, 'USER_NOT_FOUND');
    if (user.status === 'blocked') return jsonError(403, 'USER_BLOCKED');

    const wallet = await db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } });
    const balance = wallet ? Number(wallet.balance) : 0;

    const origin = new URL(req.url).origin;
    const callbackUrl = `${origin}${creds.callbackPath || `/api/providers/${creds.providerKey}/callback`}?key=${encodeURIComponent(creds.callbackSecret)}`;
    const returnUrl = `${origin}/games/provider/return?p=${encodeURIComponent(creds.providerKey)}`;

    try {
      const { result, rawRequest, rawResponse } = await adapter.launch(creds, {
        userId: user.id,
        memberAccount: user.id,
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
        endpoint: 'launch:test',
        method: 'GET',
        status: 200,
        requestPayload: rawRequest,
        responsePayload: { ok: true, mode: result.mode, gameUid: parsed.data.gameUid },
      });
      await recordActivity({
        actorId: claims.sub,
        actorRole: claims.role,
        action: 'PROVIDER_LAUNCH_TEST',
        target: parsed.data.gameUid,
        meta: { providerId: creds.id, providerKey: creds.providerKey, testUserId: user.id, mode: result.mode },
      });

      return jsonOk({
        launchUrl: result.launchUrl,
        mode: result.mode,
        rawCode: result.rawCode,
        rawMessage: result.rawMessage,
        balanceUsed: balance,
        testUser: { id: user.id, username: user.username },
        maskedResponse: maskPayload(rawResponse),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof ProviderAdapterError ? err.code : 'LAUNCH_FAILED';
      const snippet = err instanceof ProviderAdapterError ? err.snippet : undefined;
      const status = err instanceof ProviderAdapterError ? err.status : 502;
      await logRequest({
        providerId: creds.id,
        direction: 'outbound',
        endpoint: 'launch:test',
        method: 'GET',
        status,
        responsePayload: snippet ? { snippet, gameUid: parsed.data.gameUid } : undefined,
        errorMessage: msg,
      });
      return jsonError(status, code, msg, snippet ? { snippet } : undefined);
    }
  });
}
