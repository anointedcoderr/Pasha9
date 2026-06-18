// Built by Anointed Coder.
//
// M4 Phase C: rejectionReason is now REQUIRED. Empty / whitespace
// returns 400 REASON_REQUIRED. The reason is stored on
// Deposit.rejectionReason so the player can see it in their deposit
// history. adminNote remains a separate, optional, internal-only
// freetext field.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { sendSms } from '@/lib/sms/service';
import { notifyDepositRejected } from '@/lib/notifications/notify';

const schema = z.object({
  rejectionReason: z.string().trim().min(3, 'Provide a clear reason').max(500),
  adminNote: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('deposits.review');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue?.path?.[0];
      if (path === 'rejectionReason') {
        return jsonError(400, 'REASON_REQUIRED', firstIssue?.message ?? 'Rejection reason is required.');
      }
      return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    }

    const deposit = await db.deposit.findUnique({ where: { id: params.id } });
    if (!deposit) return jsonError(404, 'NOT_FOUND');
    if (deposit.status === 'rejected') {
      return jsonOk({ ok: true, alreadyRejected: true, deposit });
    }
    if (deposit.status === 'approved') {
      return jsonError(409, 'ALREADY_APPROVED');
    }

    const updated = await db.deposit.update({
      where: { id: deposit.id },
      data: {
        status: 'rejected',
        reviewerId: session.sub,
        reviewedAt: new Date(),
        rejectionReason: parsed.data.rejectionReason,
        adminNote: parsed.data.adminNote ?? deposit.adminNote,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_REJECT',
      target: deposit.id,
      meta: {
        userId: deposit.userId,
        amount: Number(deposit.amount),
        rejectionReason: parsed.data.rejectionReason,
      },
    });

    // Best-effort SMS so the player sees the rejection alongside the
    // reason. Fails silently to keep the admin action durable.
    try {
      const user = await db.user.findUnique({ where: { id: deposit.userId }, select: { phone: true } });
      if (user?.phone) {
        await sendSms({
          phone: user.phone,
          userId: deposit.userId,
          template: 'deposit_rejected',
          triggerKey: `deposit:rejected:${deposit.id}`,
          body: `Pasha 9: Your deposit was rejected. Reason: ${parsed.data.rejectionReason.slice(0, 140)}.`,
        });
      }
      await notifyDepositRejected({
        userId: deposit.userId,
        amount: Number(deposit.amount),
        reason: parsed.data.rejectionReason ?? null,
        depositId: deposit.id,
      });
    } catch (err) {
      console.error('[deposit-reject] notify failed', err);
    }

    return jsonOk({ deposit: updated });
  });
}
