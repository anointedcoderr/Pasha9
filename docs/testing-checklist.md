# Pasha 9 Milestone 1 Testing Checklist

Run end to end on the live VPS (`https://pasha9.com`) before requesting M1 approval. Built by Anointed Coder.

## A. Infrastructure

- [ ] `https://pasha9.com` opens with a valid SSL certificate
- [ ] `https://www.pasha9.com` resolves and redirects to the apex
- [ ] `pm2 status` reports `pasha9-web` as `online`
- [ ] `systemctl is-active nginx postgresql` both print `active`
- [ ] `sudo ufw status` shows allow rules for 22, 80, 443
- [ ] `/var/www/pasha9/uploads/` exists with subfolders `banners`, `games`, `payment-proofs`, `apk`
- [ ] `/var/backups/pasha9/db/` writes a fresh `.sql.gz` after manual run of `backup-db.sh`

## B. Public site

- [ ] Homepage loads in Bangla on a clean browser session (no flash to English)
- [ ] Language toggle in the header switches between BN and EN and persists across reloads
- [ ] HeroSlider shows banners from the database, animates between slides, and respects admin status toggles
- [ ] Promo marquee shows live PromoText entries
- [ ] Game catalogue, slots, fishing, lottery, live casino, sports pages load
- [ ] Promotions, referral, wallet, deposit, withdraw, transactions, profile, support, terms, responsible gaming routes all return 200
- [ ] 404 page renders for unknown paths

## C. Auth flow

- [ ] Header `Register` opens the AuthModal and accepts new account creation
- [ ] Username, phone, password, confirm, agree validators fire with friendly messages
- [ ] After successful registration the session cookie is set, the user lands on `/dashboard`, and a User row exists in PostgreSQL with a bcrypt hash
- [ ] `/api/auth/me` returns the user data
- [ ] Sign out clears the cookies and `pasha9_session` no longer appears in DevTools
- [ ] Login with the same username and password succeeds
- [ ] Login with the wrong password returns `INVALID_CREDENTIALS`
- [ ] Restart PM2 (`pm2 reload pasha9-web`), then log in again. The user persists across restart.
- [ ] Signup with `?r=<existing referralCode>` stores `referredById` on the new user (check via `psql`).
- [ ] `/dashboard/referral` and `/referral` both show the new user's referral code and an invite link.

## D. Admin

- [ ] `/admin/login` rejects unknown credentials with a clear error
- [ ] Super admin login succeeds and redirects to `/admin`
- [ ] Overview shows the deposit/withdraw chart and the recent activity table populated from the audit log
- [ ] `Homepage Content`: edit hero_primary title (BN and EN), save, refresh the public homepage, change appears
- [ ] `Banners and Sliders`: create a banner with accent gold, reorder it, toggle status, edit, delete. Active banners appear in the homepage hero.
- [ ] `Popups`: create with no time window, save, refresh public site, popup payload available via `/api/content/popups`
- [ ] `Promo Text`: add a line, save, marquee updates after page refresh
- [ ] `System Settings`: SMS, tracking, payment fields are present, empty by default, save action works
- [ ] `Activity Log`: lists every admin write performed in this session
- [ ] Logout from admin returns to `/admin/login`

## E. Referral base

- [ ] `User.referralCode` for new users is 8 characters, A-Z and digits, not visually ambiguous
- [ ] Two new users with the same referrer share the same `referredById`
- [ ] `/referral` shows the logged-in user's code, not a placeholder

## F. Branding

- [ ] `pnpm check:branding` exits 0 on the production code
- [ ] Footer of every public page shows `Built by Anointed Coder`, `info@anointedcoder.com`
- [ ] Admin sidebar bottom shows the same credit plus Telegram and WhatsApp buttons
- [ ] Admin login card shows the credit
- [ ] System Settings page shows the credit
- [ ] Source Handover page shows the credit
- [ ] `pnpm check:branding` succeeds; no retired-brand or toolchain references appear in `view-source:`
- [ ] No em dash or en dash anywhere

## G. Mobile

- [ ] At 375px width: header, hero, game rails, promo strip render without horizontal scroll
- [ ] AuthModal opens and submits on a phone
- [ ] Admin login renders without overflow
- [ ] Floating Telegram and WhatsApp buttons reachable in the bottom-right corner

## H. Logs and audit

- [ ] After admin actions, `/admin/activity` shows entries with IP and user agent
- [ ] `pm2 logs pasha9-web --lines 100` is free of unexpected errors

## I. Document presence

- [ ] `docs/deployment-guide.md`
- [ ] `docs/admin-guide.md`
- [ ] `docs/api-guide.md`
- [ ] `docs/backup-guide.md`
- [ ] `docs/migration-guide.md`
- [ ] `docs/handover-checklist.md`
- [ ] `docs/testing-checklist.md`
- [ ] `README.md` with the live URL, deploy command, and credit
