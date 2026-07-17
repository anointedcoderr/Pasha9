# Pasha9 Project Handover

Prepared by the Anointed Coder team. Contact: info@anointedcoder.com

This document hands the Pasha9 platform to the owner in full, with no lock-in. It covers what was delivered, how to run and deploy everything yourself, the ownership transfer of every account, the configuration you control, an honest list of what is not yet done, and the security steps to take at handover.

Ownership note: the owner receives complete ownership of this running instance and the full source. The Anointed Coder team retains the codebase as its author for portfolio and for building future projects, as agreed. This does not affect the owner's rights over the Pasha9 instance, its data, its domain, or its accounts.

---

## 1. What you are receiving

- A live web platform at `pasha9.com` (Next.js 14, PostgreSQL 16, PM2, Nginx, Cloudflare).
- A native Android player app (React Native + Expo SDK 54), matching the website design, running on the same backend and admin panel.
- The complete monorepo source: `apps/web` (site + admin + API), `mobile` (the app), `packages/database` (Prisma schema), `scripts`, `nginx`, and `docs`.
- An admin panel that controls almost all content and settings without code (banners, games, promotions, payments, referral, rewards, jackpot, contacts, the app download, and more).

Production branch: `m1-production`. Do not deploy `main` (it is an old milestone baseline, roughly 200 commits behind).

---

## 2. Ownership transfer (do these first)

Three accounts are still under the Anointed Coder team and must move to you so you never depend on us. To do them we need three details from you: your GitHub username, your Expo account, and your Google (Gmail) account.

| Asset | Identifier | How it transfers to you |
|---|---|---|
| GitHub repository | `github.com/anointedcoderr/Pasha9` (prod branch `m1-production`) | You get your own copy under your GitHub account (we keep ours as authors). See 2.1. |
| Expo / EAS project | `@anointedcoder/pasha9`, projectId `13996c0f-e7a6-4168-bba8-04ef13dbd5ca` | Transfer the project to your Expo account so you can rebuild the app. See 2.2. |
| Firebase project | `pasha9-c61fd` | Add your Google account as Owner. Keeps push working. See 2.3. |
| VPS (origin server) | Ubuntu 24.04, `/var/www/pasha9`, IP `69.62.76.83` | Hand over hosting-account and SSH credentials. Rotate the root password. See 2.4. |
| Cloudflare + domain | `pasha9.com` zone + registrar | Move the zone and domain to your accounts. See 2.5. |
| Admin super-admin | seeded `pasha9.admin` | Change the password on first login, create your own super-admin, disable ours. See 2.6. |
| Vendor accounts | Payment gateways, SMS, game provider, Telegram bot | Ensure each is registered in your name; re-enter fresh keys in admin. See section 9. |

### 2.1 GitHub

So you own your production repository while we keep our authoring copy, create a repository under your account and point the server at it:

1. Create an empty private repo in your GitHub account, for example `Pasha9`.
2. On any machine with the code (or on the VPS), add your repo as a remote and push:
   ```
   git remote add client https://github.com/<CLIENT_GITHUB>/Pasha9.git
   git push client m1-production
   git push client --tags
   ```
3. Repoint the VPS deploy to your repo so all future deploys pull from you:
   ```
   cd /var/www/pasha9/app
   git remote set-url origin https://github.com/<CLIENT_GITHUB>/Pasha9.git
   git fetch origin && git checkout m1-production
   ```
From then on, `./scripts/deploy.sh` on the VPS pulls from your repository.

### 2.2 Expo / EAS (needed to rebuild the app)

The app's build identity lives in an Expo project. To rebuild the app yourself:

1. Create an Expo account (or an Expo organization) at expo.dev in your name.
2. We transfer the project `@anointedcoder/pasha9` to your account or organization from the Expo dashboard (Project settings, Transfer). The projectId in `mobile/app.json` stays valid after transfer.
3. You sign in with `eas login` and can then run `eas build` (section 5).

The Android signing keystore is managed by EAS and moves with the project. Keep the package id `com.pasha9.player` unchanged (it is tied to Firebase and the keystore).

### 2.3 Firebase (needed for push to keep working)

Push notifications and forgot-password Phone Auth use Firebase project `pasha9-c61fd`.

