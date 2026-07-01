# Pasha 9  -  Milestone 2 Delivery Package

**Branch:** `m1-production`
**Final commit:** `c93536f`
**Scope shipped:** M2A → M2L (12 milestones + 6 hotfixes, 18 commits in total)
**Built by:** Anointed Coder . info@anointedcoder.com . https://anointedcoder.com
**Date sealed:** see `git log -1 --format=%cI c93536f`

Milestone 2 closes the gap between the M1 frontend shell and a fully operational
gambling / lottery platform. Every external integration (payments, payouts, SMS,
tracking pixels, security tokens) is now provider-pluggable and editable from
the admin UI. No credentials are hardcoded in the source.

---

## 1. Delivery summary

- **18 commits** on `m1-production`, each independently deployable
- **12 new Prisma tables** + 14 column additions across the User / Wallet /
  RecoveryTask / TrackingEvent etc.  -  all additive, no destructive migrations
- **~95 new API routes** under `/api/admin/*`, `/api/auth/*`, `/api/content/*`,
  `/api/cron/*`, `/api/bonuses/*`, `/api/affiliate/*`, `/api/lotto/*`,
  `/api/payouts/*`
- **~16 new admin pages** + 4 user-facing page rebuilds
- **6 provider categories** (inbound payments, outbound payouts, SMS, tracking,
  cron, 2FA) all live and editable from the admin UI
- **One consolidated overview** at `/admin/integrations` for client lock-down
  audits + CSV export

Every milestone shipped:
1. branding gate clean,
2. typecheck clean,
3. production build clean,
4. (when applicable) deploy commands + acceptance test path + known limits
   listed in the commit message.

---

## 2. Completed scope (commit log)

| Milestone | Commit | What shipped |
|---|---|---|
| **M2A** Stabilisation | `2b25946` | Block enforcement on every protected POST, session hygiene on register/login, profile sync (mock → live `/api/auth/me`), promo-cache `revalidate=0`, mobile drawer flutter fix |
| **M2B** Payment automation | `59b99d4` | Provider-adapter scaffold (manual, test, bkash, nagad, rocket), `PaymentGatewayTx` reconciliation log, admin credentials page, webhook entrypoint with signature + amount-match auto-credit |
| **M2C** Withdrawal pipeline | `f1539e7` | Withdrawal events ledger, processingState lifecycle (`payout_initiated → paid`), payout-provider adapters, per-method limits + global limits, Mark-Paid / Hold / Release admin actions |
| **M2D** Bonus engine | `325783c` + `ed9ce82` | `BonusRule` + `UserBonus` + `TurnoverEvent`, locked-balance accounting, deposit-trigger evaluation, diagnose endpoint surfacing skip reasons, per-grant turnover credit + cancel + expire sweep |
| **M2E** Affiliate + referral | `f946743` + `d0f94de` | Tier-based commission accrual on deposit-approve, `CommissionPayout` lifecycle, per-affiliate withdrawable balance, request-payout flow, admin approve/reject/mark-paid, tier enforcement on approve + commission backfill |
| **M2F** Lotto automation | `4630ac6` + `4195892` | 6-tier settlement with no double-pay (1st exact / 1st iBox / Special / 2nd / 3rd / Consolation), rollover cron, lotto→main wallet transfer, default Daily 4D seeder with admin CTA, diagnose dry-run modal |
| **M2G** Staff management | `9da54bd` | Full CRUD over staff accounts, role swap, suspend + reactivate, password reset, per-staff `UserPermission` overrides (additive grants), activity log filters (actor / action / target / date / free text) |
| **M2H** Player recovery CRM | `cd19032` | `RecoveryRule` + `RecoveryTask` + `RecoveryContactLog`, inactivity segments (no_login / no_deposit / no_bet / balance_below), duplicate-call lock (30-minute TTL), per-attempt outcome ledger, staff performance KPIs |
| **M2I** Notifications + tracking | `ed4e0b5` | SMS adapter family (manual, test, sslwireless, twilio) with `NotificationLog` audit, conversion-event dispatcher (Facebook CAPI, TikTok Events API, GA4 MP, Google Ads gtag) with `TrackingEvent` audit, browser pixel injector, admin notifications console with test-send buttons |
| **M2J** Reports + analytics | `b9c62c4` | 11-metric time-series (day/week/month buckets via Postgres `date_trunc`), signup cohort retention + LTV table, 5-dimension breakdowns (pie + bar), 7 CSV export types, Recharts-based admin dashboard |
| **M2K** Security improvements | `ded449e` + `e840d1f` | TOTP / 2FA with otplib + QR enrollment + 10 recovery codes, AES-256-GCM at-rest secret encryption, `LoginAttempt` ledger, `IpBlockRule` (single IP + CIDR, optional expiry), heuristic flags, SMS admin-login alerts, two-step login UI on both admin + player surfaces, copy/download recovery codes |
| **M2L** Provider console | `e6ab3c3` + `c93536f` | `/admin/integrations` overview hub aggregating every provider's status (Live / Manual / Needs credentials / Disabled), deep-links to canonical config pages, CSV handover export for client lock-down audit, recent credential-edit feed from ActivityLog, clickable developer credit links |

