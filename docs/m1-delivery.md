# Pasha 9 Milestone 1 Delivery

Built by Anointed Coder. info@anointedcoder.com.
Final delivery summary for the live Pasha 9 platform.

## Live links

- Public site: https://pasha9.com
- Admin panel: https://pasha9.com/admin
- Repository: https://github.com/anointedcoderr/Sanjid14 (will be renamed to Pasha9)
- Working branch: `m1-production`
- Final tag: `m1-final-delivery`

## Credentials

Delivered privately, never committed to git:

- Super admin username and password (rotate on first login)
- Test player username and password
- VPS SSH path
- PostgreSQL role and password

---

## What is completed in Milestone 1

### Production infrastructure
- Ubuntu 24.04 VPS with Node 20 LTS, pnpm, PM2, PostgreSQL 16, Nginx, UFW
- SSL via Certbot for both apex and `www`, auto-renew configured
- PM2 process `pasha9-web` with auto-restart and structured logs in `/var/log/pasha9`
- Backup script `scripts/backup-db.sh`: nightly cron, 14 day rotation, DB dump + uploads tarball under `/var/backups/pasha9/`

### Live database (PostgreSQL `sanjid14`)
- 33 Prisma models. New in the final M1 sprint: **LotteryTicket, LotteryDrawResult, LotteryWinning**. Banner has new `mediaType / videoUrl / posterUrl` columns. Wallet has new `lottoBalance` column.
- All migrations applied via `prisma db push` (idempotent and additive).
- Seed populates: 4 roles, 23 permissions, super admin, 4 homepage sections, 3 banners, 1 popup, 4 promo lines, 8 categories, 5 providers, 8 sample games, 5 payment methods, ~30 system settings, 3 commission tiers, 4 lotto draws, 6 reward items.

### Authentication & sessions
- Register (username + phone + password). Login (phone or username + password).
- bcrypt cost 12 password hashing.
- JWT access cookie (`pasha9_session`, 8 hour TTL) + refresh cookie (`pasha9_refresh`, 30 day TTL).
- `httpOnly` + `sameSite=lax` + `secure` in production on both cookies.
- Server-side DB-tracked sessions via the `Session` table.
- Transparent refresh: any `/api/auth/me` call (Header, WalletStrip, Deposit page) silently mints a new access cookie when the access has expired but the refresh is still valid. Refresh secret rotates on every renewal and the previous session row is revoked.
- Standalone `POST /api/auth/refresh` endpoint for explicit renewal.
- Per-IP rate limit on register, login, forgot, reset, OTP.
- Password change from `/admin/profile` and `/dashboard/security`. Every password input has an eye/eye-off reveal toggle (keyboard accessible, aria-pressed).
- Password reset with single-use hashed tokens.
- OTP provider-ready adapter (`console` in dev, `noop` in prod until SMS API key lands).
- Middleware gates `/admin/*` and `/dashboard/*` routes.

### Public website (Babu-inspired white / yellow / black / blue theme)
- Bangla-first with English toggle. No flash on first paint (server-side cookie + Accept-Language resolution in the root layout).
- **Premium logo**: bevelled gold tile with embossed dark shield + gold "9", drop shadow and gloss. Size variants `sm / md / lg / xl`. Operator can override with a remote URL (see Logo & Favicon below).
- **Header**: white desktop with visible Login (blue) and Register (yellow) for guests; balance pill + Deposit (+) + Profile icon + Notification bell + Logout for logged-in. Mobile chrome shows hamburger + logo + bell + profile/login icon.
- **Notification drawer**: top-right Radix portal with empty state for guests, two friendly system notifications for logged-in users.
- **Category nav**: dark horizontal bar with HOT/NEW markers and yellow active underline (desktop).
- **Mobile bottom nav** (5 slots, Home centre):
  - Logged-in: `Promotion | Lotto | HOME | Betting Pass | Referral`
  - Guest: `Promotion | Lotto | HOME | Register | Login`
  - Safe-area padding so the active underline stays clear of the iOS gesture bar.
