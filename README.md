# Pasha 9

> Bangla casino and betting platform. Live at https://pasha9.com.
>
> Built by Anointed Coder. Contact: info@anointedcoder.com, https://t.me/anointedcoder, https://wa.link/fi5z8a.

This monorepo contains the live Pasha9 platform: Next.js 14 frontend, server-side API routes, Prisma PostgreSQL data layer, shared Tailwind tokens, deployment artifacts, and the full documentation set used during handover.

## Repository layout

```
apps/
  web/                 Next.js 14 App Router (public site, user dashboard, admin panel, /api routes)
packages/
  config/              Shared Tailwind preset and tsconfig
  database/            Prisma schema, migrations, seed
docs/                  Deployment, admin, api, backup, migration, testing, handover guides
nginx/                 Production Nginx config (copied to /etc/nginx/sites-available)
scripts/               Branding gate, deploy, backup
ecosystem.config.js    PM2 process definition
```

## Quickstart (local development)

```bash
pnpm install
cp .env.example .env

# Start a local Postgres in any way you like, then point DATABASE_URL at it.
pnpm --filter @pasha9/database exec prisma migrate dev --name dev
pnpm --filter @pasha9/database run seed

pnpm dev
```

The web app opens at `http://localhost:3000`. The admin panel is `http://localhost:3000/admin/login`. Use the seeded super admin credentials from the seed log.

## Production deploy

See [docs/deployment-guide.md](docs/deployment-guide.md) for the full 13-step Ubuntu provisioning, Nginx and SSL setup, plus the recurring `./scripts/deploy.sh` flow.

## Branding gate

Every commit must pass:

```bash
pnpm check:branding
```

The gate blocks references to retired brand names, em or en dashes, and missing "Built by Anointed Coder" credits.

## Milestones

Milestone 1 is complete and live at `https://pasha9.com`. Final tag: `m1-final-delivery`. M1 covers the live production deployment, real auth with 8h transparent-refresh sessions, editable CMS (banners image + video, popups, promo text, homepage, ambassador, rewards, lotto), full affiliate system, deposit-driven 4D lottery with iBox settlement and prize structure, manual deposit + withdrawal money flow with real admin approval, Babu-style theme, premium logo + favicon swap via admin, first-visit auth popup, floating support, BackBar on every internal page, mobile bottom nav with raised Home, mobile dashboard + admin drawers, the admin Control Center, Website Customization hub, Staff / Reports / Security / Marketing scaffolds (honestly marked) and the branding gate.

See [docs/milestones.md](docs/milestones.md) for the full M1 scope and the M2 + M3 plan. See [docs/m1-delivery.md](docs/m1-delivery.md) for the client-facing delivery summary, and [docs/testing-checklist.md](docs/testing-checklist.md) for the QA walkthrough and the rollback procedure.

Milestone 2 (live payment + payout gateway, bonus auto-application, turnover, affiliate auto-accrual, SMS / OTP, tracking pixel dispatcher, staff management UI, reports time-series, lotto draw cron + 2nd / 3rd tiers, promo codes, push, cashback) and Milestone 3 (Android APK, final testing, source handover, 2 weeks support) start only after explicit M1 approval.

## Built by Anointed Coder

For support, custom feature work, or migration help:

- Telegram: https://t.me/anointedcoder
- WhatsApp: https://wa.link/fi5z8a
- Email: info@anointedcoder.com