**Promo-text hotfix** (`0a0a2e2`) sits between M2J and M2K: the M1 admin page was
fully mock-backed and never persisted edits. Now wired to the live API; homepage
ticker refreshes on every visitor reload.

---

## 3. Known provider-dependent limits

Each item is **not a bug**  -  it's a hook waiting for a credential or an
operational decision. The system runs end-to-end without any of them in
"manual" mode (admin reads OTP from `NotificationLog`, admin approves
withdrawals by hand, etc.).

| Area | Limit | Unblocked by |
|---|---|---|
| SMS delivery | Default adapter is `manual` (writes body to `NotificationLog`, no real SMS sent) | Paste real credentials into `/admin/notifications` → SMS tab. Adapter flips to Live automatically. |
| OTP delivery | Same as SMS  -  uses the active adapter | Same as above |
| Inbound payment auto-credit | Default is `manual` (admin approves deposits by hand) | Paste bkash / nagad / rocket merchant credentials at `/admin/payments`. Webhook URL is shown next to Save. |
| Outbound payout auto-pay | Same  -  manual mark-paid is the default | Paste credentials at `/admin/payouts` + decide on a real signature scheme (current bkash/nagad/rocket adapters return `null` from `verifyWebhook` until the client signs off on the integration). |
| Facebook / TikTok CAPI | Browser pixel fires only; server-side conversion needs the CAPI token | Paste tokens at `/admin/notifications` → Tracking tab |
| GA4 server-side | Browser gtag fires only; server-side needs API secret | Paste GA4 API secret at the same place |
| Google Ads server-side | Server adapter is a no-op stub  -  browser gtag handles the live conversion | Real enhanced-conversions / offline-import requires the Google Ads API + OAuth (separate project) |
| Cron jobs (lotto rollover + recovery sweep) | Require `Authorization: Bearer $CRON_SECRET` | Set `CRON_SECRET` in `.env` on the VPS, add the curl line to `crontab`. Without it, the equivalent admin button must be clicked manually. |
| 2FA TOTP secret encryption | Falls back to a key derived from `JWT_SECRET` if `SECRETS_KEY` is missing | Set `SECRETS_KEY=$(openssl rand -hex 32)` in `.env`. Without it, rotating `JWT_SECRET` would invalidate all enrolled TOTP secrets. |
| IPv6 block list | IPv4 / CIDR only in `lib/security/ip-block.ts` | BD operators almost always present as IPv4; revisit when an actual IPv6 abuse case shows up |
| GeoIP country mismatch heuristic | Not included in `lib/security/heuristics.ts` | Bind to MaxMind GeoLite2 if needed |
| Lotto winning number | Operator-entered on every settle (no RNG / external feed) | Compliance review required before any automated draw |
| Materialised reports views | None  -  every chart hits live tables | Past ~500K rows in any one table, large date ranges will slow. Add a cron-refreshed materialised view if/when scale demands it. |
| Min payout amount | Hardcoded `500` BDT in `/api/affiliate/payouts/route.ts` | Move to a `SystemSetting` row in a follow-up if the client wants to tune it |
| Bet / wager engine | Lottery tickets accrue from deposits (no real wager). Turnover credit is admin-triggered. | Game-provider integration is M3 scope |

