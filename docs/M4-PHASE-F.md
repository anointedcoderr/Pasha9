# M4 Phase F - Lotto polish

Phase F adds the production-grade lotto pieces around the existing
settlement engine: filtered result history, dedicated player pages,
manual claim mode, four admin-managed runtime settings, and Babu88-
style display numbers on every published result.

## Schema changes

One additive column on `LotteryDrawResult`:

| Column | Type | Purpose |
|---|---|---|
| `extraNumbers` | `Json?` | Babu88-style display blob: `{ second?, third?, specials[], consolations[] }`. Display only; the settlement engine still derives every prize tier from `winningNumber` + multipliers. |

`prisma db push` safe. No data migration required.

## Files changed

### New
- `apps/web/lib/lotto/settings.ts` - SystemSetting loader.
- `apps/web/app/api/lotto/winnings/[id]/claim/route.ts` - manual claim endpoint.
- `apps/web/app/api/admin/lotto/settings/route.ts` - GET + PATCH for the four settings.
- `apps/web/app/(site)/lotto/my-tickets/page.tsx` - dedicated player page.
- `apps/web/app/(site)/lotto/my-winnings/page.tsx` - dedicated player page.
- `docs/M4-PHASE-F.md`.

### Modified
- `packages/database/prisma/schema.prisma` - `LotteryDrawResult.extraNumbers Json?`.
- `packages/database/prisma/seed.ts` - 4 SystemSetting keys (`lotto_enabled`, `lotto_claim_mode`, `lotto_ticket_rate_amount`, `lotto_ticket_rate_count`).
- `apps/web/lib/lotto/tickets.ts` - `accrueLotteryTickets` and `settleDraw` now read settings; settle accepts `extraNumbers` + `claimMode`; manual-mode settle writes `LotteryWinning(status='pending_credit')` and skips the wallet credit.
- `apps/web/app/api/lotto/me/route.ts` - live rate from settings; tickets carry `source`; winnings carry `resultId`, `creditedAt`, `drawId`; summary adds `wonToday` and `wonLifetime`.
- `apps/web/app/api/content/lotto/results/route.ts` - `from`, `to`, `range`, `take`, `skip` query params; surfaces `extraNumbers`.
- `apps/web/app/api/admin/lotto/[id]/settle/route.ts` - schema extends to accept `extraNumbers` + `claimMode` overrides.
- `apps/web/app/(admin)/admin/lotto/page.tsx` - settings card + Babu88-style fields in the settle modal + per-settlement claim mode override.
- `apps/web/app/(site)/lotto/page.tsx` - result history range filter (yesterday / 7d / 30d / custom dates) + extra-number display per card + links to the two new pages.

## How result history works

`GET /api/content/lotto/results?from=&to=&range=&take=&skip=`

- `range=yesterday|7d|30d` is a preset window the endpoint converts
  to a `(from, to)` pair.
- `from=YYYY-MM-DD` and `to=YYYY-MM-DD` override the preset; either
  may be omitted.
- `take` is capped at 100, default 30; `skip` for paging.
- Returns each row with the joined draw details + multipliers +
  totals + `extraNumbers` (Babu88-style display blob when present).
- Inactive lotto (`lotto_enabled=false`) does NOT hide history;
  results are auditable even when the module is paused. The public
  page itself can decide whether to render the rail.

Public `/lotto` page now renders the filter pill bar (All / Yesterday
/ 7 days / 30 days) plus a custom date-range pair. Switching the
range re-fires the fetch immediately. Each result card shows the
canonical winning number + extra prize numbers (2nd, 3rd, specials,
consolations) only when the admin filled them in at settle time.

## How My Tickets works

`/lotto/my-tickets` (signed-in only; guests see a login card).

- Pulls `/api/lotto/me` once on mount.
- Filter pills: Active (`status='issued'`), Winning (`status='won'`),
  Used (`status='lost'` or `void`), All.
- Per-ticket row shows: 4-digit number, source (`deposit_accrual` or
  `admin_grant`), status chip, generated timestamp.
- Accrual progress card at the top shows total approved deposits,
  earned tickets, and BDT remaining to the next ticket block. Rate
  text is read from the live setting (`lotto_ticket_rate_*`).
- Empty state for each filter says no fake numbers ever.

## How My Winnings works

`/lotto/my-winnings` (signed-in only).

- Pulls `/api/lotto/me`.
- Four tiles: today's winnings, lifetime winnings, claimable total
  (sum of `status='pending_credit'`), lotto balance.
- Per-row table: ticket number, prize tier, amount, status, when,
  Action.
- Rows in status `pending_credit` show a Claim button. Auto-credit
  settlements leave nothing to claim and show no button.
- Inline tip points the player at `/dashboard/wallet` to move the
  lotto balance into their main wallet.

## How claim / auto-credit works

`SystemSetting.lotto_claim_mode` controls the default behaviour at
settle time. The admin can override per-settlement from the settle
modal (Inherit / Auto-credit / Manual claim).

### Auto-credit mode (default)

`settleDraw` writes `LotteryWinning(status='credited', creditedAt=now)`
for every qualifying ticket and bumps each winner's
`Wallet.lottoBalance` inside the settlement transaction. The player
then walks `/api/lotto/transfer` to move the lotto balance into the
main wallet whenever they want. This preserves the M2F behaviour
exactly.

### Manual claim mode

`settleDraw` still writes `LotteryWinning` rows but with
`status='pending_credit'` and `creditedAt=null`. Wallet does NOT
move. The player walks each winning ticket through
`POST /api/lotto/winnings/[id]/claim`:

