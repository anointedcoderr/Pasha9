# Pasha9 Milestone 1 Delivery

Built by Anointed Coder. anointedcoder@gmail.com.

## Live links

- Public site: https://pasha9.com
- Admin panel: https://pasha9.com/admin

## Credentials

Delivered privately, not in this repository:

- Super admin username
- Super admin password (rotate on first login)
- PostgreSQL role and password
- Deploy SSH user

## Repository

- https://github.com/anointedcoderr/Pasha9
- Working branch: `m1-production` (merge to `main` after approval)
- Safety tag captured before M1 backend work: `pre-pasha9`

## What was completed

1. Production server provisioning: Ubuntu 24.04, Node 20 LTS, pnpm, PM2, PostgreSQL 16, Nginx, UFW, Let's Encrypt SSL
2. Domain wired: `pasha9.com` and `www.pasha9.com` both serve HTTPS with auto-renew certbot
3. Database schema with 25 Prisma models, real initial migration, idempotent seed populating system roles, permissions, super admin, banners, popups, promo text, categories, providers, sample games, payment methods, and 20 system setting keys
4. Real authentication: register, login, JWT cookies, bcrypt password hashing, session tracking in DB with revoke on logout, rate-limited per IP and per phone
5. OTP provider-ready adapter (console in dev mode, no-op in production until SMS credentials land); password reset with single-use hashed tokens
6. Admin CMS live in PostgreSQL: banners, popups, promo text, homepage content (bilingual), system settings, activity log, user list. Every write produces an `ActivityLog` row with IP and User-Agent.
7. Public homepage hero and marquee read live data from the API with mock fallback
8. Referral code generation on signup; `?r=CODE` capture from the URL
9. Local disk upload pipeline at `/var/www/pasha9/uploads/{banners,games,payment-proofs,apk}` with sanitised filenames, MIME and size validation, served by Nginx
10. APK download placeholder field in System Settings
11. Branding rules enforced by `scripts/check-branding.mjs` on every build
12. Backup script `scripts/backup-db.sh` writes nightly DB and uploads tarballs to `/var/backups/pasha9/`

## What is provider-ready, not live yet

- SMS / OTP delivery: adapter and admin SMS settings page in place, waiting on provider credentials
- Tracking pixels (Facebook, TikTok, GA4, Google Ads): fields present in admin Settings, no IDs hardcoded
- Game provider integrations: model and admin form ready, no live API connection

## What requires Milestone 2

- Deposit and withdrawal real flows (admin approval, gateway adapter, manual proof fallback)
- Bonus rules with turnover and wager system
- Staff management UI with granular permissions
- Tracking event dispatch when IDs are configured
- Game image upload through the admin (the API exists; the admin form upgrade is M2)

## Server setup summary

```
OS                  Ubuntu 24.04 LTS
Runtime             Node 20 LTS, pnpm via corepack, PM2
Database            PostgreSQL 16 bound to 127.0.0.1
Web server          Nginx with Let's Encrypt SSL
Process manager     PM2, single app pasha9-web
Folders             /var/www/pasha9/{app,uploads}, /var/log/pasha9, /var/backups/pasha9
Firewall            UFW allow 22/80/443
Backups             Cron nightly 03:30 via scripts/backup-db.sh
```

## Database summary

```
Database            pasha9_prod
Role                pasha9
Models              25 (see packages/database/prisma/schema.prisma)
Migration           prisma/migrations/20260521120000_init/migration.sql applied
Seed                packages/database/prisma/seed.ts (idempotent)
```

## Testing checklist

See `docs/testing-checklist.md`. Every item to be ticked before approval.

## Client review request

Please walk through `docs/testing-checklist.md` against the live site, then approve so Milestone 2 work can begin.

## Waiting for Milestone 1 approval before starting Milestone 2.

## Reminders

- Rotate the seeded super admin password on first login (admin profile page).
- Server root password should be changed by the owner now that the server is live.
- Keep all provider API keys private. Enter them through the admin Settings page rather than committing to the repo.
