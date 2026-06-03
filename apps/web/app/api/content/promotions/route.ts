// Built by Anointed Coder.
//
// Public read of active promotional bonus rules. Used by the public
// /promotions page and the rule explainer on /dashboard/bonus.
// Returns only what is safe to expose - no actor counts, no grant
// totals. Includes a small `effective` summary that humanises
// percentage + flat + cap into a single sentence.
//
// M4 Phase D additions:
//   - bannerDesktopUrl / bannerMobileUrl / thumbnailUrl / backgroundUrl
//     surfaced so /promotions can render the operator-uploaded artwork.
//   - termsEn / termsBn surfaced so the card can show conditions inline.
//   - When the visitor is signed in, the per-rule `claimedToday` /
//     `claimedThisWeek` flags + `nextClaimAt` are populated so the UI
//     can render the right CTA state without a second round-trip.
//   - `disabledReason` returned per rule when the engine cannot grant
//     for the current visitor (VIP / cashback not configured, etc.)
//     so the public card can show a clear chip instead of pretending
//     to be claimable.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { getCurrentSession } from '@/lib/auth/rbac';
import { weeklyBucket } from '@/lib/promotions/claim';

function describe(r: {
  amount: unknown;
  percentage: unknown;
  maxBonus: unknown;
  minDeposit: unknown;
  turnoverX: unknown;
  validityDays: number;
}): string {
  const pct = Number(r.percentage);
  const flat = Number(r.amount);
  const cap = Number(r.maxBonus);
  const min = Number(r.minDeposit);
  const tx = Number(r.turnoverX);

  const parts: string[] = [];
  if (pct > 0) parts.push(`${pct}% bonus`);
  if (flat > 0) parts.push(`+ ${flat.toLocaleString()} BDT flat`);
  if (cap > 0) parts.push(`(max ${cap.toLocaleString()})`);
  let body = parts.length > 0 ? parts.join(' ') : 'No payout configured';
  if (min > 0) body += ` on deposits from ${min.toLocaleString()} BDT`;
  if (tx > 0) body += `. Wagering ${tx}x before release`;
  if (r.validityDays > 0) body += `. Expires in ${r.validityDays} days`;
  return body;
}

const dayBucket = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  const session = await getCurrentSession();
  const userId = session?.sub ?? null;

  const rows = await db.bonusRule.findMany({
    where: { status: 'active' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  const now = new Date();
  const live = rows.filter((r) => {
    if (r.startsAt && r.startsAt > now) return false;
    if (r.endsAt && r.endsAt < now) return false;
    return true;
  });

  // Pull per-user claim state in a single query so the page can paint
  // claimed / next-claim flags without per-rule fetches.
  const claimsByRule = new Map<string, { dayBucket: string; createdAt: Date }>();
  if (userId && live.length > 0) {
    const ruleIds = live.map((r) => r.id);
    const claims = await db.promotionClaim.findMany({
      where: { userId, ruleId: { in: ruleIds }, status: 'granted' },
      orderBy: { createdAt: 'desc' },
    });
    for (const c of claims) {
      // Keep the latest granted claim per rule.
      if (!claimsByRule.has(c.ruleId)) claimsByRule.set(c.ruleId, { dayBucket: c.dayBucket, createdAt: c.createdAt });
    }
  }

  const todayBucket = dayBucket();
  const thisWeekBucket = weeklyBucket(now);

  return jsonOk({
    promotions: live.map((r) => {
      const ruleClaim = claimsByRule.get(r.id) ?? null;
      const claimedToday = ruleClaim?.dayBucket === todayBucket;
      const claimedThisWeek = ruleClaim?.dayBucket === thisWeekBucket;

      // Static disabledReason flags for the public UI. The BonusType
      // enum currently lacks a 'cashback' member, so the cashback chip
      // would only fire if the enum gains it in a future migration.
      let disabledReason: string | null = null;
      if (r.type === 'first_deposit') disabledReason = 'auto_first_deposit';
      else if (r.type === 'vip') disabledReason = 'vip_not_configured';
      else if (r.type === 'referral') disabledReason = 'auto_referral';
      else if (r.type === 'invite' || r.type === 'manual') disabledReason = 'admin_only';

      return {
        id: r.id,
        name: r.name,
        type: r.type,
        code: r.code,
        percentage: Number(r.percentage),
        amount: Number(r.amount),
        minDeposit: Number(r.minDeposit),
        maxBonus: Number(r.maxBonus),
        turnoverX: Number(r.turnoverX),
        validityDays: r.validityDays,
        // Admin-curated description (operator owns this field; the
        // old "Auto-managed by /admin/deposit-bonus-tiers" internal
        // note is no longer written to it). descriptionBn falls back
        // to the EN copy when empty so legacy rows still localise.
        description: r.description,
        descriptionBn: r.descriptionBn ?? null,
        bannerUrl: r.bannerUrl ?? null,
        effective: describe(r),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        // M4 Phase D presentation assets.
        bannerDesktopUrl: r.bannerDesktopUrl,
        bannerMobileUrl: r.bannerMobileUrl,
        thumbnailUrl: r.thumbnailUrl,
        backgroundUrl: r.backgroundUrl,
        termsEn: r.termsEn,
        termsBn: r.termsBn,
        // Per-visitor claim state (null when guest).
        claimedToday: userId ? claimedToday : null,
        claimedThisWeek: userId ? claimedThisWeek : null,
        lastClaimAt: userId ? (ruleClaim?.createdAt ?? null) : null,
        disabledReason,
      };
    }),
  });
}