- **Mobile drawer** (hamburger): three sections (Main, Games, **Others**). The Others section holds Language toggle, FAQ, Live Chat, Download App (uses admin APK URL), Logout / Login + Register guarded by auth state.
- **BackBar**: thin back + Home + breadcrumb on every internal page (promotions, lotto, betting-pass, referral, rewards, affiliate, vip, sports, faq). Visitors are never trapped.
- **Hero slider** with image AND video banner support:
  - Admin can mark each banner as `image` (full-bleed `<img>`) or `video` (`<video autoplay muted loop playsInline poster>`).
  - Mute / unmute toggle for video slides.
  - Auto-rotation: 6.5s on image / fallback art, 12s on video so visitors can actually watch.
  - **Auth-aware CTAs**: guests see Register Now; logged-in users get Play Now + Make a Deposit + Claim Bonus + Open Wallet. Admin-set live banners whose CTA href contains `login=1 / signup=1` are silently rewritten for logged-in visitors.
  - Updates instantly on login via the `pasha9:wallet-refresh` event.
- **WalletStrip** at the top of the homepage:
  - Guest: premium dark gradient CTA card with Register / Login.
  - Logged-in: greeting + main balance + refresh icon + Deposit / Withdraw / History buttons. Listens to `pasha9:wallet-refresh` so it re-fetches without a page reload.
- **CategorySlider**: horizontal mobile slider with Jackpot / Hot / Slot / Casino / Crash / Sports / Fishing / Table tiles. Smooth touch scroll, scrollbar hidden.
- **PromoTicker, JackpotStrip**, game rails for Hot / Slots / Live Casino / Fishing / Crash / Lotto (3 cols mobile, 5-6 cols desktop), Ambassador + Video section, Sports cards carousel, Refer & Earn + Betting Pass promo pair, App Download.
- **AnnouncementPopup**: first-visit content popup carousel, cookie-gated for 24h.
- **FirstVisitAuthPopup**: separate cookie-gated (`pasha9_first_visit_seen`, 30 days) welcome popup for first-time guest visitors with Register / Login / Maybe later. Skipped silently for logged-in returning users.
- **FloatingContact**: Babu-style yellow FAB with WhatsApp / Telegram / **Live Chat (always shown)** / Email options pulled from admin Public Support Contacts. Closes on Escape + outside click.
- **Footer**: dark, sections for Brand Ambassadors, Sponsorships, Payment Methods (bKash, Nagad, Rocket, Upay placeholders), Responsible Gaming, Follow Us, Pasha 9 Official block, SEO description, bottom developer credit.
- Category pages with provider filter pills, sort, search, dense grid, Load More: `/slots`, `/live-casino`, `/fishing`, `/games`, `/games/[category]` (hot, slots, live-casino, fishing, sports, lottery, poker, esports, crash, table, fast).
- `/promotions` with type filter and accent gradient cards.
- `/rewards` with three tabs (Reward Store, Check In, Spin) and custom SVG spin wheel.
- `/lotto` rebuilt for M1 (see "4D Lottery system" below).
- `/betting-pass` and `/betting-pass/ipl` placeholder pages.
- `/vip` placeholder page.
- `/faq` with 6 default questions in Bangla and English.
- `/affiliate` public program page: hero, 4 perk cards, full commission tier table from live DB, 3-step How It Works, promo asset preview, FAQ accordion, application form with 4 UI states.

### User dashboard
- Overview, Wallet, Deposit, Withdraw, Bonus Center, Referral, Transactions, Profile, Security, **Affiliate Center** (copy referral code + invite link, share via WhatsApp/Telegram, KPI cards, tier card, downline tabs L1/L2/L3, commission summary, Request Payout disabled with M2 tooltip).
- **Collapsible mobile dashboard menu**: nav shows a single "Dashboard / <active item>" bar with chevron. Tapping any item navigates AND closes the menu.

### Deposit & Withdrawal money flow (M1, manual)
- **User submission**:
  - `POST /api/deposits` writes a `Deposit` row with `status="pending"`. Rate-limited 5/min/user.
  - `POST /api/withdrawals` writes a `Withdrawal` row, but only after checking the wallet has enough non-locked balance. 400s with `INSUFFICIENT_FUNDS` otherwise so the user sees an actionable error.
  - Both pages pre-check `/api/auth/me` and show a clear "log in first" banner when the visitor has no session. Submit buttons are disabled until authentication is confirmed. Server errors render with HTTP status + code (no false success cards).
- **Admin approval**:
  - `/admin/deposits` and `/admin/withdrawals` show real DB rows. Approve / Reject hit real APIs.
  - Approving a deposit: transactional flip to approved + credit wallet + write deposit Transaction + run `accrueLotteryTickets` (see lotto section).
  - Approving a withdrawal: transactional flip to approved + decrement wallet + write debit Transaction. Refuses if the wallet would go negative.
  - Every approval / rejection writes to `ActivityLog` with the actor, amount and meta fields.
- **No live payment gateway** in M1; integration ships in M2.

