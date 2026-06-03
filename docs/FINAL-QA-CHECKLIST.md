# Pasha 9 - Final QA Checklist

Run top-to-bottom on the production VPS with one real test player
account and one admin account. Tick each box and note any failures.

Order matters: deposit -> approval triggers ticket accrual + bonus +
referral commission, so test those upstream surfaces first.

---

## Pre-flight (operator)

- [ ] Latest commit deployed (`git log -1` matches the report's commit hash).
- [ ] `prisma db push` ran cleanly.
- [ ] `pm2 status` shows pasha9-web online.
- [ ] Three cron entries present and running with `$CRON_SECRET`.
- [ ] `native_games_public_enabled` is `false` in SystemSetting.

## 1. Provider game launching

- [ ] `/admin/providers` shows "iGamingAPIs Aggregator" with brand pill strip.
- [ ] Test launch one JILI game from `/admin/providers/[id]/games`.
- [ ] Test launch one PGSoft / JDB / Habanero / Spribe / Evolution Live game; record results.
- [ ] If upstream rejects: error returned verbatim, wallet untouched.
- [ ] `/admin/providers/[id]` Brands tab shows activation chips per brand.
- [ ] Public `/games/provider?brand=PGSOFT` shows PGSoft only.
- [ ] `/games/provider?category=crash` shows real crash games (Aviator, etc.).
- [ ] `/games/provider?jackpot=1` shows isJackpot=true games only.
- [ ] Direct visit to `/games/dice` shows "temporarily unavailable" screen.

## 2. Homepage + game sections

- [ ] Slider swipes on first paint (no scroll-to-init bug).
- [ ] No "Indian Premier League" / "Bangabandhu Cup" / mock fixtures.
- [ ] No Pasha Originals strip on `/`.
- [ ] Hot Games strip pulls real provider games (curated or featured fallback).
- [ ] Each homepage strip View All routes to `/games/provider?category=...`.
- [ ] Admin removes a featured game from `/admin/homepage-sections` -> public reflects after hard refresh (no 30s cache).
- [ ] `/admin/homepage-blocks` new custom block appears on `/` after save.
- [ ] Hide a block -> disappears publicly.

## 3. Deposit flow

- [ ] `/deposit` opens with Deposit / Withdrawal tab bar (Deposit active, yellow underline).
- [ ] Method picker shows bKash / Nagad / Rocket / Upay as icon tiles (NO dropdown).
- [ ] Click bKash -> highlighted yellow.
- [ ] Selected card shows banner + wallet number + Copy button + instruction text.
- [ ] Copy button works (clipboard).
- [ ] Quick-amount buttons (BDT 500/1000/...) populate the amount.
- [ ] Bonus preview appears under the amount when a tier matches.
- [ ] Deposit notice popup fires once per session if enabled.
- [ ] Transaction ID field accepts text.
- [ ] Screenshot upload accepts PNG/JPG/WEBP/PDF; rejects EXE/DOCX.
- [ ] Confirm button submits and shows reference id.
- [ ] Admin approves the deposit from `/admin/deposits`.
- [ ] Wallet credit appears (live wallet strip).
- [ ] Transaction appears in `/transactions` and `/admin/transactions`.
- [ ] If tier matches: bonus shows on `/dashboard/bonus`.
- [ ] If amount >= 1200: lotto tickets generated; visible on `/lotto/my-tickets`.
- [ ] If user was referred: affiliate commission row on `/admin/referrals`.

## 4. Withdrawal flow

- [ ] `/withdraw` opens with same tab bar (Withdrawal active).
- [ ] No Account Holder Name field anywhere.
- [ ] Method icons shown; selected highlighted.
- [ ] Account Number field accepts input.
- [ ] Withdraw button submits successfully.
- [ ] Admin approves from `/admin/withdrawals` -> wallet debits.
- [ ] Admin rejects with reason -> wallet untouched, reason visible to user.

## 5. Lotto system

- [ ] `/lotto` page shows jackpot, countdown, ticket counts from DB.
- [ ] My Tickets tab shows active / used / winning filters working.
- [ ] `/admin/lotto/settings` PATCH `{ cutoffMinutes: 10, multFirst: 2000, ... }` succeeds.
- [ ] Approve a deposit within the cutoff window -> tickets attach to NEXT draw.
- [ ] Settle a draw with winningNumber=1234, ticket 1234 -> first_exact, ticket 2314 -> first_ibox (amount = baseValue * 2000 / 24).
- [ ] Settle with winningNumber=1111, ticket 1111 -> full prize (no division).
- [ ] Winnings show on `/lotto/my-winnings`.
- [ ] Claim button moves balance to Wallet.lottoBalance (auto mode) or pending claim (manual).
- [ ] `/lotto/transfer` moves lottoBalance to main wallet.
- [ ] Transaction row in `/transactions`.
- [ ] Double-claim returns 409 `ALREADY_CLAIMED`.
- [ ] Admin label now reads "extra prize numbers" (no Babu88 mention).

## 6. Promotions

- [ ] `/promotions` cards use admin banner + description (no "Auto-managed by ..." text).
- [ ] Guest claim opens login.
- [ ] Logged-in claim succeeds once; second claim returns ALREADY_CLAIMED.
- [ ] Granted bonus appears on `/dashboard/bonus`.
- [ ] Image upload validates size + type from `/admin/bonuses`.

## 7. Referral system

- [ ] `/referral` shows 0/0/0/0 for a fresh account.
- [ ] Invite link copies.
- [ ] `/admin/affiliate-tiers` edit level1/2/3 percentages.
- [ ] After a referred user's first approved deposit, level-1 commission appears.
- [ ] Two-level chain (A -> B -> C): C deposit -> A gets level-2 commission.
- [ ] `referral_hold_days` honored (commission stays pending until elapsed).
- [ ] `/admin/referral-claims` shows pending claim after maturation.
- [ ] Claim moves balance to main wallet.

## 8. Betting Pass

- [ ] `/betting-pass` opens (no IPL 2026 menu entry).
- [ ] Points calculation matches admin tier rules.
- [ ] Points UI matches DB value.

## 9. Rewards + coin system

- [ ] `/rewards` opens with real coin balance from `/api/rewards/me`.
- [ ] Reward card click with insufficient coins -> red error with `X more coins` message.
- [ ] Mobile recharge claim flow: operator picker (GP/Robi/BL/Airtel/Teletalk) + phone -> claim row in `/admin/reward-claims`.
- [ ] Physical reward: full-name + phone + address form.
- [ ] Digital reward: confirm-only.
- [ ] Coins deducted on claim.
- [ ] Admin rejection refunds coins.

## 10. Daily Check-in

- [ ] First claim of the day succeeds; coins credit to Wallet.bonusBalance.
- [ ] Second same-day claim returns `ALREADY_CLAIMED`.
- [ ] If `minDepositRequirement` set and user has zero deposits -> `ACTIVITY_REQUIRED`.
- [ ] Streak day 7 awards configured bonus.

## 11. Spin wheel

- [ ] `/rewards` Spin tab renders real SpinSegment wedges.
- [ ] First N spins per day are free (no coin cost).
- [ ] After N: spins cost configured coins; deducted on click.
- [ ] Coin payout credits Wallet.bonusBalance.
- [ ] Bonus payout credits Wallet.lockedBalance (turnover-gated).

## 12. Profile + authentication

- [ ] `/profile` no "Milestone 2" placeholder.
- [ ] Avatar upload (PNG/JPG/WEBP, max 2 MB) persists; appears in header on refresh.
- [ ] Edit username -> Save -> success. Duplicate username -> 409 USERNAME_TAKEN.
- [ ] Edit phone -> uniqueness enforced.
- [ ] Edit email -> format validated; clears with empty string.
- [ ] Change Password with wrong current pw -> 400 WRONG_CURRENT_PASSWORD.
- [ ] Change Password success -> stays logged in; can log in with new pw.
- [ ] Forgot password: `/api/auth/forgot-password` returns generic message for any identifier.
- [ ] `/admin/password-resets` shows pending requests.
- [ ] Approve action returns one-time token in a modal (copyable).
- [ ] User redeems token via `/api/auth/reset-password` -> can log in with new pw.
- [ ] Second use of same token -> 400 ALREADY_USED.
- [ ] Reject action closes the request with admin note.

## 13. Mobile layout

For each width 320 / 375 / 390 / 430:
- [ ] Bottom nav stays glued to viewport bottom while scrolling.
- [ ] Bottom nav does NOT overlap game cards, play buttons, claim buttons, deposit/withdraw submit.
- [ ] Chat floating button sits above the nav, does not overlap nav buttons.
- [ ] Header stays sticky at top; never shifts after refresh.
- [ ] No horizontal overflow.
- [ ] Safe-area inset honored on iPhone X+ (no content under home indicator).
- [ ] iOS Safari address-bar collapse does not cause the nav to jump.

## 14. Header refresh stability

- [ ] Hard refresh `/` 10 times -> header sits at same Y, no flash.
- [ ] Hard refresh `/games/provider`, `/deposit`, `/withdraw`, `/lotto`, `/promotions`, `/rewards`, `/referral`, `/profile`, `/dashboard` -> same stability.
- [ ] Auth probe completion does NOT change header dimensions.
- [ ] Mobile drawer opens / closes correctly.
- [ ] Language toggle, wallet button, plus button, notifications, profile icon remain aligned.

## 15. Pasha Originals public hide verification

- [ ] Mobile drawer Games section: NO Pasha Originals entry.
- [ ] Homepage: NO Pasha Originals strip.
- [ ] `/games`: NO Pasha Dice / Mines / Keno / Roulette / Crash cards.
- [ ] Homepage Hot Games: only provider games appear.
- [ ] Homepage Crash: only provider crash games (Spribe Aviator etc.).
- [ ] Homepage Jackpot strip / `/games/provider?jackpot=1`: only `ExternalGame.isJackpot=true` rows.
- [ ] `/games/dice` direct visit: GameShell shows "temporarily unavailable" message.
- [ ] `/admin/native-games` still works (admin tooling preserved).

## 16. Security / no leak

- [ ] `/api/providers` response: no token, secret, callback secret.
- [ ] `/api/providers/<key>/launch`: returns only `{ launchUrl, mode }`.
- [ ] `/api/auth/me`: never exposes passwordHash.
- [ ] `/api/me/profile`: never exposes passwordHash.
- [ ] `/api/admin/password-resets`: never exposes raw tokens (only `tokenHash` stored).
- [ ] `/api/admin/password-resets/[id]/approve`: returns raw token ONCE; subsequent reads only show status.
- [ ] `/api/cron/*` requires `Authorization: Bearer $CRON_SECRET`.
- [ ] `/api/lotto/me`, `/api/dashboard/*` scoped to authenticated user.
- [ ] `/admin/*` requires permission; guest gets 401.

## 17. Regression sweep

- [ ] No application error overlay on any page.
- [ ] No 500 in browser DevTools network tab.
- [ ] All admin sidebar entries reachable.
- [ ] All public footer links reachable.
- [ ] Bottom nav buttons (Promotion, Lotto, Home, Betting Pass, Referral) work logged-in.
- [ ] Bottom nav buttons (Promotion, Lotto, Home, Register, Login) work logged-out.

---

## Sign-off

| Section | Pass | Tested by | Date |
|---|---|---|---|
| 1 Provider launch | | | |
| 2 Homepage | | | |
| 3 Deposit | | | |
| 4 Withdraw | | | |
| 5 Lotto | | | |
| 6 Promotions | | | |
| 7 Referral | | | |
| 8 Betting Pass | | | |
| 9 Rewards | | | |
| 10 Check-in | | | |
| 11 Spin | | | |
| 12 Profile + auth | | | |
| 13 Mobile layout | | | |
| 14 Header stability | | | |
| 15 Pasha Originals hide | | | |
| 16 Security | | | |
| 17 Regression | | | |

Once every row passes -> APK build can proceed via `docs/APK-BUILD.md`.
