// Built by Anointed Coder.
//
// POST /api/admin/users/[id]/balance
//
// Operator-side wallet adjustment. Body: { amount, reason, type? }.
//   amount  signed Decimal in BDT. Positive credits the wallet,
//           negative debits it. The endpoint refuses a debit that
//           would push the wallet below zero.
//   reason  short free-text logged on the Transaction.description and
//           ActivityLog.detail so audit can trace why.
//   type    optional override of the Transaction.type. Defaults to
//           'adjust'. Restricted to a small allow-list.
//
// One atomic transaction: wallet update + Transaction row + audit
// log entry, so an adjustment cannot half-land.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';

const schema = z.object({
  amount: z.coerce.number().refine((v) => Number.isFinite(v) && v !== 0, 'Amount must be non-zero'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters.').max(240),
  type: z.enum(['adjust', 'bonus', 'referral']).optional().default('adjust'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.balance.adjust');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const target = await db.user.findUnique({
      where: { id: params.id },
      select: { id: true, username: true, wallet: { select: { balance: true } } },
    });
    if (!target) return jsonError(404, 'NOT_FOUND', 'User not found.');

    const before = Number(target.wallet?.balance ?? 0);
    const amount = parsed.data.amount;
    const after = before + amount;
    if (after < 0) {
      return jsonError(409, 'INSUFFICIENT_BALANCE', `Debit of ${Math.abs(amount)} BDT would push balance below zero (current ${before}).`);
    }

    const result = await db.$transaction(async (tx) => {
      const txRow = await tx.transaction.create({
        data: {
          userId: params.id,
          type: parsed.data.type,
          amount: new Prisma.Decimal(amount),
          status: 'completed',
          description: parsed.data.reason,
          meta: {
            adjustedBy: session.sub,
            balanceBefore: before,
            balanceAfter: after,
          } as Prisma.JsonObject,
        },
      });

      // Routed through the central wallet service rather than updating the
      // balance here: it applies the movement and writes the permanent ledger
      // entry in this same transaction, so a manual operator adjustment can
      // never move money without recording who did it, why, and the balance
      // either side of it. That was the client's explicit requirement for
      // manual credit/debit, and it is the one movement with no automatic
      // source to trace it back to.
      const ledger = await applyWalletMovement({
        tx,
        userId: params.id,
        amount: new Prisma.Decimal(amount),
        type: amount > 0 ? LEDGER_TYPE.adminCredit : LEDGER_TYPE.adminDebit,
        description: parsed.data.reason,
        transactionId: txRow.id,
        referenceId: txRow.id,
        actorId: session.sub,
        actorRole: session.role,
        meta: { adjustmentType: parsed.data.type } as Prisma.JsonObject,
      });

      return { transactionId: txRow.id, ledgerId: ledger.id, before, after };
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: amount > 0 ? 'BALANCE_CREDIT' : 'BALANCE_DEBIT',
      target: params.id,
      detail: parsed.data.reason.slice(0, 240),
      meta: {
        username: target.username,
        amount,
        balanceBefore: result.before,
        balanceAfter: result.after,
        transactionId: result.transactionId,
      },
    });

    return jsonOk({
      ok: true,
      transactionId: result.transactionId,
      balance: { before: result.before, after: result.after },
    });
  });
}
