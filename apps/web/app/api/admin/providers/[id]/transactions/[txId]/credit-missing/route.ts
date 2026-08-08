// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/transactions/[txId]/credit-missing
// Body: { amount: number, reason: string }
//
// Super-admin manual credit for a missing win on a provider
// transaction. The use case is the bug we hit before the type-
// aware idempotency landed: a WIN callback that was wrongly
// short-circuited as duplicate left an accepted ProviderTransaction
// row with netResult that did not match the actual wallet movement.
// This endpoint applies a one-time adjusting credit, links it
// back to the ProviderTransaction via repairTransactionId, and
// refuses to repair the same row twice.
//
// We do NOT call the provider. This is wallet correction inside
// Pasha 9 only, parallel to /rollback.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireSuperAdmin } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';

const schema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  reason: z.string().trim().min(3).max(500),
});

function dec(v: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

export async function POST(req: NextRequest, { params }: { params: { id: string; txId: string } }) {
  return withAuth(async () => {
    const claims = await requireSuperAdmin();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true, name: true, providerKey: true } });
    if (!provider) return jsonError(404, 'PROVIDER_NOT_FOUND');

    const tx = await db.providerTransaction.findUnique({ where: { id: params.txId } });
    if (!tx || tx.providerId !== provider.id) return jsonError(404, 'TRANSACTION_NOT_FOUND');
    if (tx.repairedAt) return jsonError(409, 'ALREADY_REPAIRED');
    if (tx.rolledBackAt) return jsonError(409, 'ALREADY_ROLLED_BACK');
    if (!tx.userId) return jsonError(409, 'NO_WALLET_OWNER', 'This transaction has no resolved user.');

    const amount = dec(parsed.data.amount);

    const result = await db.$transaction(async (txdb) => {
      const wallet = await txdb.wallet.findUnique({ where: { userId: tx.userId! } });
      if (!wallet) throw new Error('WALLET_NOT_FOUND');
      const before = dec(wallet.balance);

      await applyWalletMovement({
        tx: txdb,
        userId: tx.userId!,
        amount,
        type: LEDGER_TYPE.providerWin,
        description: 'Missing provider win credited manually',
        providerTransactionId: tx.id,
        roundId: tx.gameRound,
        gameUid: tx.gameUid,
        actorId: claims.sub,
        actorRole: claims.role,
        meta: { providerTxId: tx.id } as Prisma.JsonObject,
      });

      const adjustTx = await txdb.transaction.create({
        data: {
          userId: tx.userId!,
          type: 'adjust',
          status: 'completed',
          amount,
          reference: tx.gameRound,
          description: `${provider.name} missing win credit: ${parsed.data.reason}`.slice(0, 240),
          meta: {
            providerKey: provider.providerKey ?? null,
            providerTxId: tx.id,
            originalBet: Number(tx.betAmount),
            originalWin: Number(tx.winAmount),
            creditAmount: Number(amount),
            reason: parsed.data.reason,
            mode: 'credit_missing',
          } as Prisma.JsonObject,
        },
      });

      await txdb.providerTransaction.update({
        where: { id: tx.id },
        data: {
          repairedAt: new Date(),
          repairedBy: claims.sub,
          repairReason: parsed.data.reason,
          repairAmount: amount,
          repairTransactionId: adjustTx.id,
        },
      });

      const after = before.add(amount);
      return {
        before: Number(before),
        after: Number(after),
        adjustTxId: adjustTx.id,
      };
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'WALLET_NOT_FOUND') return { error: 'WALLET_NOT_FOUND' as const };
      throw err;
    });

    if ('error' in result) return jsonError(404, 'WALLET_NOT_FOUND');

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_TX_REPAIR_CREDIT',
      target: tx.id,
      meta: {
        providerKey: provider.providerKey ?? null,
        gameRound: tx.gameRound,
        userId: tx.userId,
        creditAmount: Number(amount),
        balanceBefore: result.before,
        balanceAfter: result.after,
        reason: parsed.data.reason,
      },
    });

    return jsonOk({
      providerTxId: tx.id,
      adjustTransactionId: result.adjustTxId,
      creditAmount: Number(amount),
      walletBefore: result.before,
      walletAfter: result.after,
    });
  });
}