### 4D Lottery system (deposit-driven)
- **No manual ticket purchase**. Tickets are accrued automatically from approved deposits at the rate of **2 tickets per BDT 1,200** of total approved deposits per user. Idempotent: re-approving an existing deposit does not double-mint.
- **Schema**: `LotteryTicket`, `LotteryDrawResult` (1:1 with `LottoDraw`), `LotteryWinning`. `Wallet.lottoBalance` is a separate ledger.
- **Daily 7:30 PM BST draw** displayed prominently on `/lotto`.
- **Prize structure** shown on `/lotto` and configurable per-draw: 1st 2000x / 2nd 800x / 3rd 300x / Special 150x / Consolation 30x of ticket base value.
- **iBox / permutation logic** explained on `/lotto` with 1234 (24 unique perms) and 1111 (1 unique perm, full prize) examples. Service module `lib/lotto/tickets.ts` ships `uniquePermutations`, `isPermutation`, `computeFirstPrize` helpers.
- **Admin settlement**: `/admin/lotto` has a Settle button per unsettled draw. Modal takes the 4-digit winning number + all 5 prize multipliers. `POST /api/admin/lotto/[id]/settle` evaluates every issued ticket on that draw, creates `LotteryWinning` rows, credits user `Wallet.lottoBalance` in one transaction, marks tickets won / lost.
- **Public results**: `/lotto` shows latest winning numbers as gold digit chips with winner count + total paid.
- **User snapshot**: `/lotto` for logged-in users shows ticket count + lotto balance + a progress bar to the next 2-ticket block, plus a list of their recent tickets and winnings.
- **Lottery Rules & FAQ** accordion (7 items, bn + en) below the prize structure.
- **Honesty marker**: M1 settles 1st prize only (exact match + iBox permutations). 2nd / 3rd / Special / Consolation multipliers are stored on the result for display; full automation ships in M2.

### Admin Control Center (Phase 8D rebuild)
- **Sidebar regrouped** into the brief's structure: Overview / Operations / Users & Money / Bonus & Affiliate / Content & Media / Lotto & Rewards / Games / Reports & Marketing / Security & Staff / System.
- **Mobile admin drawer**: slide-in left drawer triggered from the topbar hamburger. Auto-closes on navigation. Locks body scroll when open.
- **/admin Control Center**: 8 live stat tiles backed by `/api/admin/overview` (total users + new today + active 7d, deposits approved + today + pending count and amount, withdrawals approved + pending count and amount, platform balance, lotto balance outstanding, ticket + winning counts). Real pending-queue card with Review jump-in links. Shortcuts card. Recent-activity table from `ActivityLog`.
- **/admin/website** Website Customization hub: Logo + Favicon + site name editor with live preview boxes (writes to `SystemSetting` via existing PATCH route; switched to upsert so new keys work without a re-seed). Content & Media editor grid links every existing CMS surface (banners, popups, promo text, homepage, ambassador, lotto, rewards, categories, providers, settings).
- **/admin/staff**: read-only role + permission matrix sourced from `/api/admin/staff/snapshot`. Creating accounts, suspending and per-staff overrides marked Ready for M2.
- **/admin/reports**: real DB counts + a Ready-for-M2 grid for daily P&L, top-player, cohort funnel, referral funnel, bonus / turnover compliance, provider GGR breakdown.
- **/admin/security**: honest snapshot - Live (bcrypt, JWT, rate-limit, refresh rotation, activity log) / Requires provider (login alert email + SMS) / Ready for M2 (2FA, IP block list, suspicious activity heuristics, per-user login history filter).
- **/admin/marketing**: Live channels (banners, popups, promo text, bonuses, affiliate, referrals) + Ready-for-M2 grid for promo codes, push, SMS / email blasts, cashback campaigns.
- **Existing admin pages** still present and improved: Users, Balance, Deposits (real), Withdrawals (real), Transactions, Referrals, Bonuses, Affiliate + Tiers, Banners (image + video), Popups, Promo Text, Homepage Content, Ambassador & Video, Lotto Draws + Settle, Reward Catalog, Categories, Providers, Settings, Activity Log, Source Handover.
- **Logo / Favicon end-to-end live**: admin sets URLs in `/admin/website`. `GET /api/content/branding` returns them. Public Logo component renders the remote URL when set, otherwise the bundled SVG. `DynamicFavicon` client component (mounted in the root layout) swaps `<link rel="icon">` at runtime.

### Editable content management (delivered as the client requested)

