## Pasha 9 Milestones

Project: Bangla casino and betting platform. Owner is the client. Built by Anointed Coder. Contact info@anointedcoder.com.

Three priced milestones with strict scope. Milestone 2 starts only after Milestone 1 written approval, Milestone 3 only after Milestone 2 written approval.

---

### Milestone 1 (status: implementation complete on `m1-production`, tag `m1-redesign-complete`)

Live at `https://pasha9.com`. Includes a full Babu88-inspired redesign on top of the original M1 production deployment, plus a real affiliate system end to end, plus full editable content management.

What ships:

- Production server (Ubuntu 24.04, Node 20, pnpm, PM2, PostgreSQL 16, Nginx, UFW, SSL, nightly backup)
- 30 Prisma models with applied migrations and idempotent seed
- Auth (register, login, JWT cookies, bcrypt, rate limits, OTP provider-ready adapter, password reset + change)
- Public site with white/yellow/black/blue Babu88-inspired theme, Bangla-first with no flash
- Babu-style mobile bottom nav with 4 main slots and a raised yellow center CTA
- Homepage: hero carousel, announcement popup, marquee, jackpot strip, quick action 3-step, 6 game rails, Ambassador and Video section, sports cards, Refer and Earn + Betting Pass promos, App Download
- Category pages with provider filter, sort, search, dense grid, Load More
- Promotion, Rewards (tabbed), Lotto, Betting Pass, IPL Betting Pass, VIP pages
- Public Affiliate program page with live tier table and application form
- User dashboard: overview, wallet, deposit, withdraw, bonus, referral, **affiliate center**, transactions, profile, security
- Admin panel: full Babu88 white/yellow theme, all CMS surfaces editable (banners, popups, promo text, homepage, ambassador and video, lotto draws, reward catalog, categories, providers, games, bonuses, public support contacts, APK download URL)
- Affiliate management: applications, approvals, status, tier assignment, commission tier CRUD
- Activity log for every admin write
- Branding gate enforced on every build

---

### Milestone 2 (waiting on M1 approval)

Goal: connect the operational features that move real money and real player activity.

Scope summary:

- Deposit money flow: gateway adapter, manual proof fallback, admin approval, automatic wallet credit, transaction log entry
- Withdrawal money flow: admin approval, payout pipeline, balance checks, turnover gating
- Bonus engine: automatic application of bonus rules (first deposit, reload, daily, weekly, VIP, referral, promo, invite, manual)
- Turnover and wager system: per bonus and per deposit promotion, contribution rate by game category, withdrawal blocked until requirement met, progress visible to user and admin
- Affiliate commission auto-accrual using the seeded commission tiers
- Affiliate payout pipeline so Request Payout becomes live in the dashboard
- Referral commission auto-calculation and payout
- Real lottery draw engine (ticket purchase, draw run, prize distribution)
- Real reward redemption (coin deduct, fulfilment)
- SMS provider integration for OTP and password reset SMS delivery (provider chosen by client)
- Tracking pixel event dispatcher (page view, signup, login, deposit, deposit approved, withdrawal, bonus claim, referral signup, game click, CTA click). Pixel IDs entered via admin Settings.
- Staff and sub-admin management UI (super admin creates, suspends, deletes staff, assigns granular permissions). Schema already present.
- Reports: daily transaction, deposit, withdrawal, bonus, referral, staff activity, login IP history
- Live game provider integrations (where contracts are in place)
- Optional: migrate the user dashboard route group to the new white/yellow theme

---

### Milestone 3 (waiting on M2 approval)

Goal: Android APK, final QA, full source handover.

Scope summary:

- Android APK via Capacitor or WebView wrapper, app name Pasha 9
- App icon, splash screen
- APK loads `https://pasha9.com` and preserves login session
- APK download surfaced through the admin Mobile App (APK) settings already present
- End to end testing across web and APK
- Backup verified, off-site copy procedure documented
- Source code package
- Documentation set (deployment, admin, api, backup, migration, handover, testing)
- Credentials handover, two weeks of post-delivery support
