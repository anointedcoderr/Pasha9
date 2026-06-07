// Built by Anointed Coder.
//
// GET /api/admin/referrals/overview
//
// At-a-glance referral health for /admin/referrals. Pulls every
// number from real tables (User chain + AffiliateCommission):
//   - totals across approved + paid + pending commissions
//   - claimable derived from ReferralBalance projections
//   - top referrers ranked by earned (approved+paid) amount
//   - recent commission rows joined to User for human-readable
//     referrer + referred usernames

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { loadReferralSettings } from '@/lib/affiliate/balance';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('affiliate.read');

    const settings = await loadReferralSettings();
    const cutoff = new Date(Date.now() - settings.holdDays * 86_400_000);
    // Aggregates over the canonical commission ledger so the overview
    // does not depend on a previously-run balance projection sweep.
    const [totalInvited, sumEarned, sumPaid, sumClaimable] = await Promise.all([
      db.user.count({ where: { referredById: { not: null } } }),
      db.affiliateCommission.aggregate({ where: { status: { not: 'cancelled' } }, _sum: { amount: true } }),
      db.affiliateCommission.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
      db.affiliateCommission.aggregate({
        where: { status: 'approved', payoutId: null, createdAt: { lte: cutoff } },
        _sum: { amount: true },
      }),
    ]);

    const totalEarned = Number(sumEarned._sum.amount ?? 0);
    const paid = Number(sumPaid._sum.amount ?? 0);
    const claimable = Number(sumClaimable._sum.amount ?? 0);
    const pending = Math.max(0, totalEarned - paid - claimable);

    // Top 6 referrers ranked by earned (approved + paid) commission.
    const topGroups = await db.affiliateCommission.groupBy({
      by: ['affiliateId'],
      where: { status: { in: ['approved', 'paid'] } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 6,
    });
    const topUsers = topGroups.length > 0
      ? await db.user.findMany({
          where: { id: { in: topGroups.map((g) => g.affiliateId) } },
          select: { id: true, username: true, _count: { select: { referrals: true } } },
        })
      : [];
    const topUserById = new Map(topUsers.map((u) => [u.id, u]));
    const topReferrers = topGroups.map((g) => {
      const u = topUserById.get(g.affiliateId);
      return {
        affiliateId: g.affiliateId,
        username: u?.username ?? 'unknown',
        activeReferrals: u?._count.referrals ?? 0,
        earned: Number(g._sum.amount ?? 0),
      };
    });

    // Latest 30 commissions joined to upline + source user for human
    // readable display.
    const recent = await db.affiliateCommission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        level: true,
        amount: true,
        status: true,
        createdAt: true,
        affiliateId: true,
        sourceUserId: true,
      },
    });
    const userIds = Array.from(new Set(recent.flatMap((r) => [r.affiliateId, r.sourceUserId])));
    const userRows = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true },
        })
      : [];
    const usernameById = new Map(userRows.map((u) => [u.id, u.username]));

    const recentChain = recent.map((r) => ({
      id: r.id,
      referredUsername: usernameById.get(r.sourceUserId) ?? 'unknown',
      referrerUsername: usernameById.get(r.affiliateId) ?? null,
      level: r.level,
      earned: Number(r.amount),
      status: r.status,
      createdAt: r.createdAt,
    }));

    return jsonOk({
      ok: true,
      stats: { totalInvited, totalEarned, pending, claimable, claimed: paid },
      topReferrers,
      recentChain,
    });
  });
}
