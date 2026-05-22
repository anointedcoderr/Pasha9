# Pasha9 Admin Guide

Operator handbook for the live admin panel at `https://pasha9.com/admin`. Built by Anointed Coder.

## Signing in

1. Open `https://pasha9.com/admin/login`.
2. Enter the super admin username and the password you set during seed.
3. Press `Sign In`. You land on `/admin` with the daily flow chart and pending queue.

## Editing homepage content

Use this when the client wants to change the welcome copy.

1. Sidebar then `Homepage Content`.
2. Each section card (hero primary, hero live, hero referral, about) has its own save button.
3. Edit the Bangla title, English title, body in both languages, image URL and link.
4. Press `Save`. The change is visible on the public site within 60 seconds (cache window).

## Banners and the hero slider

1. Sidebar then `Banners and Sliders`.
2. `New Banner` to create. The form supports bilingual title and subtitle, CTA label, link, image URL, accent and status.
3. The up and down arrows move a banner up or down in the slider order.
4. The switch toggles `active` vs `hidden`. Hidden banners disappear from the homepage immediately.
5. Edit and Delete are on every row.

Banners are stored in PostgreSQL. Status `active` plus the lowest `position` show first on the homepage.

## Popups and announcements

1. Sidebar then `Popups`.
2. `New Popup` to create. Optional start and end window means the popup only fires inside that range.
3. Toggle the switch to hide without deleting.

The public site fetches a single active popup that falls inside the window, ordered by most recent.

## Marquee promo text

1. Sidebar then `Promo Text`.
2. Add a line. `Position` is the display order. Status `active` makes the line scroll on the homepage.

## Users

1. Sidebar then `User Management`.
2. The search filters by username, phone, or referral code.
3. The row drawer shows wallet balance, status, role, and the audit fields. Balance adjustment is a separate modal that requires a reason and writes an audit entry on every change.

## Activity log

1. Sidebar then `Activity Log`. Every admin write across the platform appears here with actor, role snapshot, action key, target, IP and user agent.
2. The log is read-only.

## System settings

1. Sidebar then `System Settings`.
2. Categories: general, branding, security, sms, payment, apk, tracking, content, referral.
3. SMS, tracking, and payment fields are intentionally empty until the client provides real provider keys. Do not paste placeholder IDs.
4. The compliance note at the top is a reminder that the owner is responsible for local licences, KYC, payment approvals, and game provider agreements.

## Source handover page

`Admin then Source Handover` lists the developer contact, the M1 checklist, and the items still pending from the client. Useful during weekly review calls.

## Admin balance adjustment policy

- Only super admin can credit or debit a user balance.
- Every change requires a written reason and creates two records: a `Transaction` row of type `adjust` and an `ActivityLog` entry with old balance and new balance in the meta field.
- Staff accounts never get this permission.

## Roles and permissions

The seed creates four system roles:

| Role          | Capabilities                                                                 |
|---------------|-------------------------------------------------------------------------------|
| super_admin   | Everything, including settings and staff management                          |
| admin         | Everything except settings.write and staff.manage                            |
| staff         | Read access plus deposit and withdrawal approval. No balance adjustment.     |
| user          | Player account                                                                |

Role to permission mapping lives in `packages/database/prisma/seed.ts` so changes are reproducible across environments.

## Common situations

- A banner change does not appear on the homepage. Wait 60 seconds (cache window) or run `pm2 reload pasha9-web`.
- The OTP page reports `OTP_PROVIDER_NOT_CONFIGURED`. Open Settings then SMS and add a provider, or set `PASHA9_OTP_PROVIDER=console` in `.env.production` for QA mode.
- A user reports a forgotten password. From `User Management`, open the row drawer and use Reset Password. The user receives a reset token via SMS in production.

For anything else: Telegram `t.me/AnointedCoder` or WhatsApp `wa.link/fi5z8a`.
