// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/callback-logs/[logId]/manual-repair
// Body: { userQuery, gameRound?, gameUid?, betAmount, winAmount, reason }
//
// Super-admin wallet correction tied to a specific
// ProviderCallbackLog row. Use case: an old callback whose
// encrypted payload was lost to the previous masking behaviour
// (cannot be Reprocessed). The admin reconstructs the round from
// memory + provider portal, picks the affected user, and credits
// or debits the wallet by a single amount inside db.$transaction.
//
// Idempotency: the ProviderCallbackLog.response object is mutated
// to record _manualRepair { actorId, at, reason, amount,
// adjustTransactionId }. A second attempt against the same log
// returns 409 ALREADY_REPAIRED.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireSuperAdmin } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const schema = z.object({
  userQuery: z.string().trim().min(1).max(160),
  gameRound: z.string().trim().max(120).optional().or(z.literal('')),
  gameUid: z.string().trim().max(120).optional().or(z.literal('')),
  betAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  winAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  reason: z.string().trim().min(3).max(500),
});

function dec(v: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

async function resolveUserByQuery(q: string) {
  const v = q.trim();
  if (!v) return null;
  return db.user.findFirst({
    where: { OR: [{ id: v }, { username: v }, { phone: v }, { email: v }] },
    select: { id: true, username: true, status: true },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string; logId: string } }) {
  return withAuth(async () => {
    const claims = await requireSuperAdmin();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true, name: true, providerKey: true } });
    if (!provider) return jsonError(404, 'PROVIDER_NOT_FOUND');

    const log = await db.providerCallbackLog.findUnique({ where: { id: params.logId } });
    if (!log || log.providerId !== provider.id) return jsonError(404, 'LOG_NOT_FOUND');

    // Idempotency: refuse a second manual repair on the same row.
    const existingResponse = (log.response && typeof log.response === 'object' ? log.response as Record<string, unknown> : {});
    if (existingResponse._manualRepair) return jsonError(409, 'ALREADY_REPAIRED');

    const user = await resolveUserByQuery(parsed.data.userQuery);
    if (!user) return jsonError(404, 'USER_NOT_FOUND', `No user matches "${parsed.data.userQuery}".`);
    if (user.status === 'blocked') return jsonError(403, 'USER_BLOCKED');

    const bet = dec(parsed.data.betAmount);
    const win = dec(parsed.data.winAmount);
    const delta = win.sub(bet); // signed wallet movement: positive = credit, negative = debit

    if (delta.eq(0)) {
      return jsonError(400, 'NO_NET_DELTA', 'Bet and win cancel out. Nothing to apply.');
    }

    const result = await db.$transaction(async (txdb) => {
      const wallet = await txdb.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) throw new Error('WALLET_NOT_FOUND');
      const before = dec(wallet.balance);
      const after = before.add(delta);
      if (after.lt(0)) throw new Error('WOULD_NEGATIVE');

      await txdb.wallet.update({
        where: { userId: user.id },
        data: { balance: { increment: delta } },
      });

      const adjustTx = await txdb.transaction.create({
        data: {
          userId: user.id,
          type: 'adjust',
          status: 'completed',
          amount: delta,
          reference: parsed.data.gameRound || log.id,
          description: `${provider.name} manual repair: ${parsed.data.reason}`.slice(0, 240),
          meta: {
            providerKey: provider.providerKey ?? null,
            callbackLogId: log.id,
            gameRound: parsed.data.gameRound || null,
            gameUid: parsed.data.gameUid || null,
            bet: Number(bet),
            win: Number(win),
            delta: Number(delta),
            reason: parsed.data.reason,
            mode: 'manual_repair',
          } as Prisma.JsonObject,
        },
      });

      // Stamp the original callback log with the repair marker so
      // a second attempt returns 409. We merge into existing
      // response JSON to keep the diagnostic block.
      const mergedResponse = {
        ...existingResponse,
        _manualRepair: {
          actorId: claims.sub,
          at: new Date().toISOString(),
          userId: user.id,
          gameRound: parsed.data.gameRound || null,
          gameUid: parsed.data.gameUid || null,
          bet: Number(bet),
          win: Number(win),
          delta: Number(delta),
          reason: parsed.data.reason,
          adjustTransactionId: adjustTx.id,
          walletBefore: Number(before),
          walletAfter: Number(after),
        },
      };
      await txdb.providerCallbackLog.update({
        where: { id: log.id },
        data: { response: mergedResponse as Prisma.InputJsonValue },
      });

      return {
        before: Number(before),
        after: Number(after),
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
      if (result.error === 'WOULD_NEGATIVE') return jsonError(409, 'WOULD_NEGATIVE', 'Repair would push the wallet below zero.');
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_CALLBACK_MANUAL_REPAIR',
      target: log.id,
      meta: {
        providerKey: provider.providerKey ?? null,
        callbackLogId: log.id,
        userId: user.id,
        gameRound: parsed.data.gameRound || null,
        gameUid: parsed.data.gameUid || null,
        bet: Number(bet),
        win: Number(win),
        delta: Number(delta),
        walletBefore: result.before,
        walletAfter: result.after,
        reason: parsed.data.reason,
      },
    });

    return jsonOk({
      adjustTransactionId: result.adjustTxId,
      walletBefore: result.before,
      walletAfter: result.after,
      delta: Number(delta),
      user: { id: user.id, username: user.username },
    });
  });
}
