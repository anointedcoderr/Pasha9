# Pasha 9 Milestone 1 Testing Checklist

Run this on the live site (`https://pasha9.com`) before sign-off. Tick each box. Anything that fails is a release blocker; anything marked `(M2)` is intentionally not in M1 and does not block sign-off.

Built by Anointed Coder.

---

## Pre-flight

- [ ] Latest commit deployed: `git log -1 --oneline` on the VPS matches the head of `m1-production` on GitHub.
- [ ] PM2 status: `pm2 status` shows `pasha9-web` `online` with low restart count.
- [ ] Nginx + SSL: `https://pasha9.com` and `https://www.pasha9.com` both load without warnings, certificate is valid.
- [ ] Latest backup exists: `ls -la /var/backups/pasha9/db/` shows a dump from the last 24h.

---

## Public website

### Homepage (`/`)

- [ ] First-visit popup appears in incognito after about 1 second with Register / Login / Maybe later. Closing it sets `pasha9_first_visit_seen` cookie and the popup does not return on refresh.
- [ ] Hero slider renders. If a video banner is configured it autoplays muted with a mute / unmute toggle top-right. If only image banners, they swap every 6.5 seconds.
- [ ] WalletStrip below the hero shows the right state:
  - Guest: dark gradient with Register / Login CTAs.
  - Logged-in: greeting + balance + refresh icon + Deposit / Withdraw / History buttons.
- [ ] Category slider scrolls horizontally on mobile (Jackpot / Hot / Slot / Casino / Crash / Sports / Fishing / Table).
- [ ] PromoTicker marquee rolls.
- [ ] Game rails (Hot, Slots, Live Casino, Fishing, Crash, Lotto) render in 3 cols on phone, 5-6 cols on desktop.
- [ ] Ambassador + Video section renders with admin-set content.
- [ ] Refer & Earn + Betting Pass promo pair renders.
- [ ] App Download section renders.
- [ ] Footer renders with developer credit on the last line.

### Header (every page)

- [ ] Logo: chunky gold tile + Pasha 9 wordmark. If admin set a remote `logo_url` it renders that image instead.
- [ ] Guest header (mobile + desktop): bell + user icon (opens login) + Login (desktop only) + Register (desktop only).
- [ ] Logged-in header: bell with red dot + balance pill + Deposit (+) + Profile icon + (desktop) Logout. After login, all of these appear without a hard refresh.
- [ ] Notification drawer opens from the bell with empty state for guests and 2 friendly system notifications for logged-in users.

### Mobile bottom nav

- [ ] Guest: `Promotion | Lotto | HOME | Register | Login`. Tap Register / Login opens the auth modal on the correct tab.
- [ ] Logged-in: `Promotion | Lotto | HOME | Betting Pass | Referral`.
- [ ] Tap HOME from any internal page returns to `/`.
- [ ] Active underline stays clear of the iOS gesture bar.

### Mobile drawer (hamburger)

- [ ] Three sections: Main, Games, Others.
- [ ] Others section: Language toggle (chip shows EN / বাং), FAQ, Live Chat, Download App (uses admin APK URL), Logout (logged-in only) / Login + Register (guest only).
- [ ] Tapping any item navigates AND closes the drawer.

### Internal pages

- [ ] `/promotions`, `/lotto`, `/rewards`, `/betting-pass`, `/betting-pass/ipl`, `/referral`, `/affiliate`, `/vip`, `/sports`, `/faq` all render a BackBar at the top with back arrow + Home link + breadcrumb title.
- [ ] Back arrow respects browser history; if the visitor landed directly on the page it routes to `/`.

### Auth flow

- [ ] Register a fresh user. Password fields have eye / eye-off toggle that reveals the value when clicked and is keyboard accessible (Tab + Enter).
- [ ] Login as that user. Header chrome flips to logged-in state without a hard refresh.
- [ ] Session lifetime: wait > 10 minutes idle, navigate to `/dashboard`. Still logged in.
- [ ] Wait > 30 minutes idle, navigate again. Still logged in (transparent refresh).
- [ ] Logout. Header reverts to guest UI.
- [ ] Password change in `/dashboard/security`. Each of the three password fields has its own eye toggle.