---

## 4. Testing checklist (run on every deploy)

### Gates (pre-deploy)
- [ ] `pnpm check:branding` clean (no banned refs, credits present)
- [ ] `pnpm --filter @pasha9/web typecheck` exits 0
- [ ] `pnpm --filter @pasha9/web build` exits 0; new routes visible in manifest
- [ ] `pnpm --filter @pasha9/database exec prisma generate` clean

### Smoke (post-deploy, ~5 min)
- [ ] `pm2 status` shows `pasha9-web` online
- [ ] `GET /` → 200 (homepage marquee renders if any active promo)
- [ ] `GET /admin/login` → 200 (two-step form ready)
- [ ] `GET /admin/integrations` (as super_admin) → 200, every section card-grid loads
- [ ] `GET /dashboard` after login → 200 (StatTile row + balances correct)
- [ ] `GET /dashboard/security` after login → 200 (2FA enable button + sessions table)

### Critical paths (~30 min)
**Auth + security**
- [ ] Sign up new user, OTP code visible in NotificationLog (manual adapter) or arrives on phone (live SMS provider)
- [ ] Sign in. `/dashboard` loads.
- [ ] Enroll 2FA from `/dashboard/security`. Recovery codes shown. Copy + Download buttons work.
- [ ] Log out, log back in → 2FA challenge step appears, 6-digit code completes login
- [ ] Try a recovery code on the next login → completes, code is consumed
- [ ] Add a fake IP to `/admin/security` IP-block list using your own IP → next request returns 403 IP_BLOCKED. Remove the rule.

**Payments + payouts**
- [ ] Submit a manual deposit. Admin approves at `/admin/deposits`. Toast shows: deposit credited, lottery tickets accrued, bonus granted (if rule exists), affiliate commission accrued (if upline has a tier).
- [ ] Submit a withdrawal. Admin approves at `/admin/withdrawals`. Mark Paid with a provider key + reference. User's wallet balance decremented, `WithdrawalEvent` timeline updated.

**Bonus + affiliate**
- [ ] At `/admin/bonuses` create a first_deposit rule. Diagnose against the fresh user shows eligible. Approve the deposit → bonus row visible in `/dashboard/bonus` with turnover progress bar.
- [ ] Use `/admin/bonus-grants/[id]/turnover` to push turnover progress to 100% → grant flips to released, `lockedBalance` drops to 0.
- [ ] At `/admin/affiliate` approve an affiliate, assign bronze tier. Trigger another deposit from a downline user. `/admin/activity` shows `COMMISSION_ACCRUED`. `/dashboard/affiliate` shows withdrawable balance. Request payout → admin approves → mark paid.

**Lotto**
- [ ] At `/admin/lotto` settle a draw with `1234`. Diagnose dry-run first. Per-tier breakdown appears in the success toast. `/lotto` (public) shows the latest result.
- [ ] Click `Run rollover` → next-day draw seeded.
- [ ] User with `lottoBalance > 100` clicks Transfer at `/dashboard/wallet` → funds move to main wallet.

**Reports + integrations**
- [ ] `/admin/reports` four tabs all render. Time-series chart updates when metric/granularity changes. CSV export downloads.
- [ ] `/admin/integrations` shows every category. Configure links land on the right canonical page. Export CSV downloads with every provider's status.

**Notifications + tracking**
- [ ] `/admin/notifications` send-test SMS button works (manual provider logs body, live provider sends).
- [ ] Fire-test event button reports per-platform results (`facebook:ok` or `facebook:skipped_no_token`).
- [ ] Browser DevTools network tab shows `fbevents.js` / `gtag/js` requests on homepage when pixel IDs are set.

**Recovery CRM**
- [ ] At `/admin/recovery` create a `no_login` rule with threshold 1 day. Preview → matches at least one user.
- [ ] Materialize → tasks appear. Claim one → 30-minute lock visible. Record an attempt → close as `won`. Performance tab shows the conversion.

---

## 5. Deployment notes

