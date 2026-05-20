# sanjid14 Milestone 1 Testing Checklist

Run `pnpm install` then `pnpm dev` from the repo root. The web app opens at `http://localhost:3000`. Walk through this list before sending the demo link to the client.

## Public site

- [ ] Homepage renders on desktop at 1440 width
- [ ] Homepage renders on mobile at 375 width
- [ ] Hero slider auto-advances and arrow buttons work
- [ ] Slider dots reflect the active slide
- [ ] Jackpot counter ticks upward
- [ ] Promo marquee scrolls smoothly
- [ ] Hot Games rail scrolls horizontally
- [ ] Slots, Live Casino, Fishing rails render with mock games
- [ ] Each game card shows provider, min/max bet, hover glow, favorite toggle, maintenance state
- [ ] Sidebar navigation opens every public route
- [ ] Header search and language toggle visible
- [ ] Mobile menu opens, closes, and navigates

## Authentication

- [ ] Login modal opens from header
- [ ] Signup tab switches inside the modal
- [ ] Phone validation rejects non-Bangladeshi numbers
- [ ] Password validation requires minimum length
- [ ] Confirm password mismatch shows error
- [ ] Agree to terms checkbox is required

## Public pages

- [ ] /games shows full catalogue with category pills
- [ ] /games/[category] route renders for slots, fishing, live-casino, lottery, etc.
- [ ] /sports shows match cards with three-way odds buttons
- [ ] /promotions shows six bonus rules with claim buttons
- [ ] /referral shows code, link, copy buttons, chain visualization, table
- [ ] /wallet shows balance, bonus, locked tiles and recent transactions
- [ ] /deposit form: presets, method picker, TX ID, proof upload, instructions, success state
- [ ] /withdraw form: balance reminder, method, account fields, success state with admin note
- [ ] /transactions filter by type works
- [ ] /profile shows mock user info and editable form
- [ ] /support shows three channels, FAQ accordion, ticket form
- [ ] /terms and /responsible-gaming render

## User dashboard

- [ ] /dashboard overview tiles, recent activity, bonus cards
- [ ] /dashboard/wallet balances and history
- [ ] /dashboard/deposit and /dashboard/withdraw reuse the public forms
- [ ] /dashboard/bonus shows claimable rules and wagering progress
- [ ] /dashboard/referral
- [ ] /dashboard/transactions
- [ ] /dashboard/profile
- [ ] /dashboard/security toggles for 2FA, login alerts, SMS confirm

## Admin

- [ ] /admin/login layout renders, password field is masked
- [ ] /admin overview: 8 stat tiles, deposit/withdraw chart, pending queue, recent activity
- [ ] /admin/users: table search, sort, pagination, row open drawer, balance adjust modal
- [ ] Balance adjust modal requires a reason and shows old to new balance
- [ ] /admin/balance: credit and debit shortcuts
- [ ] /admin/deposits: approve and reject confirmation modals with admin note
- [ ] /admin/withdrawals: approve and reject confirmation modals with admin note
- [ ] /admin/transactions log searchable
- [ ] /admin/referrals overview cards, top referrers, table
- [ ] /admin/bonuses cards + editor modal with type, percentage, amount, min, max
- [ ] /admin/banners list with reorder, toggle, edit modal, preview thumbnail
- [ ] /admin/popups list with start/end window, edit modal
- [ ] /admin/categories CRUD
- [ ] /admin/providers CRUD plus API keys modal
- [ ] /admin/homepage section toggles and Bangla / English hero copy
- [ ] /admin/promo-text marquee editor
- [ ] /admin/support inbox + reply drawer
- [ ] /admin/settings shows compliance notice and Built by Anointed Coder
- [ ] /admin/activity audit log table
- [ ] /admin/handover shows checklist, pending from client, contact buttons

## Branding gate

- [ ] No badges anywhere in the UI
- [ ] No em or long dash characters in any source file (run `pnpm check:branding`)
- [ ] No mention of any AI assistant name in source or copy
- [ ] Built by Anointed Coder visible in: footer, admin sidebar bottom, admin login card, /admin/settings, /admin/handover
- [ ] Telegram link points to https://t.me/AnointedCoder
- [ ] WhatsApp link points to https://wa.link/fi5z8a
- [ ] Floating contact buttons open both channels from every page

## Performance and console

- [ ] No browser console errors on Home, Wallet, Admin Overview, Admin Users
- [ ] Lighthouse on Home shows no critical accessibility issues
