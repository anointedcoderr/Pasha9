// Built by Anointed Coder.
//
// External-provider wallet pipeline. Mirrors the M2F lotto-transfer +
// M3 native-games transactional patterns:
//
//   db.$transaction(tx => {
//     idempotency check    -> short-circuit on duplicate
//     wallet balance check -> rejected on insufficient funds
//     wallet update + Transaction(bet/win) row
//     ProviderTransaction row tagged with the same idempotencyKey
//   })
//
// M3 Phase 3E idempotency:
//   idempotencyKey = `${providerKey}:${gameRound}:${type}`
//
// The type segment is critical. Without it, a BET callback and a
// separate WIN callback for the same game_round collide on the
// same key and the WIN is dropped as duplicate (the bug that
// caused a real player win to be lost). The type segment is one
// of bet / win / settle / rollback derived by the adapter from
// the amounts; same-type replays still collide (correct) and
// different-type events for the same round go through (correct).
//
// Double-debit guard:
//   If a 'settle' or 'win' arrives AFTER an accepted 'bet' or
//   'settle' for the same gameRound, we ONLY apply the win
//   portion of the new callback. The bet portion is treated as
//   already-debited and skipped, even if the provider repeats it
//   in the new body. This keeps the wallet correct when the
//   provider sends bet+win as separate callbacks AND/OR as a
//   combined settle for the same round.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { addTurnover } from '@/lib/bonuses/engine';
import type { NormalizedCallback } from './types';
import type { ProviderCreds } from './credentials';
import { lookupUserIdByMemberAccount } from './player-account';

export interface ProcessResult {
  status: 'accepted' | 'duplicate' | 'rejected';
  errorCode?: 'INSUFFICIENT_FUNDS' | 'USER_NOT_FOUND' | 'USER_BLOCKED' | 'PROVIDER_INACTIVE' | 'MEMBER_ACCOUNT_NOT_FOUND';
  providerTxId: string;
  walletBefore: number;
  walletAfter: number;
  netResult: number;
  userId: string | null;
}

