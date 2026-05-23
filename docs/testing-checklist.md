## Pasha 9 Milestone 1 Testing Checklist

Run end to end on the live VPS at `https://pasha9.com` before requesting M1 approval. Built by Anointed Coder.

Open the site in a clean incognito window for every visual test so cached state does not mask issues.

### A. Infrastructure

- [ ] `https://pasha9.com` returns 200 with a valid SSL certificate
- [ ] `https://www.pasha9.com` resolves and redirects (or returns 200)
- [ ] `pm2 status` reports `pasha9-web` as `online`, restart count under 10
- [ ] `pm2 logs pasha9-web --lines 100 --nostream` has no recurring stack traces
- [ ] `systemctl is-active nginx postgresql` both `active`
- [ ] `ufw status` shows only 22, 80, 443
- [ ] `/var/www/pasha9/uploads/` exists with subfolders banners, games, payment-proofs, apk
- [ ] `scripts/backup-db.sh` produces fresh archives manually

### B. Branding

- [ ] `pnpm check:branding` exits 0
- [ ] Header logo reads "Pasha 9" with visible space, the 9 is yellow
- [ ] Page title in browser tab reads "Pasha 9 | Royal Bangla Casino"
- [ ] Footer last line shows Built by Anointed Coder, info@anointedcoder.com, Telegram and WhatsApp pills
- [ ] No `sanjid14` text on any rendered page or in `view-source:` for `/`, `/admin/login`
- [ ] No em dash or en dash visible anywhere

### C. Public site theme + chrome

- [ ] First incognito visit paints in Bangla, no flash to English
- [ ] Language toggle switches BN to EN and persists across reloads
- [ ] Header is white on desktop, has Login (blue) + Register (yellow) for guests, balance pill for logged-in users
- [ ] Category nav strip is dark with yellow active underline
- [ ] Custom HOT marker on Betting Pass, NEW markers on Crash, Fast, VIP, Rewards, Lotto
- [ ] Mobile top: app download strip with close button + compact white header with hamburger
- [ ] Mobile drawer: white background, grouped Main + Games sections, yellow active state, body locks scroll while open
- [ ] Mobile sticky bottom nav: 4 slots (Promotion, Lotto, raised yellow center, Login or Profile)
- [ ] For guests the raised yellow circle is Register; for logged-in users it is Deposit
- [ ] Profile slot shows current balance under the avatar after login
- [ ] Floating support button only appears once admin sets a Telegram or WhatsApp link in Settings

### D. Public homepage

- [ ] First incognito visit shows the announcement popup, close button works, cookie prevents re-showing for 1 day
- [ ] Hero carousel pulls banners from `/api/content/banners`, dots and arrows work
- [ ] Promo marquee scrolls live PromoText entries
- [ ] Jackpot strip shows mini, grand, major and increments every ~1s
- [ ] Quick action 3-step strip (Register, Deposit, Play) renders
- [ ] Hot, Slots, Live Casino, Fishing, Crash, Lotto rails populate
- [ ] First tile of Hot has the HOT marker, first tile of Crash and Lotto has the NEW marker
- [ ] Ambassador and Video section renders, uses placeholder visuals when admin has not set values
- [ ] Sports cards carousel scrolls horizontally
- [ ] Refer and Earn → `/affiliate` and Betting Pass → `/betting-pass` promo cards link correctly
- [ ] App Download section renders, Download Now opens the configured APK URL (or `/apk` when empty)

### E. Public secondary pages

- [ ] `/slots`, `/live-casino`, `/fishing`, `/games`, `/games/[category]` (try crash, table, fast) all render the CategoryHero + provider pills + sort + search + dense grid + Load More
- [ ] `/promotions` renders large image-first promo cards, type filter pills work
- [ ] `/rewards` shows three tabs (Reward Store, Check In, Spin), spin wheel SVG renders, Claim buttons disabled with M2 tooltip
- [ ] `/lotto` shows 4 draw cards with masked digit chips, How It Works
- [ ] `/betting-pass`, `/betting-pass/ipl`, `/vip` render with their M2 notice
- [ ] `/affiliate` shows hero, perk cards, full commission tier table from DB, How It Works, FAQ, application form

### F. Auth

- [ ] Signup via AuthModal creates a User with bcrypt hash and 8-char referralCode
- [ ] Login with phone or username succeeds
- [ ] Wrong password returns INVALID_CREDENTIALS
- [ ] `pasha9_session` httpOnly cookie set after login
- [ ] Logout clears both `pasha9_session` and `pasha9_refresh`
- [ ] `/dashboard/*` redirects to home with `?login=1` when not signed in
- [ ] `/admin/*` (except login) redirects to `/admin/login` when not signed in
- [ ] Admin login rejects a player account with INVALID_CREDENTIALS
- [ ] Change password from `/admin/profile` works and you can log back in with the new one
- [ ] Change password revokes other sessions

### G. Affiliate flow

