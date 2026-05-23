## Pasha 9 Milestone 1 Delivery

Built by Anointed Coder. info@anointedcoder.com.

### Live links

- Public site: https://pasha9.com
- Admin panel: https://pasha9.com/admin
- Repository: https://github.com/anointedcoderr/Sanjid14 (will be renamed to Pasha9)
- Working branch: `m1-production`
- Final tag: `m1-redesign-complete`

### Credentials

Delivered privately, never committed:

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
- Backup script `scripts/backup-db.sh`: nightly cron, 14 day rotation, both DB dump and uploads tarball under `/var/backups/pasha9/`

### Live database (PostgreSQL `sanjid14`)
- 30 Prisma models including: User, Role, Permission, RolePermission, Wallet, Transaction, Deposit, Withdrawal, BonusRule, UserBonus, Banner, PopupAnnouncement, PromoText, HomepageContent, GameCategory, GameProvider, Game, PaymentMethod, SystemSetting, ActivityLog, SupportTicket, Session, PasswordResetToken, OtpCode, ReferralLink, ReferralBonus, **AffiliateApplication, CommissionTier, AffiliateCommission, LottoDraw, RewardItem**
- All migrations applied via `prisma db push`
- Seed populates: 4 roles, 23 permissions, super admin, 4 homepage sections, 3 banners, 1 popup, 4 promo lines, 8 categories, 5 providers, 8 sample games, 5 payment methods, 28 system settings, 3 commission tiers, 4 lotto draws, 6 reward items

### Authentication
- Register (username + phone + password), login (phone or username + password)
- bcrypt cost 12 password hashing
- JWT access + refresh cookies (`pasha9_session`, `pasha9_refresh`)
- Server-side session revocation via DB session table
- Rate-limited per IP and per phone on register, login, forgot, reset, OTP
- Password change flow from `/admin/profile` and `/dashboard/security`
- Password reset with single-use hashed tokens
- OTP provider-ready adapter (`console` adapter in dev, `noop` in prod until SMS API key lands)
- Middleware gates `/admin/*` and `/dashboard/*` routes

### Public website (white / yellow / black / blue Babu88-inspired theme)
- Bangla-first with English toggle, no flash on first paint (server-side cookie + Accept-Language)
- White desktop header with visible Login (blue) and Register (yellow) for guests, balance pill + Deposit + Profile + Logout for logged-in users
- Dark category navigation bar with 15 items, yellow active underline, custom HOT / NEW markers
- Mobile: app download top strip, hamburger drawer (white, grouped Main + Games), sticky bottom navigation (Promotion, Lotto, raised yellow Register/Deposit, Login/Profile)
- Footer with Brand Ambassadors, Sponsorships, Payment Methods (bKash, Nagad, Rocket, Upay placeholders), Responsible Gaming, Follow Us, Pasha 9 official brand block, SEO description, small bottom developer credit
- Homepage composition: hero carousel (live banners), promo marquee (live), jackpot strip with mini/grand/major, quick action 3-step (Register / Deposit / Play), 6 game grids (Hot, Slots, Live Casino, Fishing, Crash, Lotto), Ambassador and Video section, Sports cards carousel, Refer and Earn promo, Betting Pass promo, App Download section, first-visit announcement popup
- Category pages with provider filter pills, sort dropdown, search, dense grid, Load More: `/slots`, `/live-casino`, `/fishing`, `/games`, `/games/[category]` (hot, slots, live-casino, fishing, sports, lottery, poker, esports, crash, table, fast)
- `/promotions` with type filter and accent gradient cards
- `/rewards` with three tabs (Reward Store, Check In, Spin) and custom SVG spin wheel
- `/lotto` with 4 lotto draw cards, masked digit chips, prize pool, How It Works
- `/betting-pass` and `/betting-pass/ipl` placeholder pages with M2 marker
- `/vip` placeholder page
- `/affiliate` public program page: hero, 4 perk cards, full commission tier table from live DB, 3-step How It Works, promo asset preview, FAQ accordion, application form with 4 UI states
- Floating support button (only when admin has set client contacts)

### User dashboard (still on the legacy dark theme by design, migrates in M2 cleanup)
- Overview, Wallet, Deposit, Withdraw, Bonus Center, Referral, Transactions, Profile, Security, **Affiliate Center** (with copy referral code + invite link, share via WhatsApp/Telegram, KPI cards, tier card, downline tabs L1/L2/L3, commission summary, Request Payout disabled with M2 tooltip)

### Admin panel (full Babu88-inspired light theme)
- Login, Profile (with change-password form), Overview, Activity Log, System Settings, Source Handover
- User Management with detail drawer
- Balance management
- Deposit and Withdrawal lists (review flows wired to M2)
- Transaction log
- Referrals
- **Affiliate** management with status filter pills, search, detail drawer, action modal (approve, reject, suspend, activate, reset)
- **Commission Tiers** full CRUD with status switch
- Banners, Popups, Promo Text, Homepage Content live CMS
- Categories, Providers, Games CRUD
- **Ambassador and Video** editor (two-column, active toggle, save to live SystemSetting)
- **Lotto Draws** CRUD with status switch
- **Reward Catalog** CRUD with status switch
- **Mobile App (APK)** download URL + version field inside System Settings
- Support inbox
- Branded source handover surface with developer credit

