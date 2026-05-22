# Pasha9 Milestones

> Project: Bangla casino and betting platform. Owner is the client. Built by Anointed Coder. Contact: anointedcoder@gmail.com.

The build is split into three priced milestones, each with a strict scope so the client always knows what has shipped and what is next.

## Milestone 1: Frontend only

Price: 150 USD
Duration: 2 days
Status: Delivered with this drop

What is shipped

- Next.js 14 App Router project at `apps/web` with TypeScript, Tailwind, custom design tokens
- Royal Bangla Casino Glow theme (deep green, gold gradient, neon accents, premium glow)
- Bangla first content with English fallback via a lightweight i18n context
- Public site:
  - Home with animated hero slider, jackpot ticker, marquee promo strip, four scrolling game rails, and promotion cards
  - Games index + dynamic category page
  - Slots, Live Casino, Fishing, Lottery, Sports placeholder
  - Promotions (six bonus rules)
  - Referral center with code, link, copy, three-level chain, commission tiers, totals, table
  - Wallet, Deposit, Withdrawal, Transactions (40 mock entries, type filter)
  - Profile, Support (channels + FAQ + ticket form), Terms, Responsible Gaming
- User dashboard:
  - Overview, Wallet, Deposit, Withdraw, Bonus, Referral, Transactions, Profile, Security
- Admin dashboard:
  - Login screen + Overview (8 stat cards, Recharts area chart, pending queue, recent activity)
  - User management with detail drawer + balance adjust modal (reason required, old to new shown)
  - Balance management list
  - Deposit approval and withdrawal approval with confirmation modal
  - Transaction logs, referral chain management, bonus rule editor
  - Banner manager, popup manager, category manager, provider manager
  - Homepage content editor, promo text marquee editor
  - Support inbox with drawer, system settings (with compliance notice)
  - Activity log, source handover page
- Floating Telegram and WhatsApp buttons across the site
- Built by Anointed Coder branding in: footer, admin sidebar, admin login, system settings, source handover

What is mock in Milestone 1

- All users, transactions, deposits, withdrawals, games, banners, popups, referrals, bonus rules, admin stats, support tickets, activity logs.
- Login and registration modals validate inputs and simulate latency but do not persist.
- Deposit and withdrawal forms validate and show a success screen but no API call.

What Milestone 2 connects

- Real user registration and login (JWT, hashed passwords, three roles)
- Wallet, deposit, withdraw, transaction APIs
- Admin approval flows with audit logs
- Referral commission engine
- Bonus rule engine and claim flow
- Banner, popup, promo text, category, provider, homepage content CRUD
- Admin dashboard statistics endpoint

What Milestone 3 connects

- Semi-automatic deposit flow plus manual payment proof fallback
- Withdrawal approval with payment gateway hooks if client provides API docs
- Game provider connection layer, demo launch flow
- Android APK shell via Capacitor (icon, splash, package name) that points to the responsive site

## Milestone 2: Backend and admin functionality

Price: 300 USD
Duration: 3 days
Status: Scaffolded only, implementation begins after Milestone 1 sign off

Deliverables

- NestJS API in `apps/api` with the modules listed in `apps/api/README.md`
- Prisma schema in `packages/database/prisma/schema.prisma` (already drafted, 20 models)
- PostgreSQL migrations and seed data that mirror the Milestone 1 mocks
- Endpoint coverage per `docs/api-plan.md`
- Admin and user test accounts in the seed
- Activity log writes for every admin write action

## Milestone 3: Payments, APK, handover

Price: 150 USD
Duration: 2 days

Deliverables

- Semi-automatic deposit flow
- Manual payment proof upload with admin approval if no gateway docs are available
- Game provider API ready structure
- Capacitor based Android APK that loads the live responsive site and preserves login
- App icon and splash screen
- End-to-end smoke test
- Source archive, deployment guide, backup guide, handover checklist
