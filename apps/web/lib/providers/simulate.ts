// Built by Anointed Coder.
//
// Shared simulation logic for the admin "Simulate provider callback"
// flow. Two endpoints call this:
//
//   /api/admin/providers/[id]/simulate-callback         (the modal)
//   /api/admin/providers/[id]/simulate-callback/direct  (fallback for
//                                                        direct API tests)
//
// Behaviour:
//   - Resolves provider creds, adapter, test user (defaulting to the
//     logged-in admin), member account mapping.
//   - Soft check on game catalog presence: returns gameCatalogHit
//     boolean so the UI can warn, but does not block.
//   - Hard check on wallet: returns WALLET_NOT_FOUND when the test
//     user has no wallet row.
//   - Forces creds.active = true so the wallet pipeline runs even
//     when the provider is in Maintenance. Real public traffic stays
//     blocked upstream by the public callback route.
//   - Always writes a ProviderCallbackLog so the Logs tab shows the
//     simulation attempt even when the pipeline threw.
//
// Returns either:
//   { ok: true, ... } on success (any wallet pipeline outcome)
//   { ok: false, status, code, message, ...meta } on failure

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { processProviderCallback } from '@/lib/providers/wallet';
import { getOrCreateMemberAccount } from '@/lib/providers/player-account';
import { maskPayload } from '@/lib/providers/mask';

export interface SimulateInput {
  providerId: string;
  callerUserId: string;
  gameUid: string;
  userQuery?: string;
  betAmount: number;
  winAmount: number;
  gameRound?: string;
}

export type SimulateOutcome =
  | { ok: false; httpStatus: number; code: string; message: string; meta?: Record<string, unknown> }
  | { ok: true; payload: Record<string, unknown> };