1. Firebase Console, project `pasha9-c61fd`, Project settings, Users and permissions.
2. Add your Google account `<CLIENT_GOOGLE_EMAIL>` with the Owner role.
3. After you confirm access, we remove our account.
4. The Android push credential (FCM V1 service account key) is uploaded to EAS credentials for the app builds. Keep it valid, or regenerate a key in Firebase (Project settings, Service accounts) and upload it via `eas credentials`.

### 2.4 VPS

The production server holds the app, database, and uploaded files.

- App path `/var/www/pasha9/app`, uploads `/var/www/pasha9/uploads`, logs `/var/log/pasha9`, PM2 app `pasha9-web` on `127.0.0.1:3000`.
- We hand over the hosting-account billing and SSH root or sudo credentials.
- After receipt, change the server root password and replace the SSH keys.

### 2.5 Cloudflare and domain

- The `pasha9.com` zone and DNS live in Cloudflare, with the origin firewalled to Cloudflare ranges and a WAF skip rule for webhooks and cron. Full detail in `docs/CLOUDFLARE-SETUP.md`.
- Move the Cloudflare zone to your Cloudflare account and transfer the domain to your registrar, or take over the existing logins. Nameservers point at Cloudflare.

### 2.6 Admin super-admin

- A super-admin account is seeded (default username `pasha9.admin`); the password is supplied at seed time, never stored in the code.
- We give you the super-admin login privately. On first login, change the password, create your own super-admin, then disable or rotate ours.

---

## 3. Repository layout

```
apps/web          Next.js site, admin panel, and API
mobile            React Native + Expo player app
packages/database Prisma schema and seed
scripts           deploy.sh, backup-db.sh, cloudflare-ufw.sh
nginx             pasha9.conf (production Nginx)
docs              all guides (this file, deployment, cloudflare, backup, admin, api)
```

---

## 4. Deploying the web app

Everything ships with a single script on the VPS.

```
cd /var/www/pasha9/app
./scripts/deploy.sh
```

What it does, in order: fetches and hard-resets to `m1-production`, installs dependencies with pnpm, loads `DATABASE_URL` from the env file, runs `prisma generate` and `prisma db push` (this project evolves the schema with `db push`, not migrations), clean-builds the web app, restarts PM2 (`pasha9-web`), and prints the last log lines.

Stack: Next.js 14.2.15, Node 20, pnpm 9, PostgreSQL 16 (database `pasha9_prod`, role `pasha9`), Prisma 5, PM2. Logs at `/var/log/pasha9/web.out.log` and `web.err.log`.

Note: `docs/deployment-guide.md` is older than the script in two spots (it mentions `main` and `migrate deploy`). The correct references are `scripts/deploy.sh` and this document: deploy `m1-production` and use `db push`.

---

## 5. Rebuilding and publishing the mobile app

The app is built in Expo's cloud. You do not need Android Studio.

1. From your machine, in the `mobile` folder:
   ```
   cd mobile
   eas login
   eas build --profile preview --platform android
   ```
   The `preview` profile produces an installable `.apk`. (The `production` profile builds an `.aab` for the Play Store, which is not sideloadable.)
2. When the build finishes, Expo gives you a download link for the APK.
3. Publish it to the site: Admin, Settings, App Download (APK) card. Click Choose APK, select the file, optionally set the version, then Save Settings. The Download button appears on the site home automatically. For a file larger than the 90 MB upload limit, copy it to `/var/www/pasha9/uploads/apk/` on the server and paste the path into the Download URL field instead.

The app icon and splash are committed PNGs in `mobile/assets` and are applied at build time. The API base is `https://pasha9.com`, set in `mobile/app.json` under `extra.apiBaseUrl` (change it there to point at staging if ever needed). Package id `com.pasha9.player`.

---

## 6. Push notifications (how it works and what to keep)

- After a player logs in, the app registers an Expo push token to `POST /api/me/device-tokens` and stores it. It is defensive: it does nothing on a simulator, when permission is denied, or when no Expo project id is present.
- When the platform creates any player notification (deposit and withdrawal outcomes, bonuses, promotions, VIP, and more), the backend sends it to the Expo push service, which delivers to the phone. This is best-effort and never blocks the action that raised it.
- To keep push working long term you need: ownership of the Expo project (section 2.2), valid Firebase FCM V1 credentials for `pasha9-c61fd` uploaded to EAS credentials (section 2.3), and the package id `com.pasha9.player` unchanged.
- Optional: set `EXPO_ACCESS_TOKEN` in the server env for higher-throughput sends. Not required for basic delivery.