| Client request | Where to edit |
|---|---|
| Logo and favicon | `/admin/website` -> Logo & Favicon |
| Website text / content | `/admin/homepage` |
| Banners and images | `/admin/banners` (image or video) |
| Promotional videos | `/admin/banners` (mediaType=video) or `/admin/ambassador` |
| Offer text | `/admin/promo-text` |
| Popup text and images | `/admin/popups` |
| Homepage sections | `/admin/homepage` |
| Bonus / reward text | `/admin/rewards` |
| Game images | upload via `/api/admin/uploads`, paste URL into `/admin/games` |
| App download / APK link | `/admin/settings` -> Mobile App (APK) card |
| Footer / social / support contacts | `/admin/settings` -> Public Support Contacts |
| Ambassador and video section | `/admin/ambassador` |
| Lotto draws and settlement | `/admin/lotto` |
| Lotto rewards content | `/admin/rewards` |

### Affiliate system (unchanged from earlier Phase 4)
- Public `/affiliate` program page with live tier table.
- User `/dashboard/affiliate` center with referral code, link, copy buttons, share buttons, KPIs, downline tabs.
- Admin `/admin/affiliate` management with status filter, detail drawer, action modal.
- Admin `/admin/affiliate/tiers` CRUD.
- DB: `AffiliateApplication`, `CommissionTier`, `AffiliateCommission`, `User.isAffiliate`.
- Permissions: `affiliate.read`, `affiliate.write`, `affiliate.tiers.write`.
- 3 seeded tiers: bronze 8/4/2, silver 10/5/2, gold 12/6/3.
- Commission auto-accrual on each deposit + payout pipeline are M2.

### Branding gate (enforced on every commit)
- No developer-toolchain names, no retired `sanjid14` brand, no em dash or en dash anywhere in source.
- "Built by Anointed Coder" credit present in footer, admin sidebar, admin login, system settings, source handover and README.
- Developer Telegram link is `https://t.me/anointedcoder`.

---

## What is provider-ready, not live yet

These have UI, schema and API surface but await external credentials:

- SMS / OTP delivery (adapter present, `console` in dev, `noop` in prod)
- Tracking pixels (Facebook, TikTok, GA4, Google Ads fields in admin Settings, no IDs hardcoded)
- Live payment gateway (manual / semi-auto flow scaffolded; M2 wires the gateway adapter)
- Real game provider integrations (model + admin form ready, no live API call)

---

## What requires Milestone 2

| Feature | Status |
|---|---|
| Live payment gateway adapter (auto-credit on provider callback) | Schema + admin queue live, gateway wiring is M2 |
| Withdrawal payout pipeline (provider callback flips status to paid) | Admin approval live + wallet debited, provider payout is M2 |
| Bonus rule auto-application (first deposit, reload, daily, weekly, VIP) | Admin authors rules now; automatic application is M2 |
| Turnover / wager system per user and per bonus | M2 |
| Affiliate commission auto-accrual per deposit | Schema + tier rates present, accrual engine is M2 |
| Affiliate payout request flow | Request Payout button is intentionally disabled, payout is M2 |
| Tracking pixel event firing (signup, login, deposit, bonus, referral, game click) | Pixel IDs in admin, dispatcher is M2 |
| SMS provider integration (real OTP delivery) | Adapter ready, requires client provider keys |
| Two-factor (TOTP) at login | OtpCode schema present; UI + enforcement is M2 |
| Email / SMS login alerts | ActivityLog records every login; out-of-band alert is M2 |
| Staff / sub-admin management UI (create, suspend, per-staff overrides) | Role + Permission schema present, full UI is M2 |
| IP block list, suspicious-activity heuristics | M2 |
| Real lottery 2nd / 3rd / Special / Consolation tier settlement | 1st prize (exact + iBox) settles in M1; other tiers stored for display, full automation M2 |
| Lotto balance withdrawal pipeline | Lotto winnings credit to `Wallet.lottoBalance` in M1; withdraw flow is M2 |
| Real lottery draw cron (auto open + settle at 7:30 PM) | Admin manually publishes the winning number in M1; cron is M2 |
| Reward claim flow (deduct coins, fulfil prize) | CRUD UI ready, claim engine is M2 |
| Reports: daily P&L chart, top-players, cohort, GGR breakdown | DB counts shown in M1, time-series + cohort engines M2 |
| Promo codes, push notifications, SMS / email blasts, cashback campaigns | M2 |
| Pasha 9 game provider live API connections | M2 |
| Color theme override + per-language brand variants | M2 |