1. Auth: signed-in active user; row's `userId` must match. 12 calls
   per 5 min per user.
2. Pre-check: `status` must be `pending_credit`; rejects otherwise
   (`NOT_FOUND`, `NOT_OWNER`, `ALREADY_CLAIMED`, `NOT_PENDING`).
3. Inside one `db.$transaction`:
   - `updateMany` guarded by `status='pending_credit'` flips the row
     to `credited` with `creditedAt=now`. A second click finds the
     row already in `credited` and rolls back -> `ALREADY_CLAIMED`.
   - `Wallet.lottoBalance` is incremented (wallet auto-created if
     missing).
   - `Transaction(type='win', status='completed')` row is written
     with `reference=<winningId>` and `meta={ lotteryWinningId,
     resultId, prizeTier, ticketId, source: 'lotto_claim' }`. This
     row lands in `/dashboard/transactions`, `/dashboard/wallet`
     recent activity, and `/admin/transactions` immediately because
     Phase C wired those readers to the canonical Transaction table.

## How admin settlement works

`/admin/lotto`:

- Settings card at the top exposes the 4 SystemSetting keys for
  inline edit. Saves on blur for the numeric inputs, on change for
  the dropdowns.
- Settle modal asks for:
  - Winning 4-digit number (required).
  - Ticket base value + 5 multipliers (existing).
  - Babu88-style display block: 2nd / 3rd numbers + comma-separated
    specials + consolations lists. Optional.
  - Per-settlement claim mode override: Inherit / Auto-credit /
    Manual claim.
- The Diagnose button still produces a dry-run breakdown before
  publishing. The settle button then commits with the same payload.
- Each LotteryDrawResult row now carries the extra-numbers blob so
  the public result history can render the Babu88-style cards.

## Deposit-to-ticket verification

- `accrueLotteryTickets` runs after every deposit approval (unchanged
  hook in `/api/admin/deposits/[id]/approve`).
- Phase F switches the rate from hardcoded 1200 / 2 to settings-
  driven `lotto_ticket_rate_amount` / `lotto_ticket_rate_count`.
- When `lotto_enabled=false` the function short-circuits: no tickets
  generated. The wallet credit + bonus + affiliate hooks still run.
- Tickets always appear in `/lotto/my-tickets` because that page
  reads from `LotteryTicket`.
- The wallet ledger does not show ticket generation as a row (no
  money moved). When a ticket settles in auto-credit mode the
  resulting `Transaction(type='win')` is written by the wallet path
  inside settleDraw if the user has a wallet; in manual mode the
  Transaction is written by the per-ticket claim endpoint.

## VPS deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

# Push the additive extraNumbers column. Safe.
pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm exec prisma db push --schema packages/database/prisma/schema.prisma

# Re-run the seed to upsert the 4 lotto SystemSetting keys.
pnpm --filter @pasha9/database seed

pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

## Test checklist

1. `/lotto` opens.
2. Result history filter: Yesterday / 7 days / 30 days each fetch
   immediately and the card grid updates.
3. Custom date inputs work; range pills clear when a custom date is
   typed.
4. Empty result history shows the existing empty-state copy.
5. `/lotto/my-tickets` opens. Guest sees login prompt.
6. Logged-in user with deposit-accrued tickets sees them under
   Active. Filter pills (Won / Used / All) work.
7. Empty filter shows no fake tickets.
8. Approved deposit generates tickets per the live rate
   (`lotto_ticket_rate_amount` / `lotto_ticket_rate_count`).
9. `/lotto/my-winnings` opens. Guest sees login prompt.
10. Logged-in user sees real winnings or empty state.
11. Today's / Lifetime / Claimable / Lotto-balance tiles show real
    aggregates.
12. Admin enters full draw result (winning number + multipliers +
    Babu88 extras + claim-mode override).
13. Admin Diagnose button shows the per-tier breakdown before
    publishing.
14. Admin Settle commits. Auto-credit mode credits lottoBalance
    immediately; manual mode writes pending winnings.
15. Manual claim flow: player clicks Claim on a pending row ->
    lottoBalance +amount, `Transaction(type='win')` row written.
16. Repeat click on the same pending row -> `ALREADY_CLAIMED`.
    Wallet does not move twice.
17. `/dashboard/transactions` and `/dashboard/wallet` recent
    activity show the lotto-claim Transaction.
18. `/admin/transactions` shows the same row.
19. Phase C deposit flow still works.
20. Phase D promotion claim still works.
21. Phase E referral claim still works.
22. Phase B homepage sections still render.
23. JILI launch still works.
24. Provider callback simulation still creates accepted
    ProviderTransaction rows.
25. Sidebar remains fixed.
26. No application error overlay.
27. Mobile 320 / 375 / 430: result cards stack cleanly, ticket
    numbers stay legible, claim button reachable above the bottom
    nav (`/lotto/my-winnings` reserves `pb-24`).

## What remains for Phase G

About + sponsorship + public payment-method section management:

- Replace hardcoded `AMBASSADORS`, `SPONSORS`, `PAYMENT_METHODS`
  arrays in `Footer.tsx` with DB-backed sections.
- Build admin pages for `BrandAmbassador`, `Sponsor`, and
  `PublicPaymentMethod` (Phase A tables). CRUD + sort + show/hide
  + image upload via the Phase D `<ImageUpload>` widget.
- Add the `PublicSection` rows for `about_ambassadors`,
  `about_sponsors`, `public_payment_methods` to drive show/hide
  + titles on the public footer.
- Mobile polish on the new public sections.