- [ ] As a new player, visit `/affiliate`, fill the application form, submit
- [ ] `/dashboard/affiliate` shows "Application under review"
- [ ] Super admin sees the application in `/admin/affiliate`, opens the drawer
- [ ] Approve action with optional tier assignment moves the user to active
- [ ] User's `/dashboard/affiliate` now shows referral code, copy buttons, KPIs, downline tabs
- [ ] Copy code and copy link both put the value on the clipboard
- [ ] Signing up another user with the affiliate's `?r=CODE` link populates `referredById`
- [ ] Downline tab Level 1 shows the new user
- [ ] Suspend, Activate, Reset actions update the user correctly
- [ ] `/admin/affiliate/tiers` edit changes percentages, the public `/affiliate` tier table reflects them within 30 seconds
- [ ] Delete refuses with TIER_IN_USE error when a user is assigned to the tier
- [ ] Activity Log captures AFFILIATE_APPLY, AFFILIATE_APPROVE, AFFILIATE_REJECT, COMMISSION_TIER_UPDATE entries

### H. Admin content management

- [ ] Admin chrome reads white with yellow active rail, no dark surface bleeds through any page
- [ ] `/admin/banners`: create, edit, toggle, reorder, delete works; hero on `/` updates
- [ ] `/admin/popups`: create one with no time window, save, fresh incognito on `/` shows it
- [ ] `/admin/promo-text`: add a line, save, marquee on `/` updates
- [ ] `/admin/homepage`: edit hero_primary title (BN), save, public homepage updates
- [ ] `/admin/ambassador`: change ambassador name, save, AmbassadorVideoSection on `/` updates; toggle active off, section hides
- [ ] `/admin/lotto`: edit Daily 4D prize pool, save, `/lotto` updates within cache window
- [ ] `/admin/rewards`: edit Mobile Recharge 500 cost, save, `/rewards` Reward Store tab updates
- [ ] `/admin/settings` → Public Support Contacts: paste Telegram and WhatsApp, save, footer Follow column and floating button appear on the public site
- [ ] `/admin/settings` → Mobile App (APK): paste a URL and version, save, homepage App Download CTA opens that URL
- [ ] `/admin/activity` shows every admin write with actor, action, IP and user-agent
- [ ] `/admin/handover` and `/admin/settings` show the Built by Anointed Coder credit

### I. Mobile

- [ ] At 375 px and 414 px widths every page renders without horizontal scroll
- [ ] AuthModal opens and submits cleanly on a real phone
- [ ] Bottom sticky nav is reachable and the raised yellow button is centred
- [ ] Drawer opens on hamburger tap and locks scroll
- [ ] Floating support button does not overlap the bottom nav

### J. Database integrity (run before delivery)

```
sudo -u postgres psql sanjid14 -c "
SELECT 'roles' AS t, count(*) FROM \"Role\"
UNION ALL SELECT 'permissions', count(*) FROM \"Permission\"
UNION ALL SELECT 'role_perms', count(*) FROM \"RolePermission\"
UNION ALL SELECT 'super_admins', count(*) FROM \"User\" u JOIN \"Role\" r ON u.\"roleId\"=r.id WHERE r.key='super_admin'
UNION ALL SELECT 'banners', count(*) FROM \"Banner\"
UNION ALL SELECT 'popups', count(*) FROM \"PopupAnnouncement\"
UNION ALL SELECT 'promo_text', count(*) FROM \"PromoText\"
UNION ALL SELECT 'homepage_sections', count(*) FROM \"HomepageContent\"
UNION ALL SELECT 'categories', count(*) FROM \"GameCategory\"
UNION ALL SELECT 'providers', count(*) FROM \"GameProvider\"
UNION ALL SELECT 'games', count(*) FROM \"Game\"
UNION ALL SELECT 'payment_methods', count(*) FROM \"PaymentMethod\"
UNION ALL SELECT 'system_settings', count(*) FROM \"SystemSetting\"
UNION ALL SELECT 'commission_tiers', count(*) FROM \"CommissionTier\"
UNION ALL SELECT 'lotto_draws', count(*) FROM \"LottoDraw\"
UNION ALL SELECT 'reward_items', count(*) FROM \"RewardItem\";
"
```

Expected minimums after a clean seed:

| Row | Minimum |
|---|---|
| roles | 4 |
| permissions | 23 |
| role_perms | 47 or higher |
| super_admins | at least 1 |
| banners | 3 |
| popups | 1 |
| promo_text | 4 |
| homepage_sections | 4 |
| categories | 8 |
| providers | 5 |
| games | 8 |
| payment_methods | 5 |
| system_settings | 28 |
| commission_tiers | 3 |
| lotto_draws | 4 |
| reward_items | 6 |

### K. Final automated gates

```
pnpm install
pnpm --filter @pasha9/web typecheck
pnpm --filter @pasha9/web build
pnpm check:branding
```

All four must exit 0 before delivery.