Full push deploy detail is in `docs/admin-push-deploy.md`.

---

## 7. Environment variables

The web app reads its secrets from an env file on the VPS (`/var/www/pasha9/app/.env` or `.env.production`). It is never committed. Use `.env.example` as the template. The most important variables:

Required for the site to run:
- `DATABASE_URL` (Postgres connection, contains the DB password)
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (at least 16 characters, must be different; production refuses to start otherwise)
- `SECRETS_KEY` (a 64 hex character key; this encrypts provider API secrets and admin two-factor seeds at rest, and signs the two-factor challenge token). Set this. See the security note below.
- `CRON_SECRET` (the Bearer token that authenticates the scheduled jobs). Without it, unattended automation does nothing.
- `UPLOAD_ROOT` (`/var/www/pasha9/uploads` in production)

Required for real money and messaging (these are set in the admin panel, not env, except the base URL):
- `PUBLIC_BASE_URL` (env, for correct payment callback and return URLs)
- Payment gateway keys, SMS provider keys, and the game provider keys are entered in the admin panel (section 8).

Optional channels:
- `FIREBASE_*` (forgot-password Phone Auth and admin phone push)
- `VAPID_*` (browser web push for admins)
- `EMAIL_SMTP_*` (transactional email)
- `EXPO_ACCESS_TOKEN` (mobile push throughput)

Security note on `SECRETS_KEY`: if `SECRETS_KEY` is not set, the code falls back to `JWT_SECRET`, and if that is also unset the two-factor challenge token is signed with a known public development constant. Confirm that `SECRETS_KEY` (or a strong `JWT_SECRET`) is set in the live env before launch. Important: once secrets are encrypted with this key, changing it makes the already-encrypted admin values (provider credentials, tokens, two-factor seeds) unreadable. Set it once, deliberately, and re-enter those admin values if you ever rotate it.

---

## 8. What you control from the admin panel (no code)

Almost all content and settings are admin-controlled, and every change flows to both the website and the app because they share one backend. Highlights (full map in `docs/admin-guide.md`):

- Banners and hero art: `/admin/banners`, promotion and lotto and betting-pass banners, and `/admin/atelier` backdrops.
- Homepage layout and sections: `/admin/homepage`, `/admin/homepage-sections`, `/admin/homepage-shortcuts`, `/admin/homepage-videos`, `/admin/homepage-promo-pair`.
- Categories, providers, and native games: `/admin/categories`, `/admin/providers`, `/admin/native-games`, `/admin/wingo`.
- Payments and withdrawals: `/admin/payments`, `/admin/payment-methods`, `/admin/payouts`, `/admin/withdrawals`, `/admin/deposits`, `/admin/withdrawal-limits`, `/admin/deposit-bonus-tiers`.
- Support contacts and social: `/admin/settings`, `/admin/social-links`.
- Referral and affiliate: `/admin/affiliate`, `/admin/referrals`, and referral globals on `/admin/settings`.
- Rewards, coins, and spin: `/admin/rewards`, `/admin/spin-segments`, `/admin/spin-tiers`, reward coins on `/admin/settings`.
- Jackpot, promotions, tournaments, lotto, cashback, VIP, betting pass: `/admin/website`, `/admin/promotions`, `/admin/promo-codes`, `/admin/tournaments`, `/admin/lotto`, `/admin/cashback`, `/admin/vip`, `/admin/betting-pass`.
- Notifications, tracking pixels, SMS provider, WhatsApp: `/admin/notifications`, `/admin/whatsapp`.
- App download and popups: `/admin/settings` (App Download card), `/admin/welcome-popup`.

---

## 9. Configuration you must set before a real launch

Nothing sensitive is hardcoded. These are the switches that must be turned on with real credentials before the platform can take real money and send real messages:

