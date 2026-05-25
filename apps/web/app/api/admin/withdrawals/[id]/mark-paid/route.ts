// Built by Anointed Coder.
//
// Admin records that an approved withdrawal has been paid out of band
// (manual flow). Sets Withdrawal.processingState='paid' + paidAt,
// stores the operator-supplied provider tx id, writes a WithdrawalEvent
// row. Idempotent: re-running on an already-paid row is a no-op.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  providerKey: z.string().trim().max(60).optional().nullable(),
  providerRef: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('withdrawals.review');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const w = await db.withdrawal.findUnique({ where: { id: params.id } });
    if (!w) return jsonError(404, 'NOT_FOUND');
    if (w.status !== 'approved') {
      return jsonError(409, 'NOT_APPROVED', 'Mark Paid only applies to approved withdrawals.');
    }
    if (w.processingState === 'paid') {
      return jsonOk({ ok: true, alreadyPaid: true, withdrawal: w });
    }

    const updated = await db.$transaction(async (tx) => {
      const updatedRow = await tx.withdrawal.update({
        where: { id: w.id },
        data: {
          processingState: 'paid',
          paidAt: new Date(),
          providerKey: parsed.data.providerKey ?? 'manual',
          providerRef: parsed.data.providerRef ?? null,
        },
      });
      await tx.withdrawalEvent.create({
        data: {
          withdrawalId: w.id,
          kind: 'paid',
          actorId: session.sub,
          actorRole: session.role,
          note: parsed.data.note || 'Marked paid by admin.',
          meta: {
            providerKey: parsed.data.providerKey ?? 'manual',
            providerRef: parsed.data.providerRef ?? null,
          },
        },
      });
      return updatedRow;
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WITHDRAWAL_PAID',
      target: w.id,
      meta: { providerKey: parsed.data.providerKey ?? 'manual', providerRef: parsed.data.providerRef ?? null },
    });

    return jsonOk({ withdrawal: updated });
  });
}
