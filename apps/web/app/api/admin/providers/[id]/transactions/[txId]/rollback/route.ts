// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/transactions/[txId]/rollback
// Body: { reason: string }
//
// Super-admin only. Reverses a single accepted ProviderTransaction
// inside Pasha 9: writes an `adjust` Transaction row for the
// opposite of the original net delta, updates the wallet by the
// same amount in the same db.$transaction, and marks the row as
// rolled_back. We do NOT call the provider's upstream rollback API
// because its semantics are unconfirmed; this is internal wallet
// correction only.
//
// Idempotent: a second call returns 409 ALREADY_ROLLED_BACK.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireSuperAdmin } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const schema = z.object({
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
    if (tx.status === 'rolled_back') return jsonError(409, 'ALREADY_ROLLED_BACK');
    if (tx.status !== 'accepted') return jsonError(409, 'NOT_ROLLBACKABLE', `Only accepted transactions can be rolled back. Current status: ${tx.status}.`);
    if (!tx.userId) return jsonError(409, 'NO_WALLET_OWNER', 'This transaction has no resolved user; nothing to refund.');

    // Original wallet impact uses the row's stored netResult, which
    // is the EXACT signed delta the settlement applied (post double-
    // debit guard, see lib/providers/wallet.ts:247-251). Recomputing
    // it here as winAmount - betAmount was wrong whenever the
    // double-debit guard suppressed the bet leg of a SETTLE callback
    // that followed a prior BET callback for the same gameRound:
    // betAmount=100 winAmount=150 stored, but the settlement only
    // applied +150 (effectiveBet=0). The old recompute treated the
    // delta as 150-100=50 and clawed back too little, leaving the
    // wallet 100 BDT richer than it should have been. Using
    // netResult mirrors what actually moved.
    const bet = dec(tx.betAmount);
    const win = dec(tx.winAmount);
    const originalImpact = dec(tx.netResult);     // signed wallet delta the settlement actually applied
    const adjustDelta = originalImpact.neg();     // what we apply now to undo it

    const result = await db.$transaction(async (txdb) => {
      const wallet = await txdb.wallet.findUnique({ where: { userId: tx.userId! } });
      if (!wallet) {
        throw new Error('WALLET_NOT_FOUND');
      }
      const balanceBefore = dec(wallet.balance);
      const balanceAfter = balanceBefore.add(adjustDelta);
      if (balanceAfter.lt(0)) {
        // Clawing back a win the player has already withdrawn would
        // produce a negative balance. Refuse rather than silently
        // permitting it.
        throw new Error('WOULD_NEGATIVE');
      }

      await txdb.wallet.update({
        where: { userId: tx.userId! },
        data: { balance: { increment: adjustDelta } },
      });

      const adjustTx = await txdb.transaction.create({
        data: {
          userId: tx.userId!,
          type: 'adjust',
          status: 'completed',
          amount: adjustDelta,
          reference: tx.gameRound,
          description: `${provider.name} rollback: ${parsed.data.reason}`.slice(0, 240),
          meta: {
            providerKey: provider.providerKey ?? null,
            providerTxId: tx.id,
            originalBet: Number(bet),
            originalWin: Number(win),
            adjustDelta: Number(adjustDelta),
            reason: parsed.data.reason,
          } as Prisma.JsonObject,
        },
      });

      await txdb.providerTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'rolled_back',
          rolledBackAt: new Date(),
          rolledBackBy: claims.sub,
          rollbackReason: parsed.data.reason,
          rollbackTransactionId: adjustTx.id,
        },
      });

      return {
        balanceBefore: Number(balanceBefore),
        balanceAfter: Number(balanceAfter),
        adjustTxId: adjustTx.id,
      };
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'WALLET_NOT_FOUND') return { error: 'WALLET_NOT_FOUND' as const };
      if (msg === 'WOULD_NEGATIVE') return { error: 'WOULD_NEGATIVE' as const };
      throw err;
    });

    if ('error' in result) {
      if (result.error === 'WALLET_NOT_FOUND') return jsonError(404, 'WALLET_NOT_FOUND');
      if (result.error === 'WOULD_NEGATIVE') return jsonError(409, 'WOULD_NEGATIVE', 'Rollback would push the wallet below zero. Handle this manually.');
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_TX_ROLLBACK',
      target: tx.id,
      meta: {
        providerKey: provider.providerKey ?? null,
        gameRound: tx.gameRound,
        userId: tx.userId,
        bet: Number(bet),
        win: Number(win),
        adjustDelta: Number(adjustDelta),
        balanceBefore: (result as { balanceBefore: number }).balanceBefore,
        balanceAfter: (result as { balanceAfter: number }).balanceAfter,
        reason: parsed.data.reason,
      },
    });

    return jsonOk({
      providerTxId: tx.id,
      status: 'rolled_back',
      adjustTransactionId: (result as { adjustTxId: string }).adjustTxId,
      adjustDelta: Number(adjustDelta),
      walletBefore: (result as { balanceBefore: number }).balanceBefore,
      walletAfter: (result as { balanceAfter: number }).balanceAfter,
    });
  });
}
