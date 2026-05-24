// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';

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

    const updated = await db.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: 'rejected',
        reviewerId: session.sub,
        reviewedAt: new Date(),
        adminNote: parsed.data.adminNote ?? withdrawal.adminNote,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WITHDRAWAL_REJECT',
      target: withdrawal.id,
      meta: { userId: withdrawal.userId, amount: Number(withdrawal.amount) },
    });

    return jsonOk({ withdrawal: updated });
  });
}