async function logSimulationAttempt(input: {
  providerId: string;
  body: unknown;
  response: unknown;
  error: string | null;
  processedTxId: string | null;
}) {
  return db.providerCallbackLog.create({
    data: {
      providerId: input.providerId,
      ip: 'simulated',
      method: 'POST',
      callbackKeyValid: true,
      ipValid: true,
      timestampValid: true,
      body: (input.body ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      response: (input.response ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      processedTxId: input.processedTxId,
      error: input.error ? input.error.slice(0, 300) : null,
    },
  }).catch(() => null);
}

export async function runSimulation(input: SimulateInput): Promise<SimulateOutcome> {
  const creds = await loadProviderCredsById(input.providerId);
  if (!creds) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'Provider not found.' };
  const adapter = getAdapter(creds.adapterKey);
  if (!adapter) return { ok: false, httpStatus: 500, code: 'ADAPTER_NOT_REGISTERED', message: 'No adapter registered.' };

  console.info('[provider-sim] start', {
    providerId: creds.id,
    providerKey: creds.providerKey,
    gameUid: input.gameUid,
    hasUserQuery: Boolean(input.userQuery),
    betAmount: input.betAmount,
    winAmount: input.winAmount,
    hasGameRound: Boolean(input.gameRound),
  });

  const game = await db.externalGame.findUnique({
    where: { providerId_gameUid: { providerId: creds.id, gameUid: input.gameUid } },
    select: { gameUid: true, displayName: true, status: true },
  });
  const gameCatalogHit = Boolean(game);

  const user = input.userQuery
    ? await db.user.findFirst({
        where: { OR: [{ id: input.userQuery }, { username: input.userQuery }, { phone: input.userQuery }, { email: input.userQuery }] },
        select: { id: true, username: true, email: true, phone: true, status: true },
      })
    : await db.user.findUnique({
        where: { id: input.callerUserId },
        select: { id: true, username: true, email: true, phone: true, status: true },
      });
  if (!user) return { ok: false, httpStatus: 404, code: 'USER_NOT_FOUND', message: 'No user matched the provided query.' };
  if (user.status === 'blocked') return { ok: false, httpStatus: 403, code: 'USER_BLOCKED', message: 'Test user is blocked.' };

  const wallet = await db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } });
  if (!wallet) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'WALLET_NOT_FOUND',
      message: 'The test user has no wallet row. Pick a different test user.',
      meta: { testUser: { id: user.id, username: user.username } },
    };
  }
  const walletBefore = Number(wallet.balance);

  const memberAccount = await getOrCreateMemberAccount(creds.id, user.id);
  console.info('[provider-sim] member', { memberAccount, userId: user.id });

  const simCreds = { ...creds, active: true };

  const gameRound = input.gameRound?.trim()
    || `sim-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const ts = Date.now();

  const callbackBody = {
    game_id: input.gameUid,
    game_uid: input.gameUid,
    game_round: gameRound,
    member_account: memberAccount,
    bet_amount: input.betAmount,
    win_amount: input.winAmount,
    timestamp: ts,
  };

  try {
    const normalized = await adapter.parseCallback(simCreds, {}, callbackBody);
    const result = await processProviderCallback(simCreds, normalized);

    const envelope = adapter.buildCallbackResponse(simCreds, {
      newBalance: result.walletAfter,
      betAmount: normalized.betAmount,
      winAmount: normalized.winAmount,
      responseMode: simCreds.callbackResponseMode,
      ok: result.status === 'accepted' || result.status === 'duplicate',
      errorCode: result.errorCode,
    });

    const idempotencyKey = `${creds.providerKey}:${normalized.gameRound}:${normalized.type}`;
    const providerTx = await db.providerTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });

    const callbackLog = await logSimulationAttempt({
      providerId: creds.id,
      body: maskPayload(callbackBody),
      response: {
        ...(envelope.body as Record<string, unknown>),
        _simulated: 'plain',
        _diagnostics: {
          ...(normalized.diagnostics ?? {}),
          status: result.status,
          errorCode: result.errorCode ?? null,
          userId: result.userId,
          walletBefore,
          walletAfter: result.walletAfter,
          netResult: result.netResult,
          providerActiveOnSimulate: creds.active,
          gameCatalogHit,
        },
      },
      error: result.status === 'rejected' ? (result.errorCode ?? 'REJECTED') : null,
      processedTxId: providerTx?.id ?? null,
    });

    console.info('[provider-sim] result', {
      status: result.status,
      type: normalized.type,
      providerTransactionId: providerTx?.id ?? null,
      callbackLogId: callbackLog?.id ?? null,
      errorCode: result.errorCode ?? null,
    });

    const testUserLabel = user.username || user.email || user.phone || user.id;

    return {
      ok: true,
      payload: {
        status: result.status,
        type: normalized.type,
        errorCode: result.errorCode ?? null,
        providerTransactionId: providerTx?.id ?? null,
        callbackLogId: callbackLog?.id ?? null,
        memberAccount,
        gameRound,
        gameUid: input.gameUid,
        betAmount: input.betAmount,
        winAmount: input.winAmount,
        walletBefore,
        walletAfter: result.walletAfter,
        netResult: result.netResult,
        callbackBody,
        callbackResponse: { status: envelope.status, body: envelope.body },
        diagnostics: normalized.diagnostics ?? null,
        providerActiveOnSimulate: creds.active,
        gameCatalogHit,
        gameDisplayName: game?.displayName ?? null,
        testUser: { id: user.id, username: testUserLabel },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[provider-sim] error', { providerId: creds.id, gameRound, msg });
    const callbackLog = await logSimulationAttempt({
      providerId: creds.id,
      body: maskPayload(callbackBody),
      response: { code: 1, msg: 'SIMULATE_FAILED', error: msg.slice(0, 300) },
      error: `SIMULATE_FAILED: ${msg}`,
      processedTxId: null,
    });
    return {
      ok: false,
      httpStatus: 500,
      code: 'SIMULATE_FAILED',
      message: msg,
      meta: {
        callbackLogId: callbackLog?.id ?? null,
        memberAccount,
        gameRound,
        gameUid: input.gameUid,
        walletBefore,
      },
    };
  }
}
