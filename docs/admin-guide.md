## Pasha 9 Admin Guide

Operator handbook for the live admin panel at `https://pasha9.com/admin`. Built by Anointed Coder.

### Signing in

1. Open `https://pasha9.com/admin/login`.
2. Enter the super admin username and the password you rotated after the first seed.
3. You land on `/admin` with the daily flow chart and pending queue.

The admin chrome is white with a yellow active rail. Every action that mutates data writes an entry to the `ActivityLog` table.

### Account dropdown

Click the avatar pill in the top right.

- Profile: account summary and change-password form
- Settings: system-wide configuration
- Activity Log: every admin write across the platform
- Logout: revokes the session and clears cookies

---

## Content management (everything the client can edit without a developer)

### Homepage content
Sidebar → `Homepage Content`. Edit the hero primary, hero live, hero referral, and about sections in both Bangla and English. Save per section.

### Banners and sliders
Sidebar → `Banners and Sliders`. Create banner with bilingual title and subtitle, CTA label and link, image URL, accent (gold, neon, mixed, royal, red), position, status. The public HeroSlider re-fetches every minute.

### Popup announcements
Sidebar → `Popups`. Create one or more popups with optional start and end window. The public site shows the latest active popup that falls inside the window once per visitor per day (cookie `pasha9_popup_seen`).

### Promo text (marquee)
Sidebar → `Promo Text`. Add lines, position controls the order. The active subset scrolls under the hero on the homepage.

### Ambassador and Video (Phase 5)
Sidebar → `Ambassador and Video`.
- Left panel: ambassador name, caption, image URL, active toggle
- Right panel: promo video title, caption, URL (YouTube, Vimeo or mp4), poster image URL
- Save writes the values into `SystemSetting`. The homepage section reads them and falls back to brand placeholders when fields are empty. Toggling Active off hides the section entirely.

### Lotto draws (Phase 5)
Sidebar → `Lotto Draws`. CRUD a list of lotto draws with name, schedule label, draws-at timestamp, digits count, ticket price, prize pool, accent, position, status. The public `/lotto` page reads active draws and renders their cards. Ticket purchase flow ships in Milestone 2.

### Reward catalog (Phase 5)
Sidebar → `Reward Catalog`. CRUD a list of reward items with title, description, cost (coins), category (recharge, spin, bet, physical, misc), accent, position, status. The public `/rewards` Reward Store tab reads active items. Claim flow ships in Milestone 2.

### Categories, providers, games
Sidebar → `Categories`, `Providers`, `Games`. Standard CRUD. Game images can be uploaded via `/api/admin/uploads` and referenced via the imageUrl field on each game row.

### Mobile App (APK)
Sidebar → `System Settings` → Mobile App (APK) card. Paste the public APK download URL and the version label. The homepage app download CTA and the top mobile strip pull from here.

### Public support contacts
Sidebar → `System Settings` → Public Support Contacts. Paste the public Telegram, WhatsApp, and support email. These are the contacts shown in the footer Follow column, the floating contact button, and the Support page top cards. Until they are filled in, those surfaces stay hidden.

### Bonus rules
Sidebar → `Bonus Rules`. Author first-deposit, daily, weekly, referral, VIP, invite, reload, manual or promo rules with percentage, amount, min deposit, max bonus, turnover multiplier, optional start/end dates, status. Automatic application of these bonuses ships in Milestone 2.

---

## Affiliate management (Phase 4)

### Affiliate users
Sidebar → `Affiliate`. Search by username, phone or referral code. Filter by status (Pending, Approved, Rejected). Click any row to open the detail drawer.

Actions from the drawer or the action modal:
- Approve: marks the user as affiliate, optionally assigns a commission tier. Writes `AFFILIATE_APPROVE` activity.
- Reject: marks the application rejected, optional reason note. Writes `AFFILIATE_REJECT`.
- Suspend: clears `isAffiliate`. Writes `AFFILIATE_SUSPEND`.
- Activate: re-marks `isAffiliate`. Writes `AFFILIATE_ACTIVATE`.
- Reset: returns the application to pending. Writes `AFFILIATE_RESET`.

### Commission tiers
Sidebar → `Commission Tiers`. CRUD for tier name, description, three percentage levels, qualification thresholds (minimum active referrals and minimum monthly volume), position, status. Default tiers seeded: bronze 8/4/2, silver 10/5/2, gold 12/6/3. Delete refuses if any user is currently assigned to that tier.

Automatic commission accrual based on these tiers ships in Milestone 2.

---

## Users and money

### User management
Sidebar → `User Management`. Search by username, phone, referral code. Detail drawer shows wallet balances, status, role, audit fields, referral chain summary.

### Balance management
Sidebar → `Balance Management`. Only super admin can manually credit or debit a user. Every change requires a written reason, captures old and new balance, and writes both a Transaction row of type `adjust` and an ActivityLog entry.

### Deposit and withdrawal queues
Sidebar → `Deposits` and `Withdrawals`. Review queue with pending / approved / rejected filter. Approval and rejection write activity log entries. The money flow itself (gateway, manual proof, automatic wallet credit) ships in Milestone 2; M1 holds the queue UI ready.

### Transaction log
Sidebar → `Transaction Log`. Full table of every wallet transaction with type, status, reference, description.

### Referrals
Sidebar → `Referrals`. View users with their direct referral count.

---

## System

### Settings
Sidebar → `System Settings`. Cards: General, Operations, Public Support Contacts, Internal demo games, Mobile App (APK). Saving any field writes a `SETTINGS_UPDATE` activity.

The compliance section at the top is a reminder that the owner is responsible for local licences, KYC, payment approvals, and game provider agreements.

### Activity log
Sidebar → `Activity Log`. Read-only audit trail of every admin write with actor username, action key, target, IP, and user agent.

### Source handover
Sidebar → `Source Handover`. Contains the developer contact (Anointed Coder, info@anointedcoder.com, Telegram, WhatsApp) and the M1 checklist.

---

## Roles and permissions

| Role | Capabilities |
|---|---|
| super_admin | Everything, including settings, staff management, affiliate tier edits |
| admin | Everything except `settings.write`, `staff.manage`, and `affiliate.tiers.write` |
| staff | Read-only plus deposit and withdrawal review. No balance adjustment, no settings, no staff management, no affiliate writes. |
| user | Player account |

Role-permission mapping lives in `packages/database/prisma/seed.ts` and is re-applied on every seed run. Changes there propagate via `pnpm --filter @pasha9/database run seed:prod`.

---

## Common situations

- A banner change does not appear on the homepage. Wait up to 60 seconds for the cache window or run `pm2 reload pasha9-web`.
- The OTP page reports `OTP_PROVIDER_NOT_CONFIGURED`. Open Settings and add a provider, or set `PASHA9_OTP_PROVIDER=console` in `.env.production` for QA mode.
- A user reports a forgotten password. From User Management open the row drawer and use Reset Password. The user receives a reset token via SMS in production.
- The footer Follow column is empty. Admin has not yet set public Telegram, WhatsApp, or email in Settings.
- Ambassador section is empty on the homepage. Admin has not yet set ambassador fields in `/admin/ambassador`. Toggling Active off there hides the section entirely.

For anything else: Telegram `t.me/AnointedCoder` or WhatsApp `wa.link/fi5z8a`.
