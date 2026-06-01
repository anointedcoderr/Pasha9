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
// Idempotency key is `${providerKey}:${gameRound}` per operator
// requirement until the provider confirms a stronger transaction
// id. If a callback hits us twice we return the stored response
// and the wallet stays untouched.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
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

  const idempotencyKey = `${creds.providerKey}:${normalized.gameRound}`;

  // Replay check OUTSIDE the transaction. If we already have a
  // ProviderTransaction for this key, the caller short-circuits to
  // duplicate without touching the wallet.
  const prior = await db.providerTransaction.findUnique({ where: { idempotencyKey } });
  if (prior) {
    return {
      status: 'duplicate',
      providerTxId: prior.gameRound,
      walletBefore: 0,
      walletAfter: 0,
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

  const bet = dec(normalized.betAmount);
  const win = dec(normalized.winAmount);
  const net = win.sub(bet); // positive = credit, negative = debit

  return await db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
    const before = wallet ? Number(wallet.balance) : 0;

    if (bet.gt(0) && (!wallet || dec(wallet.balance).lt(bet))) {
      const rejected = await tx.providerTransaction.create({
        data: {
          providerId: creds.id,
          userId: user.id,
          memberAccount: normalized.memberAccount,
          gameUid: normalized.gameUid,
          gameRound: normalized.gameRound,
          betAmount: bet,
          winAmount: win,
          netResult: dec(0),
          type: normalized.type,
          status: 'rejected',
          idempotencyKey,
          rawRequest: (normalized.rawBody ?? null) as Prisma.InputJsonValue,
          errorCode: 'INSUFFICIENT_FUNDS',
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

    // 1. Apply net wallet movement.
    let walletTransactionId: string | null = null;
    if (bet.gt(0)) {
      await tx.wallet.update({ where: { userId: user.id }, data: { balance: { decrement: bet } } });
      const t = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'bet',
          status: 'completed',
          amount: bet.neg(),
          reference: normalized.gameRound,
          description: `${creds.name} bet`,
          meta: { providerKey: creds.providerKey, gameUid: normalized.gameUid, gameRound: normalized.gameRound } as Prisma.JsonObject,
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
          meta: { providerKey: creds.providerKey, gameUid: normalized.gameUid, gameRound: normalized.gameRound } as Prisma.JsonObject,
        },
      });
      // Only the first wallet write's id is tracked on the
      // ProviderTransaction row; subsequent ones live on
      // Transaction.reference for audit.
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
        betAmount: bet,
        winAmount: win,
        netResult: net,
        type: normalized.type,
        status: 'accepted',
        idempotencyKey,
        walletTransactionId,
        rawRequest: (normalized.rawBody ?? null) as Prisma.InputJsonValue,
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
}
