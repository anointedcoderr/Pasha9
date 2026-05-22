# Pasha9

> Bangla casino and betting platform. Live at https://pasha9.com.
>
> Built by Anointed Coder. Contact: anointedcoder@gmail.com, https://t.me/AnointedCoder, https://wa.link/fi5z8a.

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

This is Milestone 1: live deployment, real auth, editable CMS, referral base, APK download field, audit log. See [docs/milestones.md](docs/milestones.md) for the full plan, and [docs/handover-checklist.md](docs/handover-checklist.md) for the current delivery.

Milestone 2 (deposits, withdrawals, bonuses, turnover, staff management) and Milestone 3 (APK, final testing, source handover) start only after explicit M1 approval.

## Built by Anointed Coder

For support, custom feature work, or migration help:

- Telegram: https://t.me/AnointedCoder
- WhatsApp: https://wa.link/fi5z8a
- Email: anointedcoder@gmail.com
