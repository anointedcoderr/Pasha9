# Pasha 9 Milestones

Project: Bangla casino and betting platform. Owner is the client. Built by Anointed Coder. Contact info@anointedcoder.com.

Three priced milestones with strict scope. Milestone 2 starts only after Milestone 1 written approval; Milestone 3 only after Milestone 2 written approval.

---

## Milestone 1 (status: COMPLETE on `m1-production`, tag `m1-final-delivery`)

Live at `https://pasha9.com`. Final M1 includes the Babu-inspired redesign, real affiliate system end-to-end, deposit-driven 4D lottery with iBox settlement, the admin control center polish, video banner support, the first-visit popup, floating support, transparent session refresh and full editable content management.

### What ships in M1

**Infrastructure**
- Ubuntu 24.04 VPS, Node 20 LTS, pnpm, PM2 (`pasha9-web`), PostgreSQL 16, Nginx, UFW, Let's Encrypt SSL on apex + `www`, nightly DB + uploads backup with 14-day rotation.

**Database (33 Prisma models)**
- Auth + RBAC: User, Role, Permission, RolePermission, Session, PasswordResetToken, OtpCode.
- Wallet + money: Wallet (with new `lottoBalance`), Transaction, Deposit, Withdrawal.
- Bonuses + affiliate: BonusRule, UserBonus, AffiliateApplication, CommissionTier, AffiliateCommission.
- Content: Banner (with new `mediaType / videoUrl / posterUrl`), PopupAnnouncement, PromoText, HomepageContent, GameCategory, GameProvider, Game, PaymentMethod.
- Lottery: LottoDraw, LotteryTicket, LotteryDrawResult, LotteryWinning.
- Audit + system: ActivityLog, SupportTicket, SystemSetting.
- All migrations applied via `prisma db push`. Seed is idempotent.

**Authentication & sessions**
- Username + phone register, phone-or-username login.
- bcrypt cost 12.
- JWT access cookie (`pasha9_session`, 8h TTL) + refresh cookie (`pasha9_refresh`, 30d TTL).
- `httpOnly + sameSite=lax + secure` in production on both cookies.
- DB-tracked sessions; refresh rotates the secret and revokes the previous row.
- Transparent refresh inside `/api/auth/me`; standalone `POST /api/auth/refresh` for explicit renewal.
- Rate-limited register / login / forgot / reset / OTP endpoints.
- Password reveal (eye / eye-off) on every password input, keyboard accessible.
- Middleware gates `/admin/*` and `/dashboard/*`.

**Public site**
- Babu-inspired white / yellow / black / blue theme.
- Bangla-first with EN toggle, no flash on first paint.
- Premium logo (bevelled gold tile, embossed dark shield + gold "9") with size variants and optional admin-provided remote URL.
- Header with auth-aware chrome, notification drawer, balance pill, deposit shortcut, profile icon.
- Mobile bottom nav (5 slots, raised Home centre, auth-aware).
- Mobile drawer with Main / Games / Others sections (Others holds language, FAQ, live chat, download app, login / register / logout).
- BackBar on every internal page.
- Hero slider with image OR video banners (autoplay muted, poster fallback, mute toggle, auth-aware CTAs).
- WalletStrip (greeting + balance + Deposit / Withdraw / History for logged-in; CTA card for guests).
- CategorySlider (Jackpot / Hot / Slot / Casino / Crash / Sports / Fishing / Table).
- PromoTicker, JackpotStrip, game rails, AmbassadorVideoSection, SportsCardsCarousel, PromoPair, AppDownloadSection.
- AnnouncementPopup (content) + FirstVisitAuthPopup (Register / Login, cookie-gated 30 days).
- FloatingContact (WhatsApp / Telegram / Live Chat / Email).
- `/promotions`, `/rewards`, `/lotto`, `/betting-pass`, `/betting-pass/ipl`, `/vip`, `/sports`, `/affiliate`, `/faq` and category pages.

**User dashboard**
- Overview, Wallet, Deposit, Withdraw, Bonus Center, Referral, Affiliate Center, Transactions, Profile, Security.
- Collapsible mobile dashboard nav with auto-close on navigation.

**Money flow (manual, M1)**
- `POST /api/deposits` writes pending Deposit row (rate-limited, auth-gated).
- `POST /api/withdrawals` writes pending Withdrawal row with wallet-balance pre-check.
- Admin approval transactionally credits / debits the wallet, writes the Transaction, runs lottery ticket accrual on deposit approval.
- Live payment-gateway adapter is M2.

**4D Lottery system**
- Deposit-driven: 2 tickets per BDT 1,200 of approved deposits per user. Idempotent.
- Daily 7:30 PM BST draw display.
- Prize structure 1st 2000x / 2nd 800x / 3rd 300x / Special 150x / Consolation 30x (per draw, configurable at settle time).
- iBox / permutation explainer with 1234 and 1111 examples.
- Admin settles via `/admin/lotto` Settle modal. 1st prize (exact + iBox permutations) is automatically credited to `Wallet.lottoBalance` in one transaction. Other tiers are stored on the result for display; full settlement automation is M2.
- Public results panel with winning digit chips, winner count, total paid.
- Logged-in users see ticket count + lotto balance + progress to next 2-ticket block.
- 7-item Lottery Rules & FAQ accordion in bn + en.

