// Built by Anointed Coder.
//
// GET /api/me/referrals
//
// Player-facing referral dashboard endpoint. Returns:
//   - referral code + invite link
//   - downline counts (level 1 / 2 / 3 + active level 1)
//   - balance snapshot (pending / claimable / claimed)
//   - cadence + hold + turnover settings
//   - recent commissions (last 25)
//   - referral claim history (last 20)
//   - tier rates (the 3 commission percentages the user qualifies for)
//   - invited users at level 1 (username + masked phone + joined)
//   - nextClaimAt computed from cadence + lastClaimedAt
//
// Internal user IDs are NEVER exposed. Phone numbers are masked to
// the last 4 digits.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { loadReferralSettings, refreshReferralBalance, isoWeek, monthBucket } from '@/lib/affiliate/balance';

function maskPhone(phone: string | null): string {
  if (!phone) return '';
  const s = String(phone);
  if (s.length <= 4) return s;
  return `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://pasha9.com';
}

function nextClaimAtFor(cadence: string, lastClaimedAt: Date | null): Date | null {
  if (!lastClaimedAt) return null;
  if (cadence === 'weekly') {
    // Next Monday after lastClaimedAt's ISO week.
    const d = new Date(lastClaimedAt);
    const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (8 - dayNum)));
    return next;
  }
  if (cadence === 'monthly') {
    const d = new Date(lastClaimedAt);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  return null;
}

export async function GET() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const userId = session.sub;

    const settings = await loadReferralSettings();

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        username: true,
        referralCode: true,
        affiliateTier: { select: { name: true, level1Pct: true, level2Pct: true, level3Pct: true } },
      },
    });

    // Refresh the cached balance from AffiliateCommission so the page
    // is always live even before the next cron run.
    const snap = await refreshReferralBalance(userId, settings.holdDays);

    const balanceRow = await db.referralBalance.findUnique({ where: { userId } });
    const lastClaimedAt = balanceRow?.lastClaimedAt ?? null;

    const [level1Ids, recentCommissions, recentClaims] = await Promise.all([
      db.user.findMany({ where: { referredById: userId }, select: { id: true, username: true, phone: true, createdAt: true, transactions: { select: { id: true }, take: 1 } } }),
      db.affiliateCommission.findMany({
        where: { affiliateId: userId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      db.referralClaim.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const level1IdList = level1Ids.map((u) => u.id);
    const level2Ids = level1IdList.length
      ? (await db.user.findMany({ where: { referredById: { in: level1IdList } }, select: { id: true } })).map((u) => u.id)
      : [];
    const level3Count = level2Ids.length
      ? await db.user.count({ where: { referredById: { in: level2Ids } } })
      : 0;

    const activeLevel1 = level1Ids.filter((u) => u.transactions.length > 0).length;
    const nextClaimAt = nextClaimAtFor(settings.cadence, lastClaimedAt);
    const currentWeekBucket = isoWeek(new Date());
    const currentMonthBucket = monthBucket(new Date());
    const lastBucket = lastClaimedAt ? (settings.cadence === 'monthly' ? monthBucket(lastClaimedAt) : isoWeek(lastClaimedAt)) : null;
    const cadenceBlocked = (() => {
      if (!lastClaimedAt) return false;
      if (settings.cadence === 'weekly') return lastBucket === currentWeekBucket;
      if (settings.cadence === 'monthly') return lastBucket === currentMonthBucket;
      return false;
    })();

    return jsonOk({
      user: {
        username: user.username,
        referralCode: user.referralCode,
        inviteLink: `${siteOrigin()}/?r=${user.referralCode}`,
      },
      downline: {
        level1Total: level1Ids.length,
        level1Active: activeLevel1,
        level2Total: level2Ids.length,
        level3Total: level3Count,
      },
      level1Invited: level1Ids.slice(0, 20).map((u) => ({
        username: u.username,
        phone: maskPhone(u.phone),
        joinedAt: u.createdAt,
      })),
      tier: user.affiliateTier
        ? {
            name: user.affiliateTier.name,
            level1Pct: Number(user.affiliateTier.level1Pct),
            level2Pct: Number(user.affiliateTier.level2Pct),
            level3Pct: Number(user.affiliateTier.level3Pct),
          }
        : null,
      balance: {
        pendingAmount: snap.pendingAmount,
        claimableAmount: snap.claimableAmount,
        claimedAmount: snap.claimedAmount,
        totalEarned: snap.pendingAmount + snap.claimableAmount + snap.claimedAmount,
        lastClaimedAt,
      },
      settings,
      claim: {
        cadenceBlocked,
        nextClaimAt,
      },
      recentCommissions: recentCommissions.map((c) => ({
        id: c.id,
        level: c.level,
        amount: Number(c.amount),
        status: c.status,
        ratePct: c.ratePct ? Number(c.ratePct) : null,
        createdAt: c.createdAt,
      })),
      recentClaims: recentClaims.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        status: c.status,
        errorCode: c.errorCode,
        walletTxId: c.walletTxId,
        createdAt: c.createdAt,
        paidAt: c.paidAt,
      })),
    });
  });
}