### Standard deploy

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a
source .env
set +a
pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm exec prisma db push --schema packages/database/prisma/schema.prisma
pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

Every schema change in M2 is **additive** (new tables, new nullable columns,
new indexes). `prisma db push` is safe to run repeatedly. Postgres will build
new indexes online without blocking existing queries.

### One-time `.env` additions (do these once, never again)

```bash
# Cron secret  -  required for headless cron callers
echo 'CRON_SECRET='"$(openssl rand -hex 32)" | sudo tee -a /var/www/pasha9/app/.env

# AEAD encryption key  -  forward-secure 2FA secret encryption
echo 'SECRETS_KEY='"$(openssl rand -hex 32)" | sudo tee -a /var/www/pasha9/app/.env

pm2 restart pasha9-web --update-env
```

### Crontab (optional but recommended)

```cron
# Daily 7:30 PM BST: close past-due draws + seed next day's
30 19 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/lotto-rollover >> /var/log/lotto-cron.log 2>&1

# Every 5 minutes: release expired recovery locks + materialise auto-create rules
*/5 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/recovery-sweep >> /var/log/recovery-cron.log 2>&1

# Daily just after midnight UTC: mature cashback campaigns. Idempotent per
# UTC day, so weekly/monthly campaigns are safe under the same daily cron.
5 0 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/cashback >> /var/log/cashback-cron.log 2>&1
```

`$CRON_SECRET` should be the literal value (root crontab doesn't expand env
vars from `.env` automatically  -  paste the value, or use a wrapper script
that sources `.env` first).

---

## 6. Rollback notes

### Per-commit rollback

Every M2 commit is independent. To roll back any milestone:

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard <previous_sha>
pnpm install --prod=false
pnpm build
pm2 restart pasha9-web --update-env
```

The previous SHA for each milestone is in `git log m1-production`.

### Schema rollback safety

Every M2 schema change was additive (new tables, nullable columns, new
indexes). Rolling the code back does NOT require rolling the DB back  -  the
new columns simply become unused. Specifically:

| Milestone | Tables added | Columns added | Indexes added |
|---|---|---|---|
| M2C | `WithdrawalEvent` | `Withdrawal.processingState`, `providerKey`, `providerRef`, `paidAt`; `PaymentGatewayTx.direction`, `withdrawalId`; `PaymentMethod` deposit/payout flags + min/max | several |
| M2D | `TurnoverEvent` | `BonusRule` + `UserBonus` lifecycle fields | several |
| M2E | `CommissionPayout` | `AffiliateCommission.depositId`, `tierId`, `ratePct`, `payoutId` | several |
| M2F |  -  | `LottoDraw.closedAt`, `settledAt` | `LotteryWinning.prizeTier` |
| M2G | `UserPermission` |  -  | several |
| M2H | `RecoveryRule`, `RecoveryTask`, `RecoveryContactLog` | `User.recoveryTasks` back-relation | several |
| M2I | `NotificationLog`, `TrackingEvent` |  -  | several |
| M2J |  -  |  -  | `User.createdAt`, `Deposit.createdAt`, `Withdrawal.createdAt` |
| M2K | `LoginAttempt`, `IpBlockRule` | `User.totpSecret`, `totpEnabled`, `totpEnrolledAt`, `recoveryCodesHash` | several |
| M2L |  -  |  -  |  -  |

**Hard rollback** (drop the new tables + columns) is possible but unnecessary
unless you want to reclaim disk. If you do:

```sql
-- Use only after a clean rollback of the code to before the milestone.
-- All tables below are M2 additions and were NOT in the M1 schema.
DROP TABLE IF EXISTS "IpBlockRule", "LoginAttempt",
                     "TrackingEvent", "NotificationLog",
                     "RecoveryContactLog", "RecoveryTask", "RecoveryRule",
                     "UserPermission",
                     "CommissionPayout", "TurnoverEvent", "WithdrawalEvent"
                     CASCADE;
