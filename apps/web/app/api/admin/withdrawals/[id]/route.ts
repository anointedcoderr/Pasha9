// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('withdrawals.read');
    const w = await db.withdrawal.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, username: true, phone: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!w) return jsonError(404, 'NOT_FOUND');

    return jsonOk({
      withdrawal: {
        id: w.id,
        userId: w.userId,
        username: w.user.username,
        phone: w.user.phone,
        amount: Number(w.amount),
        method: w.method,
        accountNumber: w.accountNumber,
        accountName: w.accountName,
        status: w.status,
        processingState: w.processingState,
        providerKey: w.providerKey,
        providerRef: w.providerRef,
        paidAt: w.paidAt,
        reviewerId: w.reviewerId,
        reviewedAt: w.reviewedAt,
        adminNote: w.adminNote,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        events: w.events.map((e) => ({
          id: e.id,
          kind: e.kind,
          actorId: e.actorId,
          actorRole: e.actorRole,
          note: e.note,
          meta: e.meta,
          createdAt: e.createdAt,
        })),
      },
    });
  });
}
