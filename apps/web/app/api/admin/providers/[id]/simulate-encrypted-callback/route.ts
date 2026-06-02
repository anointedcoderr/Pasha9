// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/simulate-encrypted-callback
// Body: { gameUid, gameRound?, betAmount, winAmount, userQuery? }
//
// Builds the exact iGamingAPIs encrypted callback shape:
//   { payload: AES-256-ECB(JSON({ user_id, game_id, game_round,
//                                bet_amount, win_amount, timestamp })),
//     timestamp: Date.now() }
// then runs it through the live callback pipeline (parseCallback
// + processProviderCallback) so the operator can verify the
// decrypt + alias + wallet flow end-to-end.

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
import { aesEcbEncryptBase64 } from '@/lib/providers/crypto';

const schema = z.object({
  gameUid: z.string().trim().min(1).max(120),
  gameRound: z.string().trim().min(1).max(120).optional(),
  userQuery: z.string().trim().min(1).max(160).optional(),
  betAmount: z.coerce.number().nonnegative().max(1_000_000).default(0),
  winAmount: z.coerce.number().nonnegative().max(1_000_000).default(0),
});

async function resolveUserByQuery(q: string) {
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

    const user = parsed.data.userQuery
      ? await resolveUserByQuery(parsed.data.userQuery)
      : await db.user.findUnique({ where: { id: claims.sub }, select: { id: true, username: true, status: true } });
    if (!user) return jsonError(404, 'USER_NOT_FOUND');
    if (user.status === 'blocked') return jsonError(403, 'USER_BLOCKED');

    const memberAccount = await getOrCreateMemberAccount(creds.id, user.id);
    const gameRound = parsed.data.gameRound?.trim() || `enc-sim-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const ts = Date.now();

    // Build the inner JSON the same way iGamingAPIs would, then
    // AES-256-ECB encrypt with the configured secret + encoding.
    const inner = {
      user_id: memberAccount,
      game_id: parsed.data.gameUid,
      game_round: gameRound,
      bet_amount: parsed.data.betAmount,
      win_amount: parsed.data.winAmount,
      timestamp: ts,
    };
    const encryptedPayload = aesEcbEncryptBase64(JSON.stringify(inner), creds.apiSecret, creds.secretEncoding);
    const outerBody = { payload: encryptedPayload, timestamp: ts };

    const walletBeforeRow = await db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } });
    const walletBefore = walletBeforeRow ? Number(walletBeforeRow.balance) : 0;

    let normalizedDiagnostics: unknown = null;
    let result: Awaited<ReturnType<typeof processProviderCallback>> | null = null;
    let parseError: string | null = null;
    try {
      const normalized = await adapter.parseCallback(creds, {}, outerBody);
      normalizedDiagnostics = normalized.diagnostics ?? null;
      result = await processProviderCallback(creds, normalized);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }

    // Mirror the log writer so this rehearsal also lands in the
    // Callbacks log with a `_simulated: encrypted` marker.
    if (result) {
      const envelope = adapter.buildCallbackResponse(creds, {
        newBalance: result.walletAfter,
        betAmount: parsed.data.betAmount,
        winAmount: parsed.data.winAmount,
        responseMode: creds.callbackResponseMode,
        ok: result.status === 'accepted' || result.status === 'duplicate',
        errorCode: result.errorCode,
      });
      await db.providerCallbackLog.create({
        data: {
          providerId: creds.id,
          ip: 'sim-encrypted',
          method: 'POST',
          callbackKeyValid: true,
          ipValid: true,
          timestampValid: true,
          body: (maskPayload(outerBody) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          response: {
            ...(envelope.body as Record<string, unknown>),
            _simulated: 'encrypted',
            _diagnostics: {
              ...(normalizedDiagnostics as object ?? {}),
              status: result.status,
              errorCode: result.errorCode ?? null,
              userId: result.userId,
              walletBefore: result.walletBefore,
              walletAfter: result.walletAfter,
              netResult: result.netResult,
            },
          } as Prisma.InputJsonValue,
          processedTxId: result.providerTxId,
          error: result.status === 'rejected' ? (result.errorCode ?? 'REJECTED') : null,
        },
      }).catch(() => undefined);
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_CALLBACK_ENCRYPTED_SIM',
      target: parsed.data.gameUid,
      meta: {
        providerId: creds.id,
        providerKey: creds.providerKey,
        userId: user.id,
        memberAccount,
        gameRound,
        betAmount: parsed.data.betAmount,
        winAmount: parsed.data.winAmount,
        status: result?.status ?? 'parse_error',
        parseError,
      },
    });

    return jsonOk({
      memberAccount,
      gameRound,
      outerBody: { payload: '<encrypted>', timestamp: ts },
      innerBody: inner,
      walletBefore,
      result: result ? {
        status: result.status,
        errorCode: result.errorCode ?? null,
        providerTxId: result.providerTxId,
        walletBefore: result.walletBefore,
        walletAfter: result.walletAfter,
        netResult: result.netResult,
      } : null,
      diagnostics: normalizedDiagnostics,
      parseError,
      user: { id: user.id, username: user.username },
    });
  });
}
