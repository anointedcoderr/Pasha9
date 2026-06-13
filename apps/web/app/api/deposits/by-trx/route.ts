// Built by Anointed Coder.
//
// GET /api/deposits/by-trx?trx=PAY-XXXXXXXX
//
// Lookup endpoint the deposit-result polling page uses to track a
// gateway deposit through the webhook approval. Returns the row only
// when it belongs to the requesting user so a player cannot probe
// another player's pending deposits.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { requireActiveUser } from '@/lib/auth/rbac';
import { withAuth } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const url = new URL(req.url);
    const trx = (url.searchParams.get('trx') ?? '').trim();
    if (!trx) return jsonError(400, 'VALIDATION', 'trx parameter required');

    const row = await db.deposit.findFirst({
      where: { userId: session.sub, transactionId: trx },
      select: {
        id: true,
        transactionId: true,
        amount: true,
        status: true,
        method: true,
        bonusAmount: true,
        rejectionReason: true,
        createdAt: true,
        reviewedAt: true,
      },
    });
    if (!row) return jsonError(404, 'NOT_FOUND');
    return jsonOk({
      deposit: {
        id: row.id,
        transactionId: row.transactionId,
        amount: Number(row.amount),
        status: row.status,
        method: row.method,
        bonusAmount: row.bonusAmount == null ? 0 : Number(row.bonusAmount),
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt,
      },
    });
  });
}
