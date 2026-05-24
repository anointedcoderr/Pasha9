// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('withdrawals.read');
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const take = Math.min(200, Number(url.searchParams.get('take') ?? 100));

    const where: { status?: 'pending' | 'approved' | 'rejected' } = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status as 'pending' | 'approved' | 'rejected';
    }

    const rows = await db.withdrawal.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take,
      include: { user: { select: { id: true, username: true, phone: true } } },
    });

    return jsonOk({
      withdrawals: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        username: r.user.username,
        phone: r.user.phone,
        amount: Number(r.amount),
        method: r.method,
        accountNumber: r.accountNumber,
        accountName: r.accountName,
        status: r.status,
        adminNote: r.adminNote,
        reviewerId: r.reviewerId,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
      })),
    });
  });
}
