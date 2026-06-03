// Built by Anointed Coder.
//
// POST /api/lotto/winnings/[id]/claim
//
// Player claim for a single LotteryWinning row. Only valid when the
// row's status is 'pending_credit' (manual claim mode at settlement
// time). Auto-credit settlements leave nothing pending so this
// endpoint returns NOT_PENDING for those.
//
// Idempotency: the wallet credit happens inside a db.$transaction
// with an updateMany guarded by status='pending_credit'. A second
// click finds the row already in 'credited' and returns
// ALREADY_CLAIMED. Rate-limited at 12 calls per 5 min per user.

export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`lotto-claim:${session.sub}`, 12, 5 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const winning = await db.lotteryWinning.findUnique({ where: { id: params.id } });
    if (!winning) return jsonError(404, 'NOT_FOUND');
    if (winning.userId !== session.sub) return jsonError(403, 'NOT_OWNER');
    if (winning.status === 'credited') return jsonError(409, 'ALREADY_CLAIMED');
    if (winning.status !== 'pending_credit') return jsonError(409, 'NOT_PENDING', 'This winning is not awaiting a claim.');

    const amount = new Prisma.Decimal(winning.amount);
    const now = new Date();

    try {
      const out = await db.$transaction(async (tx) => {
        // Reserve the row atomically. Subsequent clicks find the row
        // already in 'credited' and exit before the wallet write.
        const reserved = await tx.lotteryWinning.updateMany({
          where: { id: winning.id, status: 'pending_credit' },
          data: { status: 'credited', creditedAt: now },
        });
        if (reserved.count !== 1) {
          throw new Error('ALREADY_CLAIMED_RACE');
        }

        // Credit Wallet.lottoBalance the same way auto-credit
        // settlement does. The player walks /api/lotto/transfer to
        // move it onward to the main balance.
        const wallet = await tx.wallet.findUnique({ where: { userId: winning.userId } });
        if (wallet) {
          await tx.wallet.update({
            where: { userId: winning.userId },
            data: { lottoBalance: { increment: amount } },
          });
        } else {
          await tx.wallet.create({
            data: { userId: winning.userId, lottoBalance: amount },
          });
        }

        // Audit the credit in the canonical Transaction ledger so
        // /dashboard/transactions shows the claim instantly.
        const txRow = await tx.transaction.create({
          data: {
            userId: winning.userId,
            type: 'win',
            status: 'completed',
            amount,
            reference: winning.id,
            description: `Lotto winning ${winning.ticketNumber} (${winning.prizeTier})`,
            meta: {
              lotteryWinningId: winning.id,
              resultId: winning.resultId,
              prizeTier: winning.prizeTier,
              ticketId: winning.ticketId,
              source: 'lotto_claim',
            } as Prisma.JsonObject,
          },
        });

        return { walletTxId: txRow.id };
      });

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'LOTTO_WINNING_CLAIM',
        target: params.id,
        meta: {
          amount: Number(amount),
          prizeTier: winning.prizeTier,
          ticketNumber: winning.ticketNumber,
          walletTxId: out.walletTxId,
        },
      });

      return jsonOk({
        ok: true,
        amount: Number(amount),
        prizeTier: winning.prizeTier,
        walletTxId: out.walletTxId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'ALREADY_CLAIMED_RACE') {
        return jsonError(409, 'ALREADY_CLAIMED');
      }
      console.error('[lotto/winnings/claim] failed', err);
      return jsonError(500, 'CLAIM_FAILED', msg);
    }
  });
}
