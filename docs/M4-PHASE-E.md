# M4 Phase E - Referral balance, maturity cron, claim flow

Phase E replaces the mock referral stats on `/referral` with real data
from the existing `AffiliateCommission` ledger projected into a cached
`ReferralBalance` row. Adds a player claim endpoint, a maturity cron,
an admin review console, and a backfill script for environments with
existing commissions.

## Schema changes

None. Phase E reads/writes Phase A tables (`ReferralBalance`,
`ReferralClaim`) and Phase A `SystemSetting` keys.

## Files changed

### New
- `apps/web/lib/affiliate/balance.ts` - balance projector + cadence helpers.
- `apps/web/app/api/me/referrals/route.ts` - signed-in user dashboard read.
- `apps/web/app/api/me/referrals/claim/route.ts` - player claim with idempotent reservation.
- `apps/web/app/api/cron/referral-mature/route.ts` - CRON_SECRET / admin sweep.
- `apps/web/app/api/admin/referral-claims/route.ts` - balance + claim ledger list.
- `apps/web/app/api/admin/referral-claims/[id]/route.ts` - approve / reject pending claim.
- `apps/web/app/api/admin/referral-claims/settings/route.ts` - cadence + hold + turnover settings PATCH.
- `apps/web/app/(admin)/admin/referral-claims/page.tsx` - admin console.
- `packages/database/scripts/backfill-referral-balance.ts` - idempotent backfill.
- `docs/M4-PHASE-E.md`.

### Modified
- `apps/web/app/(site)/referral/page.tsx` - rewritten against `/api/me/referrals`. No mock imports.
- `apps/web/components/admin/AdminSidebar.tsx` + `AdminMobileDrawer.tsx` - "Referral claims" nav entry under Users and Money.
- `apps/web/lib/constants/routes.ts` - `ROUTES.admin.referralClaims`.
- `apps/web/lib/i18n/dictionaries/en.json` + `bn.json` - `referralClaims` label.
- `packages/database/package.json` - `referral:backfill` script.

## How referral balance works

`ReferralBalance` is a cached projection of the canonical
`AffiliateCommission` ledger. Three settings drive the projection
(seeded in Phase A):

| Setting | Default | Effect |
|---|---|---|
| `referral_hold_days` | 7 | Commission must be older than this before it becomes claimable. |
| `referral_claim_cadence` | weekly | weekly / monthly / manual / auto. Gates how often a player can claim. |
| `referral_turnover_x` | 0 | When > 0 the claim returns `REFERRAL_TURNOVER_NOT_READY` until the wagering feed is configured. |

Per-user computation (`computeBalanceFor`):

- `pendingAmount` = sum of `status='pending'` rows + sum of
  `status='approved'` rows still inside the hold window
  (`createdAt > now - holdDays`).
- `claimableAmount` = sum of `status='approved'` rows with no
  `payoutId` AND `createdAt <= now - holdDays`.
- `claimedAmount` = sum of `status='paid'` rows.

This is a pure read; safe inside or outside a transaction. The
projection is recomputed:

- Every time `/api/me/referrals` is hit (so the player sees the live
  number even between cron runs).
- By the maturity cron on a schedule.
- By the player claim endpoint inside the same transaction that
  moves the wallet.
- By the admin approve/reject endpoint inside the same transaction
  that changes the claim row.
- By the backfill script.

## How referral claim works

`POST /api/me/referrals/claim`:

1. Requires a signed-in active user (401 otherwise). Rate-limited to
   6 calls per 5 min per user.
2. Reads `loadReferralSettings()`. Returns `CADENCE_BLOCKED` if the
   player is inside the same ISO-week / calendar-month window as
   their `lastClaimedAt`.
3. Returns `REFERRAL_TURNOVER_NOT_READY` if `turnoverX > 0` (honest
   stub; no fake success).
4. Inside one `db.$transaction`:
   - Loads every matured + unreserved `AffiliateCommission` row.
   - Returns `NOTHING_TO_CLAIM` if the sum is zero.
   - Creates a `CommissionPayout` (`method='wallet_transfer'` for
     auto/weekly/monthly, `wallet_transfer_pending` for manual) and
     stamps `payoutId` on every reserved row with an `updateMany`
     guarded by `payoutId: null`. A mismatch in row count throws,
     rolling back the whole transaction.
   - Auto / weekly / monthly: flips reserved rows to `status='paid'`,
     flips the payout to `paid`, credits the wallet, writes a
     `Transaction(type='referral')` row with the payout id as
     reference, creates a `ReferralClaim(status='paid')` linked to
     the Transaction, refreshes the cached `ReferralBalance` with
     `lastClaimedAt = now`.
   - Manual: leaves the rows reserved under a pending payout, writes
     a `ReferralClaim(status='pending')` (no wallet movement),
     refreshes the projection. The admin queue at
     `/admin/referral-claims` can then approve or reject.
5. The wallet credit becomes a row in the user's
   `/dashboard/transactions` and `/dashboard/wallet` recent activity
   via the canonical `Transaction` ledger that Phase C wired up.

CommissionPayout is the audit trail. Because the same
`AffiliateCommission` rows cannot have `payoutId` overwritten while
status is `approved` (the reservation guard), a double-click cannot
double-credit.

## How the maturity cron works

`POST /api/cron/referral-mature` (or `GET` for systemd schedulers):