### Editable content management (delivered as the client requested)
| Client request | Where to edit |
|---|---|
| Website text / content | `/admin/homepage` |
| Banners and images | `/admin/banners` |
| Promotional videos | `/admin/ambassador` |
| Offer text | `/admin/promo-text` |
| Popup text and images | `/admin/popups` |
| Homepage sections | `/admin/homepage` |
| Bonus / reward text | `/admin/rewards` |
| Game images | upload endpoint at `/api/admin/uploads`, paste URL into `/admin/games` |
| App download / APK link | `/admin/settings` → Mobile App (APK) card |
| Footer / social / support contacts | `/admin/settings` → Public Support Contacts |
| Ambassador and video section | `/admin/ambassador` |
| Lotto and rewards content | `/admin/lotto`, `/admin/rewards` |

### Affiliate system (full)
- Public `/affiliate` program page with live tier table
- User `/dashboard/affiliate` center with referral code, link, copy buttons, share buttons, KPIs, downline tabs
- Admin `/admin/affiliate` management with status filter, detail drawer, action modal
- Admin `/admin/affiliate/tiers` CRUD
- Database: `AffiliateApplication`, `CommissionTier`, `AffiliateCommission`, `User.isAffiliate`
- Permissions: `affiliate.read`, `affiliate.write`, `affiliate.tiers.write`
- 3 seeded tiers: bronze (8/4/2), silver (10/5/2), gold (12/6/3)

### Branding gate (enforced on every build)
- No `Claude`, `Anthropic`, `sanjid14`, em dash, en dash anywhere in source
- "Built by Anointed Coder" credit present in footer, admin sidebar, admin login, system settings, source handover, README

---

## What is provider-ready, not live yet

These have UI, schema and API surface but await external credentials:

- SMS / OTP delivery (adapter present, `console` in dev, `noop` in prod)
- Tracking pixels (Facebook, TikTok, GA4, Google Ads fields in admin Settings, no IDs hardcoded)
- Payment gateway (manual / semi-auto flow scaffolded)
- Real game provider integrations (model + admin form ready, no live API call)

---

## What requires Milestone 2

| Feature | Status |
|---|---|
| Deposit money flow (gateway adapter, manual proof, admin approval, auto wallet credit) | Schema + admin queue present, money flow is M2 |
| Withdrawal money flow (admin approval, payout, turnover gate) | Schema + admin queue present, payout is M2 |
| Bonus rule auto-calculation (first deposit, reload, daily, weekly, VIP) | Admin can author rules now, automatic application of bonus is M2 |
| Turnover / wager system per user and per bonus | M2 |
| Affiliate commission auto-accrual per deposit | Schema + admin tier rates present, accrual engine is M2 |
| Affiliate payout pipeline | Request Payout button is intentionally disabled, payout is M2 |
| Tracking pixel event firing (signup, login, deposit, bonus, referral, game click) | Pixel IDs fields exist in admin, dispatcher is M2 |
| SMS provider integration (real OTP delivery) | Adapter ready, requires client provider keys |
| Staff / sub-admin management UI (super admin creates staff, suspends, deletes, assigns granular permissions) | Role + Permission schema present, full UI is M2 |
| Real lottery draw engine (ticket purchase, draw run, prize distribution) | CRUD UI ready, engine is M2 |
| Reward claim flow (deduct coins, fulfil prize) | CRUD UI ready, claim engine is M2 |
| Reports (daily transaction, deposit, withdrawal, bonus, referral, staff activity, login IP history) | M2 |
| Pasha 9 game provider live API connections | M2 |

---

## What requires Milestone 3

| Feature | Status |
|---|---|
| Android APK via Capacitor or WebView wrapper | M3 |
| App icon and splash screen | M3 |
| APK loads pasha9.com or app route, preserves login session | M3 |
| APK download link surfaced through admin (the admin field is ready in M1) | M3 |
| End to end testing across web and APK | M3 |
| Source code handover package, full documentation set, credentials handover, 2 weeks post-delivery support | M3 |

---

## Server setup summary

```
OS                   Ubuntu 24.04 LTS
Runtime              Node 20 LTS, pnpm latest, PM2
Database             PostgreSQL 16 bound to 127.0.0.1, database name "sanjid14"
Web server           Nginx with Let's Encrypt SSL (apex + www)
Process manager      PM2, single app "pasha9-web"
App path             /var/www/pasha9/app
Uploads              /var/www/pasha9/uploads/{banners, games, payment-proofs, apk}
Logs                 /var/log/pasha9/
Backups              /var/backups/pasha9/{db, uploads}/, nightly 03:30 BD time
Firewall             UFW allow 22, 80, 443
```

---

## Database summary

```
Models               30 (auth + RBAC + wallet + transactions + deposits + withdrawals
                       + bonuses + content + games + affiliate + lotto + rewards
                       + audit + system)
Permissions          23 keyed permissions
Role assignments     super_admin all, admin all except settings.write + staff.manage
                       + affiliate.tiers.write, staff read + deposit/withdrawal review only
Seeded content       3 banners, 1 popup, 4 promo lines, 4 homepage sections,
                       8 categories, 5 providers, 8 games, 5 payment methods,
                       3 commission tiers, 4 lotto draws, 6 reward items
```

---

## Subsequent deploys

```
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

---

## Client review request

Please walk through the testing checklist in `docs/testing-checklist.md` against the live site. Once approved, reply with written confirmation and we will move to Milestone 2.

---

## Waiting for Milestone 1 approval before starting Milestone 2.
