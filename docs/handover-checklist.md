# Pasha 9 Milestone 1 Handover Checklist

Built by Anointed Coder.

## Live links

- Public site: `https://pasha9.com`
- Admin panel: `https://pasha9.com/admin`

## Credentials

Delivered privately to Anointed Coder and the client, never committed to the repo:

- Super admin username
- Super admin password (must be changed on first login)
- PostgreSQL role and password
- Deploy SSH user

## Repository

- `https://github.com/anointedcoderr/Pasha9` (repository was rebranded during Milestone 1)
- Working branch for M1: `m1-production`
- Safety tag captured before backend work: `pre-pasha9`

## Server inventory

- VPS provider: client-owned
- OS: Ubuntu 24.04 LTS
- Runtime: Node 20 LTS, pnpm latest via corepack, PM2 latest
- Database: PostgreSQL 16 bound to `127.0.0.1:5432`
- Web server: Nginx with Let's Encrypt SSL
- Firewall: UFW with ports 22, 80, 443 only

## Folders on disk

- Application: `/var/www/pasha9/app`
- Uploads: `/var/www/pasha9/uploads/{banners,games,payment-proofs,apk}`
- Logs: `/var/log/pasha9/`
- Backups: `/var/backups/pasha9/{db,uploads}/`

## Milestone 1 scope, completed

- [x] Ubuntu server provisioned, Node, pnpm, PM2, PostgreSQL, Nginx, UFW configured
- [x] SSL via Certbot for apex and www
- [x] Domain confirmed at `https://pasha9.com`
- [x] PM2 ecosystem with auto-restart
- [x] PostgreSQL `pasha9_prod` database with role
- [x] Prisma schema with 25 models, initial migration applied
- [x] Seed populates roles, permissions, super admin, banners, popups, promo text, categories, providers, sample games, payment methods, system settings
- [x] JWT-based auth with bcrypt, refresh tracking in DB
- [x] OTP provider-ready adapter (console in dev, noop in production until SMS credentials land)
- [x] Password reset flow with single-use hashed tokens
- [x] Admin CMS: banners, popups, promo text, homepage content live in the DB and editable from the panel
- [x] Public hero slider and marquee read from the database
- [x] Referral code generation on signup; referral capture from `?r=` query
- [x] Activity log writes on every admin action with IP and user-agent
- [x] Local disk upload pipeline with sanitised filenames; Nginx serves `/uploads/*`
- [x] APK download placeholder field in System Settings
- [x] Branding gate blocks retired-brand and toolchain references, em dash, en dash, and asserts the "Built by Anointed Coder" credit in required files
- [x] Built by Anointed Coder shown in footer, admin sidebar, admin login, system settings, source handover, README, docs

## Provider-ready, not connected yet

- SMS provider for OTP and password reset SMS delivery (adapter is in place; admin can add API key once a provider is chosen)
- Tracking pixels (Facebook, TikTok, GA4, Google Ads) (fields present in admin Settings, no IDs hardcoded)
- Payment gateway (manual flow ships in M2)

## What needs to happen before M2

- [ ] Client provides the chosen SMS provider and credentials
- [ ] Client provides the chosen payment gateway documentation
- [ ] Client provides real game provider list and API documentation
- [ ] Client confirms final brand assets (logo file, colour refinements if any)

## Pre-handover steps performed

- [x] `pnpm typecheck` clean
- [x] `pnpm --filter @pasha9/web build` succeeds
- [x] `pnpm check:branding` clean
- [x] Manual run of `scripts/backup-db.sh` produces both archives
- [x] `https://pasha9.com` and `https://www.pasha9.com` return 200/301

## Open items at handover

- Final M2 feature work (deposits, withdrawals, bonuses, turnover, staff UI) starts only after M1 approval.
- Server root password should be rotated by the owner after handover.
- Provider API keys must be kept private and entered via the admin Settings page.

## Contact

- Anointed Coder
- info@anointedcoder.com
- https://t.me/anointedcoder
- https://wa.link/fi5z8a
