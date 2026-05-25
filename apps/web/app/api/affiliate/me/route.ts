// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/rbac';
import { withAuth } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { getAffiliateBalance } from '@/lib/affiliate/engine';

export async function GET() {
  return withAuth(async () => {
    const session = await requireUser();

    const user = await db.user.findUniqueOrThrow({
      where: { id: session.sub },
      select: {
        id: true,
        username: true,
        referralCode: true,
        isAffiliate: true,
        affiliateTierId: true,
        affiliateTier: {
          select: { id: true, name: true, description: true, level1Pct: true, level2Pct: true, level3Pct: true },
        },
        affiliateApplication: {
          select: { id: true, status: true, channel: true, audience: true, notes: true, reviewedAt: true, createdAt: true },
        },
      },
    });

    const downlineLevel1 = await db.user.count({ where: { referredById: user.id } });

    // Active count = users referred at level 1 who have at least one transaction record (proxy until M2)
    const activeLevel1 = await db.user.count({
      where: {
        referredById: user.id,
        transactions: { some: {} },
      },
    });

    // Level 2 and 3 counts derived by walking referral chain (no JOIN recursion in Postgres without a CTE)
    const level1Ids = (await db.user.findMany({ where: { referredById: user.id }, select: { id: true } })).map((u) => u.id);
    const level2Ids = level1Ids.length
      ? (await db.user.findMany({ where: { referredById: { in: level1Ids } }, select: { id: true } })).map((u) => u.id)
      : [];
    const level3Count = level2Ids.length
      ? await db.user.count({ where: { referredById: { in: level2Ids } } })
      : 0;

    const totals = await db.affiliateCommission.groupBy({
      by: ['status'],
      where: { affiliateId: user.id },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const sumByStatus: Record<string, number> = {};
    let totalAll = 0;
    for (const row of totals) {
      const n = Number(row._sum.amount ?? 0);
      sumByStatus[row.status] = n;
      totalAll += n;
    }

    const balance = await getAffiliateBalance(user.id);

    const payouts = await db.commissionPayout.findMany({
      where: { affiliateId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const recentCommissions = await db.affiliateCommission.findMany({
      where: { affiliateId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        referralCode: user.referralCode,
        isAffiliate: user.isAffiliate,
        tier: user.affiliateTier,
      },
      application: user.affiliateApplication,
      downline: {
        level1: downlineLevel1,
        level2: level2Ids.length,
        level3: level3Count,
        active: activeLevel1,
      },
      commissions: {
        totalAll,
        pending: sumByStatus.pending ?? 0,
        approved: sumByStatus.approved ?? 0,
        paid: sumByStatus.paid ?? 0,
        cancelled: sumByStatus.cancelled ?? 0,
        withdrawable: balance.withdrawable,
        inFlightPayouts: balance.inFlightPayouts,
      },
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        accountNumber: p.accountNumber,
        accountName: p.accountName,
        status: p.status,
        adminNote: p.adminNote,
        reviewedAt: p.reviewedAt,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      recentCommissions: recentCommissions.map((c) => ({
        id: c.id,
        level: c.level,
        amount: Number(c.amount),
        status: c.status,
        basis: c.basis,
        ratePct: c.ratePct ? Number(c.ratePct) : null,
        createdAt: c.createdAt,
        payoutId: c.payoutId,
      })),
    });
  });
}
