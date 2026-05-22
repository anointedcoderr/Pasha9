# Pasha9 Deployment Guide

Target environment guidance. Implementation completes in Milestone 3, but the structure is locked here so hosting can be procured early.

## Recommended topology

| Component | Recommendation | Alternative |
| --- | --- | --- |
| Frontend (Next.js) | Vercel | VPS via Docker + Nginx |
| Backend (NestJS) | Linux VPS (Ubuntu 22.04+) | Render / Railway |
| Database | Managed PostgreSQL (e.g., Neon, Supabase, RDS) | Self-hosted PG on the VPS |
| Object storage | S3 compatible (Cloudflare R2, Backblaze, AWS S3) | Cloudinary |
| CDN | Cloudflare in front of the VPS | Vercel edge |

## Domain and DNS

1. Buy the primary domain in the client's account.
2. Point an A record to the VPS IP for the API (`api.example.com`).
3. Point the apex / `www` to Vercel using the Vercel-supplied records.

## Frontend (Vercel)

1. `pnpm install`
2. Connect the repository, select the `apps/web` directory as the Vercel root.
3. Set the build command to `pnpm --filter @pasha9/web build` and output to `.next`.
4. Add env vars: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`.

## Backend (VPS)

1. Install Node.js 20, pnpm, PostgreSQL client, Nginx, certbot.
2. `git clone` the repo, `pnpm install`.
3. Copy `.env.example` to `.env`, fill values.
4. `pnpm --filter @pasha9/database generate && pnpm --filter @pasha9/database migrate deploy`.
5. `pnpm --filter @pasha9/api build && pnpm --filter @pasha9/api start`.
6. Run under PM2 or systemd.
7. Reverse proxy with Nginx + TLS via certbot.

## Database

- Use a managed PostgreSQL instance with daily snapshots.
- Run migrations with `pnpm --filter @pasha9/database migrate deploy` from CI.
- Seed test data with `pnpm --filter @pasha9/database seed` (do not run in production).

## Storage

- Provision an S3 compatible bucket named `Pasha9-uploads`.
- Add lifecycle rule: move objects older than 90 days to cheaper storage class.
- Save credentials to `.env`.

## Mobile APK

- Capacitor wraps the live URL.
- Build the APK with `pnpm --filter @pasha9/mobile build && npx cap sync android && cd android && ./gradlew assembleRelease`.

## Health checks

- Hit `https://api.example.com/health` for backend health.
- Vercel hosts the frontend with built-in monitoring.

## Compliance reminder

The platform is a technical product. The owner must obtain the appropriate license, complete KYC, sign provider agreements, and meet local laws before public launch.

Built by Anointed Coder. Contact: anointedcoder@gmail.com.