-- New columns on User / Wallet / Withdrawal / etc. are nullable; can be
-- dropped with ALTER TABLE if needed.
```

### Cookie / session safety

- Rolling back across M2A revokes nothing  -  session JWTs keep working until
  their 8h TTL expires.
- Rolling back across M2K invalidates the 2FA challenge state machine but does
  not lock anyone out  -  users with `totpEnabled=true` will be asked for the
  code on next login; if the code path doesn't exist (rolled-back build), the
  user logs in normally.

### Provider data safety

No M2 milestone destroys `SystemSetting` rows. Pasted credentials survive
every rollback. The only way to lose them is `DROP TABLE "SystemSetting"`
which neither M2 nor any backup script does.

---

## 7. M3 roadmap (proposed)

These are the natural next steps after M2 verification. Each block is roughly
one or two milestone-sized commits.

### M3A  -  Live game integration
- Wire actual slot/casino provider catalogs (Pragmatic, BGaming, Spribe, etc.)
- Real bet / wager API → feeds `addTurnover()` (M2D engine is ready)
- Real-time wallet debit on bet, credit on win
- Settlement audit trail per game session

### M3B  -  KYC + compliance
- Document upload at `/dashboard/profile/kyc` (ID front/back, selfie, address proof)
- Admin review queue at `/admin/kyc`
- Tiered withdrawal limits keyed off KYC level
- Audit-ready compliance log

### M3C  -  Mobile app
- Android APK build (capacitor or native)
- Push notifications via FCM (extends M2I notification layer)
- Biometric login (M2K 2FA infrastructure already in place)

### M3D  -  Live chat + ticket flow
- Replace M1 `SupportTicket` model with a real chat surface (e.g. Crisp, Intercom, or self-hosted)
- Auto-route to staff with `support.read` permission
- Tie to the existing `RecoveryTask` queue so support agents see history

### M3E  -  Real Google Ads server-side conversion
- Full Google Ads API + OAuth integration
- Enhanced conversions / offline-import
- Replace the M2I stub adapter with a real one

### M3F  -  Materialised reports views
- Daily aggregation cron writing to `ReportsDaily` / `ReportsCohort` tables
- `/admin/reports` switches to the cached tables when the date range exceeds ~90 days
- Sub-second time-series on multi-year ranges

### M3G  -  Multi-currency + Multi-region
- `currency` already exists on Wallet  -  add INR / PKR / others
- Per-currency payment methods + payout methods
- FX-rate provider integration (M2L `/admin/integrations` already has the slot for it)

### M3H  -  Advanced security
- Admin-configurable rate-limit thresholds (currently hardcoded)
- IPv6 block list (M2K leaves the door open via `lib/security/ip-block.ts`)
- GeoIP country mismatch heuristic via MaxMind GeoLite2
- Anomaly scoring for deposit / withdraw timing patterns

### M3I  -  Promo code engine
- Single-use + multi-use codes
- Hook into M2D bonus engine (the rule kinds are already there: `promo`)
- Campaign tracking via M2I

### M3J  -  Crash + slot tournaments
- Real-time leaderboards over Transaction(type=win) data
- Periodic prize pool distribution
- Tied to the M2G staff permissions for management

---

## 8. Repo hygiene

- All milestones merged into `m1-production` (the live deploy branch).
- `main` is the long-lived branch. Open a PR `m1-production` → `main` when
  the client signs off so `main` stays the single source of truth for M2.
- Backups: `scripts/backup-db.sh` covers the Postgres dump. Run nightly via
  cron + offsite copy via rsync / S3  -  leave that to the operator's
  preference.
- `.env` is **not** in git. The required keys are documented in
  `docs/deployment-guide.md` and section 5 of this file.

---

## 9. Credit + handover

- Built by **[Anointed Coder](https://anointedcoder.com)**
- Contact: info@anointedcoder.com . t.me/AnointedCoder
- Credit links are baked into `lib/constants/brand.ts` and rendered in:
  - Public footer (clickable name)
  - Admin sidebar credit block (clickable name)
  - `/admin/login` footer (clickable name)
  - `/admin/handover` reference card
- **Credits cannot be edited from the admin UI**  -  no `SystemSetting` row, no
  admin API touches `BRAND.developer.*`. Confirmed by `grep` audit on the
  final M2L hotfix.

End of Milestone 2 delivery package.
