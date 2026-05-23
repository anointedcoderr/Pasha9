// Built by Anointed Coder.
//
// Admin approves a deposit. In one transaction:
//   1. flips the Deposit row to status="approved"
//   2. credits the user's main wallet
//   3. writes a Transaction (deposit / completed)
//   4. runs accrueLotteryTickets to bring the user's ticket count
//      up to floor(totalApproved / 1200) * 2
//
// Idempotent: re-approving an already-approved deposit is a no-op.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { accrueLotteryTickets } from '@/lib/lotto/tickets';

const schema = z.object({
  adminNote: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('deposits.review');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const deposit = await db.deposit.findUnique({ where: { id: params.id } });
    if (!deposit) return jsonError(404, 'NOT_FOUND');
    if (deposit.status === 'approved') {
      return jsonOk({ ok: true, alreadyApproved: true, deposit });
    }
    if (deposit.status === 'rejected') {
      return jsonError(409, 'ALREADY_REJECTED');
    }

    const amount = new Prisma.Decimal(deposit.amount);

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'approved',
          reviewerId: session.sub,
          reviewedAt: new Date(),
          adminNote: parsed.data.adminNote ?? deposit.adminNote,
        },
      });

      // Credit the main wallet (create if missing).
      const wallet = await tx.wallet.findUnique({ where: { userId: deposit.userId } });
      if (wallet) {
        await tx.wallet.update({
          where: { userId: deposit.userId },
          data: { balance: { increment: amount } },
        });
      } else {
        await tx.wallet.create({
          data: { userId: deposit.userId, balance: amount },
        });
      }

      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          type: 'deposit',
          status: 'completed',
          amount,
          reference: deposit.transactionId,
          description: `Deposit ${deposit.method}`,
          meta: { depositId: deposit.id } as Prisma.JsonObject,
        },
      });

      return d;
    });

    // Ticket accrual runs after the transaction so a partial failure
    // here cannot roll back the credited deposit.
    let accrual: { generated: number; targetTotal: number; existing: number } = {
      generated: 0,
      targetTotal: 0,
      existing: 0,
    };
    try {
      accrual = await accrueLotteryTickets(deposit.userId);
    } catch (err) {
      console.error('lottery accrual failed', err);
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_APPROVE',
      target: deposit.id,
      meta: {
        userId: deposit.userId,
        amount: Number(amount),
        ticketsGenerated: accrual.generated,
        targetTotalTickets: accrual.targetTotal,
      },
    });

    return jsonOk({ deposit: updated, accrual });
  });
}