### Deposit flow

- [ ] As guest on `/deposit`: amber "You must be logged in" banner shows with a Log in button. Submit button disabled.
- [ ] As logged-in on `/deposit`: banner hidden, submit enabled.
- [ ] Enter amount `1200`, choose method, paste TX ID, submit.
- [ ] Confirmation card shows `Reference: <real cuid>`.
- [ ] Server check: `SELECT id, "userId", amount, status FROM "Deposit" ORDER BY "createdAt" DESC LIMIT 1;` returns your row with `status='pending'`.

### Withdrawal flow

- [ ] As logged-in on `/withdraw`: balance label matches `/dashboard` wallet balance.
- [ ] Attempt amount higher than balance: server error reads `INSUFFICIENT_FUNDS` with HTTP 400 detail.
- [ ] Submit a valid amount with method + account + holder. Confirmation card shows `Reference: <real cuid>`.
- [ ] Server check: `SELECT * FROM "Withdrawal" ORDER BY "createdAt" DESC LIMIT 1;` returns the row with `status='pending'`.

### Lotto

- [ ] `/lotto` top strip shows "Every day at 7:30 PM BST".
- [ ] Guest sees the "How to earn tickets" card with Register / Login CTAs.
- [ ] Logged-in user sees their ticket count, lotto balance and progress bar toward the next 2-ticket block.
- [ ] Prize structure cards show 1st 2000x / 2nd 800x / 3rd 300x / Special 150x / Consolation 30x.
- [ ] iBox explainer with 1234 and 1111 examples.
- [ ] Lottery Rules & FAQ accordion: 7 items in both Bangla and English.
- [ ] Latest Results panel: shows winning number digits as gold chips (after the admin settles a draw).

### Affiliate

- [ ] `/affiliate` public page renders the tier table (data live from DB).
- [ ] Logged-in `/dashboard/affiliate` shows the referral code + link, KPIs, downline tabs. Apply button works for non-affiliates.

### Floating support

- [ ] Yellow chat bubble bottom-right on every public + dashboard page.
- [ ] Tap opens a clean white panel listing WhatsApp / Telegram (only when set) + Live Chat (always shown) + Email (only when set).
- [ ] Escape and outside-click close the panel.

### Dashboard

- [ ] Mobile: dashboard nav is collapsed into a "Dashboard / <active>" bar. Tap opens the list; tapping an item navigates AND closes the list.
- [ ] Desktop: dashboard sidebar is sticky on the left.
- [ ] Every item (Overview, Wallet, Deposit, Withdraw, Bonus Center, Referral, Affiliate, Transactions, Profile, Security) opens and renders without redirect to login.

### Internationalisation

- [ ] Switch language to বাং in the header or drawer. All visible labels render in Bangla. No flash to English on refresh.
- [ ] Switch back to EN. No flash to Bangla on refresh.

---

## Admin panel

### Sidebar

- [ ] Desktop: sidebar shows the 10-section structure - Overview, Operations, Users & Money, Bonus & Affiliate, Content & Media, Lotto & Rewards, Games, Reports & Marketing, Security & Staff, System.
- [ ] **Mobile: tap the hamburger in the topbar. A slide-in drawer opens with the same section structure. Tapping an item navigates AND closes the drawer.**

### Login

- [ ] `/admin/login` loads. Logo size is `lg`. Password field has eye toggle.
- [ ] Wrong password shows an inline error.
- [ ] Correct password redirects to `/admin`.

### Control Center (`/admin`)

- [ ] 8 stat tiles render with real numbers.
- [ ] Pending queue card lists the 5 newest pending deposits and 5 newest pending withdrawals with Review links.
- [ ] Shortcuts card has 6 Quick links.
- [ ] Recent activity table shows real `ActivityLog` rows.
- [ ] Snapshot timestamp at the bottom of the page renders.
- [ ] Refresh button works and re-fetches.

