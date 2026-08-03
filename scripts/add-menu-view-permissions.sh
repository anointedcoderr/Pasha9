#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Adds the 70 new "menu.<key>.view" permission rows (one per literal
# AdminSidebar item, see apps/web/lib/auth/admin-sections.ts) to the live
# database, and grants them to super_admin and admin (matching what
# prisma/seed.ts would do for these specific rows).
#
# This does NOT run the full seed script. The full seed also upserts sample
# homepage content, banners, categories, games etc. using its own default
# values - running it against a live database would overwrite real,
# operator-edited content with those seed defaults. This script only ever
# touches Permission / RolePermission rows for the 70 keys below, nothing
# else, and only ever INSERTs (ON CONFLICT DO NOTHING), so it never
# overwrites an existing row.
#
# The "staff" role deliberately gets NONE of these - staff access stays
# 100% opt-in via the per-person picker on the Staff page (see
# scripts/fix-staff-role-baseline.sh, which already emptied its baseline).
#
# Safe to re-run.
#
# Usage: cd /var/www/pasha9/app && bash scripts/add-menu-view-permissions.sh

set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  for envf in .env .env.production apps/web/.env apps/web/.env.production; do
    if [ -f "$envf" ] && grep -q '^DATABASE_URL=' "$envf"; then
      export DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$envf" | cut -d= -f2- | sed -E 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')"
      break
    fi
  done
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL not found." >&2
  exit 1
fi