function dec(v: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

/**
 * Member account -> User row. Primary lookup is ProviderPlayerAccount
 * (numeric mapping allocated at launch time). The legacy cuid
 * fallback was removed: callbacks that arrive with a member_account
 * we never mapped are rejected with MEMBER_ACCOUNT_NOT_FOUND and
 * the wallet is left untouched.
 */
async function resolveUser(providerId: string, memberAccount: string): Promise<{ id: string; status: string } | null> {
  if (!memberAccount) return null;
  const userId = await lookupUserIdByMemberAccount(providerId, memberAccount);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  return user ?? null;
}

export async function processProviderCallback(
  creds: ProviderCreds,
  normalized: NormalizedCallback,
): Promise<ProcessResult> {
  if (!creds.active) {
    return {
      status: 'rejected', errorCode: 'PROVIDER_INACTIVE',
      providerTxId: normalized.gameRound, walletBefore: 0, walletAfter: 0, netResult: 0, userId: null,
    };
  }

  // Type-aware idempotency key.
  const idempotencyKey = `${creds.providerKey}:${normalized.gameRound}:${normalized.type}`;

  // Replay check OUTSIDE the transaction. If we already have a
  // ProviderTransaction for this exact (providerKey, gameRound, type),
  // short-circuit as duplicate without touching the wallet.
  const prior = await db.providerTransaction.findUnique({ where: { idempotencyKey } });
  if (prior) {
    return {
      status: 'duplicate',
      providerTxId: prior.gameRound,
      walletBefore: prior.walletBefore ? Number(prior.walletBefore) : 0,
      walletAfter: prior.walletAfter ? Number(prior.walletAfter) : 0,
      netResult: Number(prior.netResult ?? 0),
      userId: prior.userId,
    };
  }

  const user = await resolveUser(creds.id, normalized.memberAccount);
  if (!user) {
    await db.providerTransaction.create({
      data: {
        providerId: creds.id,
        userId: null,
        memberAccount: normalized.memberAccount,
        gameUid: normalized.gameUid,
        gameRound: normalized.gameRound,
        betAmount: dec(normalized.betAmount),
        winAmount: dec(normalized.winAmount),
        netResult: dec(0),
        type: normalized.type,
        status: 'rejected',
        idempotencyKey,
        rawRequest: (normalized.rawBody ?? null) as Prisma.InputJsonValue,
        errorCode: 'MEMBER_ACCOUNT_NOT_FOUND',
      },
    });
    return {
      status: 'rejected', errorCode: 'MEMBER_ACCOUNT_NOT_FOUND',
      providerTxId: normalized.gameRound, walletBefore: 0, walletAfter: 0, netResult: 0, userId: null,
    };
  }
  if (user.status === 'blocked') {
    await db.providerTransaction.create({
      data: {
        providerId: creds.id,
        userId: user.id,
        memberAccount: normalized.memberAccount,
        gameUid: normalized.gameUid,
        gameRound: normalized.gameRound,
        betAmount: dec(normalized.betAmount),
        winAmount: dec(normalized.winAmount),
        netResult: dec(0),
        type: normalized.type,
        status: 'rejected',
        idempotencyKey,
        rawRequest: (normalized.rawBody ?? null) as Prisma.InputJsonValue,
        errorCode: 'USER_BLOCKED',
      },
    });
    return {
      status: 'rejected', errorCode: 'USER_BLOCKED',
      providerTxId: normalized.gameRound, walletBefore: 0, walletAfter: 0, netResult: 0, userId: user.id,
    };
  }

  // Double-debit guard: was the bet for this gameRound already
  // applied by an earlier 'bet' or 'settle' callback?
  const priorBetApplied = (normalized.type === 'win' || normalized.type === 'settle')
    ? Boolean(await db.providerTransaction.findFirst({
        where: {
          providerId: creds.id,
          gameRound: normalized.gameRound,
          status: 'accepted',
          type: { in: ['bet', 'settle'] },
        },
        select: { id: true },
      }))
    : false;

  const rawBet = dec(normalized.betAmount);
  const win = dec(normalized.winAmount);
  // If a prior bet has already been debited for this round and this
  // callback is a win/settle that repeats the bet portion, skip the
  // bet so we do not double-debit.
  const effectiveBet = priorBetApplied && normalized.type !== 'bet' ? dec(0) : rawBet;
  const net = win.sub(effectiveBet);

  const txResult = await db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
    const before = wallet ? Number(wallet.balance) : 0;

    if (effectiveBet.gt(0) && (!wallet || dec(wallet.balance).lt(effectiveBet))) {
      const rejected = await tx.providerTransaction.create({
        data: {
          providerId: creds.id,
          userId: user.id,
          memberAccount: normalized.memberAccount,
          gameUid: normalized.gameUid,
          gameRound: normalized.gameRound,
          betAmount: rawBet,
          winAmount: win,
          netResult: dec(0),
          type: normalized.type,
          status: 'rejected',
          idempotencyKey,
          rawRequest: (normalized.rawBody ?? null) as Prisma.InputJsonValue,
          errorCode: 'INSUFFICIENT_FUNDS',
          walletBefore: dec(before),
          walletAfter: dec(before),
        },
      });
      return {
        status: 'rejected' as const,
        errorCode: 'INSUFFICIENT_FUNDS' as const,
        providerTxId: rejected.gameRound,
        walletBefore: before,
        walletAfter: before,
        netResult: 0,
        userId: user.id,
      };
    }

    // 1. Apply wallet movement.
    let walletTransactionId: string | null = null;
    if (effectiveBet.gt(0)) {
      await tx.wallet.update({ where: { userId: user.id }, data: { balance: { decrement: effectiveBet } } });
      const t = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'bet',
          status: 'completed',
          amount: effectiveBet.neg(),
          reference: normalized.gameRound,
          description: `${creds.name} bet`,
          meta: { providerKey: creds.providerKey, gameUid: normalized.gameUid, gameRound: normalized.gameRound, callbackType: normalized.type } as Prisma.JsonObject,
        },
      });
      walletTransactionId = t.id;
    }
    if (win.gt(0)) {
      await tx.wallet.update({ where: { userId: user.id }, data: { balance: { increment: win } } });
      const t = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'win',
          status: 'completed',
          amount: win,
          reference: normalized.gameRound,
          description: `${creds.name} win`,
          meta: { providerKey: creds.providerKey, gameUid: normalized.gameUid, gameRound: normalized.gameRound, callbackType: normalized.type } as Prisma.JsonObject,
        },
      });
      walletTransactionId = walletTransactionId ?? t.id;
    }

    const after = await tx.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } });
    const afterNum = after ? Number(after.balance) : before;

    await tx.providerTransaction.create({
      data: {
        providerId: creds.id,
        userId: user.id,
        memberAccount: normalized.memberAccount,
        gameUid: normalized.gameUid,
        gameRound: normalized.gameRound,
        // Persist the RAW amounts the provider sent for auditability.
        // netResult reflects what was actually applied (post double-
        // debit guard) so the GGR aggregate stays correct.
        betAmount: rawBet,
        winAmount: win,
        netResult: net,
        type: normalized.type,
        status: 'accepted',
        idempotencyKey,
        walletTransactionId,
        rawRequest: (normalized.rawBody ?? null) as Prisma.InputJsonValue,
        walletBefore: dec(before),
        walletAfter: dec(afterNum),
      },
    });

    return {
      status: 'accepted' as const,
      providerTxId: normalized.gameRound,
      walletBefore: before,
      walletAfter: afterNum,
      netResult: Number(net),
      userId: user.id,
    };
  });

  // Bonus turnover is applied OUTSIDE the wallet transaction so that
  // a misbehaving bonus engine cannot roll back a settled provider
  // bet. We only contribute on accepted bet-bearing rows where the
  // bet actually moved the wallet (so a 'settle' or 'win' callback
  // following a prior 'bet' does NOT double-count turnover).
  // Duplicates, rejections, and rollback callbacks all skip.
  if (txResult.status === 'accepted' && effectiveBet.gt(0) && normalized.type !== 'rollback') {
    try {
      await addTurnover({
        userId: user.id,
        amount: Number(effectiveBet),
        kind: 'provider_game',
        reference: normalized.gameRound,
        meta: {
          providerKey: creds.providerKey,
          gameUid: normalized.gameUid ?? null,
          providerTxId: txResult.providerTxId,
          callbackType: normalized.type,
        } as Prisma.JsonObject,
      });
    } catch (err) {
      console.error('[providers/wallet] addTurnover failed', { gameRound: normalized.gameRound, err });
    }
  }

  return txResult;
}
