# sanjid14 Platform

> Royal Bangla Casino Glow theme. Bangla first, English fallback, mobile first, premium casino styling.
> Built by Anointed Coder. Contact: anointedcoder@gmail.com

This repository contains the full implementation plan for the sanjid14 betting and casino platform across three priced milestones. Milestone 1, the complete frontend, ships in this drop and is ready to demo to the client.

## Quick start (Milestone 1 demo)

Requires Node.js 18.17+ and pnpm 9.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

Useful side commands:

```bash
pnpm build               # production build
pnpm lint                # eslint
pnpm typecheck           # tsc --noEmit
pnpm check:branding      # fail on banned references or long-dash characters
```

## Repository layout

```
sanjid14-platform/
  apps/
    web/                Next.js 14 App Router with public site, user dashboard, admin panel
    api/                Backend stub (implemented in Milestone 2)
  packages/
    config/             Shared Tailwind preset and tsconfig
    database/           Prisma schema and seed (Milestone 2)
  docs/
    milestones.md
    api-plan.md
    deployment-guide.md
    backup-guide.md
    handover-checklist.md
    testing-checklist.md
  scripts/
    check-branding.mjs  Verifies no banned references and no long-dash characters
```

## What is in Milestone 1

- 21 public pages (home, games index, dynamic category, slots, fishing, lottery, sports, live casino, promotions, referral, wallet, deposit, withdraw, transactions, profile, support, terms, responsible gaming, 404)
- 9 user dashboard pages (overview, wallet, deposit, withdraw, bonus, referral, transactions, profile, security)
- 18 admin pages (login, overview, users, balance, deposits, withdrawals, transactions, referrals, bonuses, banners, popups, categories, providers, homepage, promo text, support, settings, activity, handover)
- 24 mock users, 120 transactions, 50 deposits and withdrawals, 40 games, 8 categories, 6 providers, 4 banners, 4 promo strings, 6 bonus rules, 30 days of revenue series
- Floating Telegram and WhatsApp buttons
- Built by Anointed Coder marks on footer, admin sidebar, admin login, system settings, handover
- Custom design system with no third-party UI library (Radix primitives only for accessibility on dialog, dropdown, tabs, popover, tooltip)
- Lightweight i18n via context + JSON dictionaries (Bangla default, English fallback)

## What is mock vs what is real

In Milestone 1, every data source is mock and lives under `apps/web/lib/mock/*`. The mock shape matches the Prisma schema in `packages/database/prisma/schema.prisma`, so Milestone 2 simply swaps the import to call the API.

Login and registration validate inputs but do not persist. Deposit and withdrawal forms validate, run a simulated delay, then show a success state. Admin approve / reject / balance adjust flows open the full confirmation modals with reason fields, but do not write to a database.

## What Milestone 2 connects

- Real auth (JWT, hashed passwords, three roles)
- Wallet, deposit, withdrawal, transaction APIs
- Admin approval flows with audit logs
- Referral commission engine
- Bonus rule engine and claim flow
- Banner, popup, promo text, category, provider, homepage content CRUD
- Admin dashboard statistics endpoint

See `docs/milestones.md` for the full breakdown.

## What Milestone 3 adds

- Semi-automatic deposit flow plus manual proof upload fallback
- Withdrawal approval connected to payment gateway if client API docs are supplied
- Game provider connection layer with demo launch flow
- Android APK via Capacitor that loads the live site and preserves the session
- Source archive, deployment guide, backup guide, handover walkthrough

## Branding rules (enforced)

- No badges anywhere
- No em dash or en dash characters in source (lint script enforces)
- Built by Anointed Coder appears in the required surfaces
- Telegram: https://t.me/AnointedCoder
- WhatsApp: https://wa.link/fi5z8a
- Contact: anointedcoder@gmail.com

## Compliance note

The platform is a technical product. The site owner is responsible for the appropriate license, KYC, local laws, payment provider approvals, and game provider agreements before any public launch.

## Missing client assets

To complete Milestone 2 and 3, the client should provide:

- Final brand name and approved logo
- Real game provider credentials and the full provider list to onboard
- Selected payment gateway documentation
- Approved KYC requirements
- Production hosting access (VPS or Vercel) and domain DNS access