- Auth: Bearer `CRON_SECRET` matches `process.env.CRON_SECRET`. Falls
  back to a logged-in admin with `users.read` for manual triggers.
- Iterates every affiliate with at least one `AffiliateCommission`
  row (via `groupBy`), recomputes the projection, upserts the
  `ReferralBalance` row. The body is the same `refreshReferralBalance`
  call the live endpoint uses; idempotent by construction.
- Returns `{ holdDays, usersTouched, newlyMatured }` so the operator
  can spot anomalies. ActivityLog gets a `REFERRAL_MATURE_CRON`
  entry on admin-triggered runs.

## How the admin console works

`/admin/referral-claims`:

- **Settings card**: cadence dropdown (weekly / monthly / manual /
  auto), hold-days input, turnover input. Save calls
  `PATCH /api/admin/referral-claims/settings` which upserts the
  three SystemSetting rows. The user-facing endpoint reads those on
  every hit.
- **Balances table**: every `ReferralBalance` row joined with the
  user (username + masked phone + email). Pending / claimable /
  claimed columns, last-claim timestamp.
- **Claim ledger**: pending / paid / rejected `ReferralClaim` rows.
  Pending rows expose Approve and Reject buttons.
  - **Approve** runs the same transaction the auto path uses:
    flips the reserved commissions to `paid`, flips the payout to
    `paid`, credits the wallet, writes a `Transaction(type='referral')`,
    refreshes the projection.
  - **Reject** detaches the reservation (`payoutId=null`, status back
    to `approved`), marks the claim row rejected with the admin note,
    refreshes the projection so the funds are claimable again next
    cycle.
- **Run maturity sweep** button hits the cron from the browser for
  ad-hoc verification.

## How the backfill works

`pnpm --filter @pasha9/database referral:backfill`

- Reads the current `referral_hold_days` from SystemSetting (or the
  `REFERRAL_HOLD_DAYS` env override).
- Iterates every distinct `affiliateId` in `AffiliateCommission`.
- Computes the projection and upserts `ReferralBalance` by `userId`.
- Idempotent: every run produces the same numbers because the
  projection is a pure function of `(commissions, holdDays, now)`.
- Logs per-user totals and a final summary so the operator can
  spot-check.

Run on the VPS once after Phase E deploys, then weekly via the cron
if you want the cached projection always-fresh between scheduled
maturity sweeps.

## VPS deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm check:branding
pnpm build

# One-shot backfill for any user with existing commissions.
pnpm --filter @pasha9/database referral:backfill

pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

Schedule the maturity cron daily / hourly:

```bash
# Example crontab line. Runs every hour on the 7th minute.
7 * * * * curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://pasha9.com/api/cron/referral-mature > /dev/null
```

## Test checklist

1. `/referral` opens. No mock numbers.
2. Guest visits `/referral` -> "Log in to see your referral
   dashboard." card with no fake data behind it.
3. Logged-in player sees their real referral code + invite link.
4. Copy buttons work for code + link.
5. New user with no referrals sees 0s everywhere and "No referrals
   yet" empty state in the Latest referrals table.
6. User with `AffiliateCommission` rows sees real pending / claimable
   / claimed numbers.
7. `pnpm --filter @pasha9/database referral:backfill` exits 0,
   logs per-user totals, and re-running produces the same numbers.
8. `POST /api/cron/referral-mature` without `Authorization: Bearer
   <CRON_SECRET>` returns 401.
9. Same call with the correct header returns
   `{ ok, source: 'cron_secret', usersTouched, newlyMatured, holdDays }`.
10. Eligible pending amount moves to claimable after the cron runs
    (commission older than `holdDays`).
11. Player claim with zero claimable returns `NOTHING_TO_CLAIM`.
    Wallet unchanged.
12. Player claim with claimable balance in auto/weekly/monthly
    cadence: wallet credit lands, `Transaction(type='referral')`
    row written, `ReferralClaim(status='paid')` row written,
    `ReferralBalance` updates correctly.
13. Repeat click inside the same cadence window: `CADENCE_BLOCKED`.
14. Manual cadence claim: `ReferralClaim(status='pending')`, no
    wallet movement. `/admin/referral-claims` shows the row with
    Approve / Reject buttons.
15. Admin Approve on a pending row: wallet credit lands, claim
    flips to `paid`.
16. Admin Reject on a pending row: claim flips to `rejected`,
    `payoutId` detached, balance recomputed, player can claim
    again next cycle.
17. `/dashboard/transactions` shows the referral claim row.
18. `/dashboard/wallet` recent activity shows the referral claim row.
19. `/admin/transactions` shows the referral claim row.
20. Admin can save cadence settings; the user-facing endpoint
    immediately respects them.
21. Deposit approval still creates `AffiliateCommission` rows
    (engine untouched).
22. Commission tier settings still work.
23. Phase C deposit flow still works.
24. Phase D promotion claim still works.
25. Phase B homepage sections still work.
26. JILI launch still works.
27. Provider callback simulation still works.
28. Transactions still work.
29. Sidebar remains fixed.
30. No application error overlay.

## What remains for Phase F

Lotto polish:

- Result history endpoint with date filter (yesterday / 7-day /
  30-day / search by date).
- `/lotto/my-tickets` + `/lotto/my-winnings` dedicated pages.
- Auto-publish vs manual-claim toggle in the admin settle form.
- Polished settle form (1st / 2nd / 3rd / special / consolation
  full-result input instead of just multipliers).