### Deposits (`/admin/deposits`)

- [ ] Pending rows appear immediately after a user submits a deposit on `/deposit`.
- [ ] Click Approve. Toast confirms `N lottery ticket(s) generated`. Server check:
  - `SELECT * FROM "Transaction" WHERE type='deposit' ORDER BY "createdAt" DESC LIMIT 1;` shows the new credit row.
  - `SELECT balance FROM "Wallet" WHERE "userId"='<id>';` shows the new balance.
  - `SELECT count(*) FROM "LotteryTicket" WHERE "userId"='<id>';` matches `floor(totalApproved / 1200) * 2`.
- [ ] Click Reject. Status flips to `rejected`. Wallet unchanged.

### Withdrawals (`/admin/withdrawals`)

- [ ] Pending rows appear after a user submits on `/withdraw`.
- [ ] Click Approve. Toast confirms wallet debited. Server check:
  - `SELECT balance FROM "Wallet"` shows the new lower balance.
  - `SELECT * FROM "Transaction" WHERE type='withdraw' ORDER BY "createdAt" DESC LIMIT 1;` shows the debit row.
- [ ] Approve attempt that would overdraw the wallet returns `INSUFFICIENT_FUNDS`.
- [ ] Click Reject. Status flips, wallet unchanged.

### Lotto (`/admin/lotto`)

- [ ] Daily 4D draw row shows `awaiting settlement` chip.
- [ ] Click Settle. Enter a 4-digit winning number and the 5 multipliers. Save.
- [ ] Toast: `Published <number>. N winner(s), <BDT> paid.`
- [ ] Row chip flips to `settled · <number>`.
- [ ] On the public `/lotto`, the Latest Results panel renders the new winning number.
- [ ] Logged-in user whose ticket matched sees lotto balance increase.

### Website Customization (`/admin/website`)

- [ ] Type a `logo_url` (publicly accessible PNG / SVG). Save.
- [ ] Refresh public site: Header logo and admin sidebar logo render that image instead of the bundled SVG.
- [ ] Type a `favicon_url`. Save. Refresh: browser tab icon updates.
- [ ] Clear `logo_url`. Refresh: bundled gold SVG mark returns.

### Banners (`/admin/banners`)

- [ ] Create an image banner: choose `image`, set Image URL + title + subtitle + CTA. Save. Hero shows it on `/`.
- [ ] Create a video banner: choose `video`, paste Video URL (small MP4) + Poster URL. Save. Hero autoplays the video muted with a mute toggle.
- [ ] Row preview shows the `image` / `video` chip and the active URL.

### Popups (`/admin/popups`)

- [ ] Create a popup. First visit shows it via `AnnouncementPopup`. Cookie `pasha9_popup_seen` suppresses it on refresh.

### Promo Text (`/admin/promo-text`)

- [ ] Add a line. Marquee on homepage picks it up on next page load.

### Homepage (`/admin/homepage`)

- [ ] Edit a section. Reload `/`: the new copy appears.

### Ambassador (`/admin/ambassador`)

- [ ] Edit ambassador 1 + ambassador 2 + video URL + active toggle. Public homepage section reflects it.

### Rewards (`/admin/rewards`)

- [ ] CRUD a reward. `/rewards` Reward Store shows it.

### Categories + Providers + Games

- [ ] CRUD a category. Public category nav reflects it.
- [ ] CRUD a provider. Provider filter pills reflect it.
- [ ] CRUD a game. Homepage rails + category pages reflect it.

### Users (`/admin/users`)

- [ ] Loads. (Full CRUD + status toggle UI is M2.)

### Activity Log (`/admin/activity`)

- [ ] Loads. Recent rows match `SELECT * FROM "ActivityLog" ORDER BY "createdAt" DESC LIMIT 20;`.

### Reports (`/admin/reports`)

- [ ] Stat tiles match `/admin` Control Center.
- [ ] Cash flow and Lotto exposure cards render real totals.
- [ ] Ready-for-M2 grid renders with the dashed chips.

### Security (`/admin/security`)

