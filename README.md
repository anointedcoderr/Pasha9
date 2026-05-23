# Pasha 9

> Bangla casino and betting platform. Live at https://pasha9.com.
>
> Built by Anointed Coder. Contact: info@anointedcoder.com, https://t.me/AnointedCoder, https://wa.link/fi5z8a.

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

Milestone 1 is complete and live at `https://pasha9.com`. It includes the live production deployment, real auth, editable CMS, Babu88-inspired light theme, full affiliate system, ambassador and video editor, lotto and reward catalog editors, mobile bottom navigation, audit log. Final tag: `m1-redesign-complete`.

See [docs/milestones.md](docs/milestones.md) for the full M1 scope and the M2 + M3 plan. See [docs/m1-delivery.md](docs/m1-delivery.md) for the client-facing delivery summary, and [docs/testing-checklist.md](docs/testing-checklist.md) for the QA walkthrough.

Milestone 2 (deposits, withdrawals, bonuses, turnover, affiliate auto-accrual, payouts, SMS / OTP, tracking pixels, staff management, reports) and Milestone 3 (Android APK, final testing, source handover) start only after explicit M1 approval.

## Built by Anointed Coder

For support, custom feature work, or migration help:

- Telegram: https://t.me/AnointedCoder
- WhatsApp: https://wa.link/fi5z8a
- Email: info@anointedcoder.com