---

## What requires Milestone 3

| Feature | Status |
|---|---|
| Android APK via Capacitor or WebView wrapper | M3 |
| App icon and splash screen | M3 |
| APK loads pasha9.com or app route, preserves login session | M3 |
| APK download link surfaced through admin (admin field ready in M1) | M3 |
| End-to-end testing across web and APK | M3 |
| Source-code handover package, full documentation set, credentials handover, 2 weeks post-delivery support | M3 |

---

## Server setup summary

```
OS                   Ubuntu 24.04 LTS
Runtime              Node 20 LTS, pnpm latest, PM2
Database             PostgreSQL 16 bound to 127.0.0.1, database name "sanjid14"
Web server           Nginx with Let's Encrypt SSL (apex + www)
Process manager      PM2, single app "pasha9-web"
App path             /var/www/pasha9/app
Uploads              /var/www/pasha9/uploads/{banners, games, payment-proofs, apk, branding}
Logs                 /var/log/pasha9/
Backups              /var/backups/pasha9/{db, uploads}/, nightly 03:30 BD time
Firewall             UFW allow 22, 80, 443
```

---

## Database summary

```
Models               33 (auth + RBAC + wallet + transactions + deposits + withdrawals
                       + bonuses + content + games + affiliate + lotto draws
                       + lottery tickets + lottery results + lottery winnings
                       + rewards + audit + system)
Permissions          23 keyed permissions
Role assignments     super_admin all, admin all except settings.write + staff.manage
                       + affiliate.tiers.write, staff read + deposit/withdrawal review
Seeded content       3 banners, 1 popup, 4 promo lines, 4 homepage sections,
                       8 categories, 5 providers, 8 games, 5 payment methods,
                       3 commission tiers, 4 lotto draws, 6 reward items
```

---

## Final deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git checkout m1-production
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

## Final rollback

If anything goes wrong after deploy:

```bash
# 1. Roll back to the previous known-good commit
cd /var/www/pasha9/app
git fetch origin
git reset --hard <previous_commit_short_sha>     # eg the m1-final-delivery~1 commit
pnpm install --prod=false
pnpm build
pm2 restart pasha9-web --update-env
pm2 save

# 2. If the regression involves a schema change, restore the latest DB dump
ls -la /var/backups/pasha9/db/                   # pick the most recent dump
sudo -iu postgres gunzip -c /var/backups/pasha9/db/<dump>.sql.gz | psql sanjid14
```

Every Phase 8 schema change was additive (new tables + new nullable columns + new default-valued columns). A simple `git reset` to a prior commit + a fresh `pnpm build` is enough to revert any UI / API change. Restoring a DB dump is only needed if you specifically want to undo data created after that dump.

---

## Honest known limitations

Items the operator should be aware of before announcing M1 publicly:

- **No live payment gateway.** Deposits and withdrawals are admin-approved manually. Real-time payment confirmation requires the M2 gateway adapter.
- **No SMS provider key in production.** OTP delivery uses the `noop` adapter; no SMS text reaches the user until the M2 provider key is configured.
- **Lottery automation is partial.** 1st prize (exact + iBox) settles immediately when admin publishes the winning number. 2nd / 3rd / Special / Consolation multipliers are stored on the result and displayed but their per-ticket evaluation engine ships in M2. The daily 7:30 PM draw must be opened and settled manually by the operator until the M2 cron lands.
- **Bonus rules** can be authored from `/admin/bonuses` today but automatic application on deposit + turnover tracking are M2.
- **Affiliate commission accrual** records exist in the schema but the engine that posts a row per qualifying deposit ships in M2. The dashboard shows the right shape with empty data today.
- **Staff sub-admin creation UI** is read-only in M1. The super admin can still create staff accounts directly in the DB if absolutely required; the proper UI ships in M2.
- **Reports** show real DB-grounded counts. Time-series and cohort charts ship in M2.
- **Push notifications, promo codes, cashback campaigns** are scaffolded under `/admin/marketing` and clearly labelled Ready for M2.
- **Mobile app (APK)** is M3. The admin can paste an APK download URL today; surfacing inside the app shell requires the M3 WebView wrapper.

---

## Client review request

Walk through `docs/testing-checklist.md` against the live site. Once approved in writing, we move to Milestone 2.

For anything that needs the developer: `info@anointedcoder.com`, Telegram `https://t.me/anointedcoder`, WhatsApp `https://wa.link/fi5z8a`.

---

## Waiting for Milestone 1 approval before starting Milestone 2.
