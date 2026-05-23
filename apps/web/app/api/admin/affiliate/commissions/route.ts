// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('affiliate.read');
    const status = req.nextUrl.searchParams.get('status');
    const take = Math.min(200, Number(req.nextUrl.searchParams.get('take') ?? 100));

    const where: Record<string, unknown> = {};
    if (status && ['pending', 'approved', 'paid', 'cancelled'].includes(status)) {
      where.status = status;
    }

    const commissions = await db.affiliateCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    const totals = await db.affiliateCommission.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: { _all: true },
    });

    return jsonOk({
      commissions,
      totals: totals.map((row) => ({
        status: row.status,
        count: row._count._all,
        amount: Number(row._sum.amount ?? 0),
      })),
    });
  });
}