echo "=== inserting the 70 menu.*.view permission rows (skipping any that already exist) ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
WITH new_perms (key, label) AS (
  VALUES
    ('menu.overview.view', 'Menu: Dashboard'),
    ('menu.deposits.view', 'Menu: Deposits'),
    ('menu.withdrawals.view', 'Menu: Withdrawals'),
    ('menu.transactions.view', 'Menu: Transaction Log'),
    ('menu.payments.view', 'Menu: Payments'),
    ('menu.payouts.view', 'Menu: Payouts'),
    ('menu.paymentMethods.view', 'Menu: Payment Methods'),
    ('menu.withdrawalLimits.view', 'Menu: Withdrawal Limits'),
    ('menu.paymentsReconciliation.view', 'Menu: Payments Reconciliation'),
    ('menu.operations.view', 'Menu: Operations Monitor'),
    ('menu.depositNotice.view', 'Menu: Deposit Notice'),
    ('menu.users.view', 'Menu: User Management'),
    ('menu.balance.view', 'Menu: Balance Management'),
    ('menu.referrals.view', 'Menu: Referrals'),
    ('menu.referralClaims.view', 'Menu: Referral Claims'),
    ('menu.recovery.view', 'Menu: Player Recovery'),
    ('menu.bonuses.view', 'Menu: Bonus Management'),
    ('menu.depositBonusTiers.view', 'Menu: Deposit Bonus Tiers'),
    ('menu.promotionBanners.view', 'Menu: Promotion Banners'),
    ('menu.affiliate.view', 'Menu: Affiliate'),
    ('menu.affiliateTiers.view', 'Menu: Affiliate Tiers'),
    ('menu.vip.view', 'Menu: VIP Club'),
    ('menu.website.view', 'Menu: Website'),
    ('menu.banners.view', 'Menu: Banners'),
    ('menu.popups.view', 'Menu: Popups'),
    ('menu.welcomePopup.view', 'Menu: Welcome Popup'),
    ('menu.promoText.view', 'Menu: Promo Text'),
    ('menu.homepage.view', 'Menu: Homepage'),
    ('menu.homepageSections.view', 'Menu: Homepage Sections'),
    ('menu.homepageBlocks.view', 'Menu: Homepage Blocks'),
    ('menu.homepagePromoPair.view', 'Menu: Homepage Promo Pair'),
    ('menu.homepageShortcuts.view', 'Menu: Homepage Shortcuts'),
    ('menu.sportsEvents.view', 'Menu: Sports Events'),
    ('menu.ambassador.view', 'Menu: Ambassador'),
    ('menu.brandAmbassadors.view', 'Menu: Brand Ambassadors'),
    ('menu.sponsors.view', 'Menu: Sponsors'),
    ('menu.publicPaymentMethods.view', 'Menu: Public Payment Methods'),
    ('menu.socialLinks.view', 'Menu: Social Links'),
    ('menu.lotto.view', 'Menu: Lottery'),
    ('menu.lottoBanners.view', 'Menu: Lottery Banners'),
    ('menu.rewards.view', 'Menu: Rewards'),
    ('menu.rewardClaims.view', 'Menu: Reward Claims'),
    ('menu.bettingPass.view', 'Menu: Betting Pass'),
    ('menu.bettingPassBanners.view', 'Menu: Betting Pass Banners'),
    ('menu.spinTiers.view', 'Menu: Spin Tiers'),
    ('menu.spinSegments.view', 'Menu: Spin Segments'),
    ('menu.nativeGames.view', 'Menu: Native Games'),
    ('menu.wingo.view', 'Menu: WinGo'),
    ('menu.tournaments.view', 'Menu: Tournaments'),
    ('menu.categories.view', 'Menu: Categories'),
    ('menu.providers.view', 'Menu: Game Providers'),
    ('menu.reports.view', 'Menu: Reports & Analytics'),
    ('menu.marketing.view', 'Menu: Marketing'),
    ('menu.promoCodes.view', 'Menu: Promo Codes'),
    ('menu.campaigns.view', 'Menu: Campaigns'),
    ('menu.cashback.view', 'Menu: Cashback'),
    ('menu.inAppNotifications.view', 'Menu: In-App Notifications'),
    ('menu.notifications.view', 'Menu: Notifications'),
    ('menu.homepageVideos.view', 'Menu: Homepage Videos'),
    ('menu.tracking.view', 'Menu: Tracking Pixels'),
    ('menu.whatsapp.view', 'Menu: WhatsApp'),
    ('menu.security.view', 'Menu: Security Center'),
    ('menu.passwordResets.view', 'Menu: Password Resets'),
    ('menu.staff.view', 'Menu: Staff & Sub-admins'),
    ('menu.integrations.view', 'Menu: Integrations'),
    ('menu.depositPrompt.view', 'Menu: Deposit Prompt'),
    ('menu.support.view', 'Menu: Support Messages'),
    ('menu.settings.view', 'Menu: System Settings'),
    ('menu.activity.view', 'Menu: Activity Log'),
    ('menu.handover.view', 'Menu: Handover')
)
INSERT INTO \"Permission\" (id, key, label, \"group\")
SELECT md5(random()::text || clock_timestamp()::text || key), key, label, 'menu'
FROM new_perms
ON CONFLICT (key) DO NOTHING;
"

echo "=== granting all menu.*.view permissions to super_admin and admin (staff gets none, by design) ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO \"RolePermission\" (id, \"roleId\", \"permissionId\")
SELECT md5(random()::text || clock_timestamp()::text || r.id || p.id), r.id, p.id
FROM \"Role\" r
CROSS JOIN \"Permission\" p
WHERE r.key IN ('super_admin', 'admin')
  AND p.key LIKE 'menu.%.view'
ON CONFLICT (\"roleId\", \"permissionId\") DO NOTHING;
"

echo "=== done: verifying counts ==="
psql "$DATABASE_URL" -c "SELECT count(*) AS menu_view_permissions FROM \"Permission\" WHERE key LIKE 'menu.%.view';"
psql "$DATABASE_URL" -c "
SELECT r.key AS role, count(*) AS menu_view_grants
FROM \"RolePermission\" rp
JOIN \"Role\" r ON r.id = rp.\"roleId\"
JOIN \"Permission\" p ON p.id = rp.\"permissionId\"
WHERE p.key LIKE 'menu.%.view'
GROUP BY r.key
ORDER BY r.key;
"
