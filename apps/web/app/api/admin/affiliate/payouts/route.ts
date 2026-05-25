// Built by Anointed Coder.
//
// Admin list of CommissionPayout rows. Supports filters by status
// and by affiliate. Used by the Affiliate Payouts tab in /admin/
// affiliate (and a future dedicated /admin/affiliate/payouts page if
// the volume justifies it).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const STATUSES = ['pending', 'approved', 'rejected', 'paid'] as const;

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('affiliate.read');
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const affiliateId = url.searchParams.get('affiliateId');
    const take = Math.min(200, Number(url.searchParams.get('take') ?? 100));

    const where: { status?: string; affiliateId?: string } = {};
    if (status && (STATUSES as readonly string[]).includes(status)) where.status = status;
    if (affiliateId) where.affiliateId = affiliateId;

    const rows = await db.commissionPayout.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take,
      include: {
        _count: { select: { commissions: true } },
      },
    });

    // Hydrate affiliate identity in a second batched query so we do
    // not need a relation field on CommissionPayout.
    const ids = Array.from(new Set(rows.map((r) => r.affiliateId)));
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, phone: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return jsonOk({
      payouts: rows.map((r) => {
        const u = userMap.get(r.affiliateId);
        return {
          id: r.id,
          affiliateId: r.affiliateId,
          affiliateUsername: u?.username ?? null,
          affiliatePhone: u?.phone ?? null,
          amount: Number(r.amount),
          method: r.method,
          accountNumber: r.accountNumber,
          accountName: r.accountName,
          status: r.status,
          adminNote: r.adminNote,
          reviewerId: r.reviewerId,
          reviewedAt: r.reviewedAt,
          paidAt: r.paidAt,
          providerKey: r.providerKey,
          providerRef: r.providerRef,
          commissionCount: r._count.commissions,
          createdAt: r.createdAt,
        };
      }),
    });
  });
}
