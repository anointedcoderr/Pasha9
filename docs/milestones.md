# Pasha9 Milestones

Project: Bangla casino and betting platform. Owner is the client. Built by Anointed Coder. Contact: anointedcoder@gmail.com.

The build is split into three priced milestones, each with a strict scope so the client always knows what has shipped and what is next.

## Milestone 1 (current) Core setup and live deployment

Status: Implementation complete on branch `m1-production`. Awaiting client approval before merging to `main` and starting Milestone 2.

What ships:

- Ubuntu 24.04 VPS configured with Node 20, pnpm, PM2, PostgreSQL 16, Nginx, UFW, Let's Encrypt SSL
- Live domain at `https://pasha9.com` with `www.pasha9.com` redirecting to apex
- PostgreSQL with 25 Prisma models, real migration applied, idempotent seed
- Auth: register, login, JWT cookies, bcrypt password hashing, OTP provider-ready adapter, password reset flow
- Editable admin CMS: banners, popups, promo text, homepage content, system settings (live PostgreSQL backed)
- User dashboard with real wallet view via `/api/auth/me`
- Referral code generation per user; `?r=` capture on signup
- Audit log written on every admin write with IP and user-agent
- Local disk uploads via `/var/www/pasha9/uploads`, served by Nginx with caching
- APK download field exposed in system settings for the future Milestone 3 build
- Branding gate enforces every project rule on every build

What does not ship in M1 (deferred to later milestones):

- Live SMS provider integration (waits on credentials)
- Payment gateway integration (waits on credentials)
- Game provider API integrations (waits on credentials)
- Full staff management UI
- Bonus and turnover/wager logic
- Deposit and withdrawal real flows
- Android APK build

## Milestone 2 Main features and integrations

Starts only after M1 approval.

Scope summary:

- Deposit request flow with manual proof and admin approval; gateway adapter when credentials arrive
- Withdrawal request flow with admin approval, turnover gating, wallet balance checks
- Bonus management (first deposit, reload, daily, weekly, referral, promo) with start and end windows
- Turnover and wager system per user and per bonus
- Referral chain visualization, commission rules, fraud check basics
- Full user management (suspend, activate, reset password, balance edit by super admin only)
- Staff/sub-admin roles, granular permissions, action logs
- Tracking pixel settings (Facebook, TikTok, GA4, Google Ads, Snapchat, affiliate)
- SMS/OTP provider integration when credentials arrive
- Game management with house edge, RTP, payout table, maintenance, wager contribution
- Daily transaction, deposit, withdrawal, bonus, referral, staff activity reports

## Milestone 3 APK, final testing, source handover

Starts only after M2 approval.

Scope summary:

- Capacitor or WebView Android APK loading `https://pasha9.com` with persistent session
- App icon, splash screen, app name Pasha9
- APK download link wired to the admin field
- End to end testing across web and APK
- Backup verified, off-site copy procedure documented
- Source code package, documentation set, credentials handover, two weeks of post-delivery support