**Affiliate system**
- Public `/affiliate` page with live tier table.
- User `/dashboard/affiliate` center.
- Admin `/admin/affiliate` + `/admin/affiliate/tiers` CRUD.
- DB models + 3 seeded tiers (bronze 8/4/2, silver 10/5/2, gold 12/6/3).
- Commission auto-accrual + payout pipeline are M2.

**Admin Control Center**
- Sidebar grouped into Overview / Operations / Users & Money / Bonus & Affiliate / Content & Media / Lotto & Rewards / Games / Reports & Marketing / Security & Staff / System.
- Mobile admin drawer (slide-in left, auto-close on navigation).
- `/admin` Control Center with real-data KPIs, pending queue, shortcuts, recent activity.
- `/admin/website` Website Customization hub: logo + favicon + site name editor with live preview and a Content & Media editor grid linking every CMS surface.
- `/admin/staff` read-only role + permission matrix.
- `/admin/reports` real DB counts + Ready-for-M2 time-series and cohort grid.
- `/admin/security` honest snapshot (Live / Requires provider / Ready for M2).
- `/admin/marketing` Live channels + Ready-for-M2 grid (promo codes, push, SMS / email, cashback).
- Existing admin pages: Users, Balance, Deposits (real), Withdrawals (real), Transactions, Referrals, Bonuses, Affiliate + Tiers, Banners (image + video), Popups, Promo Text, Homepage Content, Ambassador & Video, Lotto Draws + Settle, Reward Catalog, Categories, Providers, Settings, Activity Log, Source Handover.

**Logo / Favicon end-to-end**
- Admin sets URLs in `/admin/website`.
- `GET /api/content/branding` returns `siteName / logoUrl / faviconUrl`.
- Public Logo component renders the remote URL when set, otherwise the bundled SVG.
- DynamicFavicon swaps `<link rel="icon">` at runtime.

**Branding gate**
- Enforced on every commit. Blocks `Claude`, `Anthropic`, `sanjid14`, em dash and en dash. Asserts "Built by Anointed Coder" credit in footer + admin sidebar + admin login + system settings + source handover + README.
- Developer Telegram link is `https://t.me/anointedcoder`.

---

## Milestone 2 (status: NOT STARTED - waits for M1 written approval)

Scope: live money + live automation + provider integrations.

| Feature | Status |
|---|---|
| Live payment gateway adapter (auto-credit on provider callback) | M1 has the manual flow; M2 wires the gateway |
| Withdrawal payout pipeline (provider callback flips status to paid) | M1 has admin approval + wallet debit; payout is M2 |
| Bonus rule auto-application + turnover tracking | M1 lets admin author rules; M2 wires the engine |
| Affiliate commission auto-accrual per deposit | Schema + tier rates present, accrual engine M2 |
| Affiliate payout request flow | Request Payout button is intentionally disabled in M1 |
| Tracking pixels (Facebook, TikTok, GA4, Google Ads) dispatcher | Pixel ID fields live in admin Settings; dispatcher M2 |
| SMS provider integration (real OTP delivery) | Adapter ready, requires client provider keys |
| Two-factor (TOTP) at login | OtpCode schema present; UI + enforcement M2 |
| Email / SMS login alerts | ActivityLog records every login; out-of-band alert M2 |
| Staff / sub-admin management UI (create, suspend, per-staff overrides) | Role + Permission schema present, M1 read-only |
| IP block list, suspicious-activity heuristics | M2 |
| Real lottery 2nd / 3rd / Special / Consolation tier settlement | 1st prize (exact + iBox) ships in M1; other tiers M2 |
| Lotto balance withdrawal pipeline | Winnings credit in M1; withdraw flow M2 |
| Real lottery draw cron (auto open + settle at 7:30 PM) | Manual settle in M1; cron M2 |
| Reward claim flow (deduct coins, fulfil prize) | CRUD UI ready, claim engine M2 |
| Reports: daily P&L, top-players, cohort, GGR breakdown | DB counts in M1, time-series engine M2 |
| Promo codes, push notifications, SMS / email blasts, cashback campaigns | M2 |
| Pasha 9 game provider live API connections | M2 |
| Color theme override + per-language brand variants | M2 |

---

## Milestone 3 (status: NOT STARTED - waits for M2 written approval)

Scope: Android APK + final QA + source handover + 2 weeks post-delivery support.

| Feature | Status |
|---|---|
| Android APK via Capacitor or WebView wrapper | M3 |
| App icon and splash screen | M3 |
| APK loads pasha9.com or app route, preserves login session | M3 |
| APK download link surfaced in-app (admin field ready in M1) | M3 |
| End-to-end testing across web + APK | M3 |
| Source-code handover package, full documentation set, credentials handover | M3 |
| 2 weeks post-delivery support | M3 |

---

## Sequencing rule

Per the original contract: never start a new milestone without written approval of the previous one. Approval is captured in the corresponding `docs/m{n}-delivery.md` sign-off section.
