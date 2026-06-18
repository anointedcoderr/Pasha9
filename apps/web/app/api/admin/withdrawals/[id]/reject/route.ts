// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { notifyWithdrawalRejected } from '@/lib/notifications/notify';

const schema = z.object({ adminNote: z.string().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('withdrawals.review');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const withdrawal = await db.withdrawal.findUnique({ where: { id: params.id } });
    if (!withdrawal) return jsonError(404, 'NOT_FOUND');
    if (withdrawal.status === 'rejected') {
      return jsonOk({ ok: true, alreadyRejected: true, withdrawal });
    }
    if (withdrawal.status === 'approved') {
      return jsonError(409, 'ALREADY_APPROVED');
    }

    const updated = await db.$transaction(async (tx) => {
      const w = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'rejected',
          processingState: null,
          reviewerId: session.sub,
          reviewedAt: new Date(),
          adminNote: parsed.data.adminNote ?? withdrawal.adminNote,
        },
      });
      await tx.withdrawalEvent.create({
        data: {
          withdrawalId: withdrawal.id,
          kind: 'rejected',
          actorId: session.sub,
          actorRole: session.role,
          note: parsed.data.adminNote || 'Rejected by admin.',
        },
      });
      return w;
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WITHDRAWAL_REJECT',
      target: withdrawal.id,
      meta: { userId: withdrawal.userId, amount: Number(withdrawal.amount) },
    });

    try {
      await notifyWithdrawalRejected({
        userId: withdrawal.userId,
        amount: Number(withdrawal.amount),
        reason: parsed.data.adminNote ?? null,
        withdrawalId: withdrawal.id,
      });
    } catch (err) {
      console.error('[withdrawal-reject] notify failed', err);
    }

    return jsonOk({ withdrawal: updated });
  });
}
