// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/simulate-callback
// Body: { gameUid, userQuery?, betAmount, winAmount, gameRound? }
//
// Admin-only callback rehearsal. Builds the exact body the upstream
// provider would POST to /api/providers/<key>/callback, then runs
// it through adapter.parseCallback + processProviderCallback inside
// the live wallet pipeline. The same idempotency, blocked-user and
// MEMBER_ACCOUNT_NOT_FOUND guards apply.
//
// This is NOT a synthetic dry-run: a successful simulation DEBITS
// the test user's wallet exactly like a real provider callback
// would. Run it against a sandbox user, or use the duplicate path
// (re-send the same gameRound) to verify the no-double-debit guard
// without spending more money.

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
import { processProviderCallback } from '@/lib/providers/wallet';
import { getOrCreateMemberAccount } from '@/lib/providers/player-account';
import { maskPayload } from '@/lib/providers/mask';

const schema = z.object({
  gameUid: z.string().trim().min(1).max(120),
  userQuery: z.string().trim().min(1).max(160).optional(),
  betAmount: z.coerce.number().nonnegative().max(1_000_000).default(0),
  winAmount: z.coerce.number().nonnegative().max(1_000_000).default(0),
  gameRound: z.string().trim().min(1).max(120).optional(),
});

async function resolveUser(q: string) {
  return db.user.findFirst({
    where: { OR: [{ id: q }, { username: q }, { phone: q }, { email: q }] },
    select: { id: true, username: true, status: true },
  });
}

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

    const game = await db.externalGame.findUnique({
      where: { providerId_gameUid: { providerId: creds.id, gameUid: parsed.data.gameUid } },
      select: { gameUid: true, displayName: true, status: true },
    });
    if (!game) return jsonError(404, 'GAME_NOT_FOUND');

    const user = parsed.data.userQuery
      ? await resolveUser(parsed.data.userQuery)
      : await db.user.findUnique({ where: { id: claims.sub }, select: { id: true, username: true, status: true } });
    if (!user) return jsonError(404, 'USER_NOT_FOUND');
    if (user.status === 'blocked') return jsonError(403, 'USER_BLOCKED');

    const memberAccount = await getOrCreateMemberAccount(creds.id, user.id);

    // The provider sends member_account as the value WE assigned, so
    // we mirror that here. game_round is what they use as the
    // dedup key, so a repeat run with the same value should hit the
    // duplicate short-circuit in processProviderCallback.
    const gameRound = parsed.data.gameRound?.trim()
      || `sim-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const ts = Date.now();

    const callbackBody = {
      game_id: parsed.data.gameUid,
      game_uid: parsed.data.gameUid,
      game_round: gameRound,
      member_account: memberAccount,
      bet_amount: parsed.data.betAmount,
      win_amount: parsed.data.winAmount,
      timestamp: ts,
    };

    const walletBeforeRow = await db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } });
    const walletBefore = walletBeforeRow ? Number(walletBeforeRow.balance) : 0;

    try {
      const normalized = await adapter.parseCallback(creds, {}, callbackBody);
      const result = await processProviderCallback(creds, normalized);

      const envelope = adapter.buildCallbackResponse(creds, {
        newBalance: result.walletAfter,
        betAmount: normalized.betAmount,
        winAmount: normalized.winAmount,
        responseMode: creds.callbackResponseMode,
        ok: result.status === 'accepted' || result.status === 'duplicate',
        errorCode: result.errorCode,
      });

      // Mark this hit in the callback log so the operator can spot
      // simulations vs real provider traffic.
      await db.providerCallbackLog.create({
        data: {
          providerId: creds.id,
          ip: 'simulated',
          method: 'POST',
          callbackKeyValid: true,
          ipValid: true,
          timestampValid: true,
          body: (maskPayload(callbackBody) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          response: envelope.body as Prisma.InputJsonValue,
          processedTxId: result.providerTxId,
          error: result.status === 'rejected' ? (result.errorCode ?? 'REJECTED') : null,
        },
      }).catch(() => undefined);

      await recordActivity({
        actorId: claims.sub,
        actorRole: claims.role,
        action: 'PROVIDER_CALLBACK_SIMULATE',
        target: parsed.data.gameUid,
        meta: {
          providerId: creds.id,
          providerKey: creds.providerKey,
          userId: user.id,
          memberAccount,
          gameRound,
          betAmount: parsed.data.betAmount,
          winAmount: parsed.data.winAmount,
          status: result.status,
          errorCode: result.errorCode ?? null,
        },
      });

      return jsonOk({
        gameRound,
        memberAccount,
        callbackBody,
        callbackResponse: { status: envelope.status, body: envelope.body },
        result: {
          status: result.status,
          errorCode: result.errorCode,
          providerTxId: result.providerTxId,
          walletBefore,
          walletAfter: result.walletAfter,
          netResult: result.netResult,
        },
        testUser: { id: user.id, username: user.username },
      });
    } catch (err) {
      return jsonError(500, 'SIMULATE_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}