1. Secrets in env: `SECRETS_KEY`, `CRON_SECRET`, `PUBLIC_BASE_URL` (in addition to the JWT and database values already live).
2. At least one live payment gateway in `/admin/payments` (bKash, Nagad, Rocket, ChaopaoPay, or ZiniPay) with its merchant id, keys, callback secret, and enabled flag.
3. SMS or OTP provider in `/admin/notifications` so registration, login OTP, and password reset actually send. The deploy template ships OTP as a no-op.
4. Game provider credentials in `/admin/providers` (currently one adapter, JILI via iGamingAPIs) with the API token and key, then ramp from Maintenance to Live per `docs/PROVIDER-SETUP.md`. There are still a few open items pending the provider's confirmation (launch URL shape, callback field mapping, refund semantics); confirm these with the provider before enabling real-money play on their games.
5. Firebase env values only if you use forgot-password Phone Auth or admin phone push.
6. Turn on the games you want players to see: native games and WinGo are OFF by default (see known issues), and only Dice and Mines are seeded active among the in-house games.

---

## 10. Backups

- A nightly backup runs at 03:30 (database dump plus an uploads archive) into `/var/backups/pasha9`, keeping 14 days.
- Manual backup: run `scripts/backup-db.sh` on the VPS.
- Restore: stop `pasha9-web`, restore the database dump and the uploads archive, then start `pasha9-web` (see `docs/backup-guide.md`). If the `psql -U pasha9` form is refused by the server, restore as the postgres superuser: `sudo -u postgres psql pasha9_prod < dump.sql`.
- Off-site backup is not configured. Before public launch, copy `/var/backups/pasha9` to a second location (for example rclone or rsync over SSH to another host).

---

## 11. Known issues and what is not yet done (honest)

- Native games and WinGo are OFF by default. Players see provider games only until you enable them in `/admin/native-games` and `/admin/wingo`. Among the in-house games, only Dice and Mines are seeded active; Keno, Roulette, Slots, and Crash ship in a Coming Soon state and should be tested before you enable them. In the app, those non-enabled native games show a Coming Soon screen; WinGo has a live screen.
- Lotto manual number pick is not a purchase flow. Tickets are accrued from approved deposits, and the manual pick card is marked Coming Soon on both web and app. The live lotto action (transfer winnings to the main wallet) works.
- The mobile app is English-primary. The website has full Bangla and English switching; the newer app account and engagement screens are written in English. Full app translation is a follow-up.
- Real-money flow is credential-gated. Deposits, withdrawals, OTP, and provider games do nothing until you enter live credentials (section 9). This is by design, not a bug.
- Two scheduled jobs to confirm on the server: `wingo-tick` and `tournament-tick` exist in the code and should be in the crontab (running every minute on the loopback with the Bearer cron secret). If they are not scheduled on the live server, WinGo rounds and tournaments only settle when a player opens the page. Confirm the live crontab includes them.
- The `.env.example` and the older deployment guide did not list `CRON_SECRET`, `SECRETS_KEY`, `PUBLIC_BASE_URL`, and the optional channel keys. This document is the current source of truth for env; `.env.example` has been updated to match.
- The two-factor challenge token has a weak fallback if `SECRETS_KEY` and `JWT_SECRET` are both unset (section 7). Verify the live env sets `SECRETS_KEY`. Hardening this fallback in code is a recommended small follow-up.

---

## 12. Security actions at handover

- Rotate every secret that passed through us: the Telegram bot token (regenerate in BotFather, paste in `/admin/notifications`), the `CRON_SECRET` (update the env value and the crontab lines together, since cron embeds the literal value), and any payment, SMS, or provider keys shared during setup (rotate at the vendor portal, re-enter in admin).
- Do not blindly rotate `SECRETS_KEY` or the JWT secrets: rotating `SECRETS_KEY` makes already-encrypted admin values unreadable. If you must, re-enter the encrypted admin values afterward.
- Change the server root password and SSH keys after you receive the VPS.
- Change the admin super-admin password on first login and disable the account we hand over.
- Delete the test accounts `pasha_m_test` and `pasha_tg_test` from the production database.

---

## 13. Support

For questions during transition, contact the Anointed Coder team at info@anointedcoder.com. You own the complete source and can run and maintain the platform independently: deployment is a plain git pull plus `scripts/deploy.sh` on your own server, and all operational settings live in your env file or in admin settings you control.

Built by the Anointed Coder Team.
