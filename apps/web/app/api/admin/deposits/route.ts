// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('deposits.read');
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const take = Math.min(200, Number(url.searchParams.get('take') ?? 100));

    const where: { status?: 'pending' | 'approved' | 'rejected' } = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status as 'pending' | 'approved' | 'rejected';
    }

    const rows = await db.deposit.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take,
      include: { user: { select: { id: true, username: true, phone: true } } },
    });

    return jsonOk({
      deposits: rows.map((r) => {
        const amount = Number(r.amount);
        const bonusAmount = r.bonusAmount == null ? 0 : Number(r.bonusAmount);
        return {
          id: r.id,
          userId: r.userId,
          username: r.user.username,
          phone: r.user.phone,
          amount,
          // M4 Phase C: bonus snapshot taken at submit time.
          bonusPercentage: r.bonusPercentage == null ? 0 : Number(r.bonusPercentage),
          bonusAmount,
          totalCredit: amount + bonusAmount,
          method: r.method,
          transactionId: r.transactionId,
          proofUrl: r.proofUrl,
          status: r.status,
          adminNote: r.adminNote,
          rejectionReason: r.rejectionReason,
          reviewerId: r.reviewerId,
          reviewedAt: r.reviewedAt,
          createdAt: r.createdAt,
        };
      }),
    });
  });
}