- [ ] Loads. Each row carries a clear Live / Requires provider / Ready for M2 chip.

### Staff (`/admin/staff`)

- [ ] Read-only role + permission matrix renders with the seed data: super_admin (all), admin (most), staff (read + review).

### Marketing (`/admin/marketing`)

- [ ] Live channel cards link out to the existing CRUD pages.
- [ ] Ready-for-M2 cards render dashed.

### Settings (`/admin/settings`)

- [ ] All fields editable. Maintenance Mode toggle uses the amber / red tone (not green).
- [ ] Save. Run `SELECT key, value FROM "SystemSetting" WHERE key='maintenance_mode';` to confirm persistence.

### Source Handover (`/admin/handover`)

- [ ] Loads with the developer credit block.

---

## Security checklist

- [ ] HTTPS only (HSTS via Nginx). HTTP requests redirect to HTTPS.
- [ ] Session cookies are `HttpOnly + Secure + SameSite=Lax`. Verify in browser devtools.
- [ ] `/api/auth/me` returns 401 for unauthenticated callers (curl test).
- [ ] `/api/admin/*` returns 401 / 403 for non-admin or unauthenticated callers.
- [ ] Rate limit: 11th login attempt in 60s from the same IP returns 429.
- [ ] Branding gate passes locally and in CI: `pnpm check:branding` exits 0.
- [ ] No secrets in git. `git log --all -- .env` returns nothing. The deployment guide does not contain a real password.
- [ ] Super admin password rotated after first login. Old seed default is invalid.
- [ ] Database role used by the app is NOT the `postgres` superuser.
- [ ] UFW: only ports 22, 80, 443 are open. `sudo ufw status verbose`.

---

## Backup checklist

- [ ] Nightly cron exists: `sudo crontab -l` shows the backup-db.sh entry.
- [ ] Latest dump exists: `ls -la /var/backups/pasha9/db/` lists a `.sql.gz` dated within the last 24h.
- [ ] Latest uploads tarball exists: `ls -la /var/backups/pasha9/uploads/`.
- [ ] Rotation works: count of dumps in `/var/backups/pasha9/db/` is <= 14.
- [ ] Restore drill (run during a quiet window):
  - `sudo -iu postgres createdb sanjid14_restore_test`
  - `gunzip -c /var/backups/pasha9/db/<dump>.sql.gz | sudo -iu postgres psql sanjid14_restore_test`
  - Spot-check a few row counts vs production.
  - `sudo -iu postgres dropdb sanjid14_restore_test` when done.

---

## Performance & monitoring

- [ ] PM2 logs are reasonable size: `ls -lh /var/log/pasha9/` shows logs under 100 MB; logrotate is configured.
- [ ] Largest page bundle is reasonable: `/admin` around 217 kB First Load, `/lotto` around 118 kB, `/affiliate` around 141 kB. Verify with `pnpm build` output.
- [ ] First Load JS shared: around 87 kB.

---

## Final deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git checkout m1-production
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a
source .env
set +a
pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm exec prisma db push --schema packages/database/prisma/schema.prisma
pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

## Rollback (anything goes wrong)

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard <previous_short_sha>
pnpm install --prod=false
pnpm build
pm2 restart pasha9-web --update-env
pm2 save

# Only if a schema change must be undone (rare, every Phase 8 change is additive):
ls -la /var/backups/pasha9/db/
sudo -iu postgres gunzip -c /var/backups/pasha9/db/<dump>.sql.gz | psql sanjid14
```

Every Phase 8 schema change was additive (new tables, new nullable columns, new default-valued columns). A simple `git reset` + `pnpm build` reverts any UI or API change without touching the database.

---

## Sign-off

- [ ] Client has walked through every section above on the live site.
- [ ] Client has approved Milestone 1 in writing (email or Telegram).
- [ ] Tag `m1-final-delivery` exists on the `m1-production` branch.

For anything that needs the developer: `info@anointedcoder.com`, Telegram `https://t.me/anointedcoder`, WhatsApp `https://wa.link/fi5z8a`.
