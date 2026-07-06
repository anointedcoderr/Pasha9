# WinGo tournaments, live leaderboard and Telegram giveaways - design

Date: 2026-07-06. Built by Anointed Coder.

## Context

This document turns the authoritative tournaments spec into an
implementation-ready design for three linked features on the live Pasha9
casino:

1. WinGo wager tournaments with FULLY AUTOMATIC prize payout when the
   tournament window closes.
2. A public live leaderboard page (dark and gold Pasha9 identity, bilingual)
   that shows the active tournament, its prize table, a countdown, the live
   top standings and the signed in player own rank.
3. A Telegram group giveaway action that mints a multi-use PromoCode through
   the existing promo plumbing and best-effort broadcasts the code to the
   configured Telegram group.

SCOPE is WinGo only. The ranking metric is TOTAL WAGERED: the sum of
`WingoBet.betAmount` for a player inside the tournament window. Real BDT is
credited as a prize, so the whole risk is payout correctness: exactly-once,
idempotent, keyed, and money moves only after a guarded status transition.
This design mirrors two proven systems already in the codebase: the cashback
engine (aggregate per user over a window, pay each user once, keyed by a
unique idempotency key, inside one transaction, with a dry-run preview) and
the WinGo settlement engine (guarded status transition plus guarded per-item
payout so a re-run is a no-op). It does not build anything; it is the plan.

This is documentation only. No schema is applied and no code is written by
this document.

## Existing money path studied (files and functions reused)

Everything below already exists and is the authoritative pattern. The
tournament engine calls these directly or mirrors them line for line.

- `apps/web/lib/cashback/engine.ts`
  - `runCashbackCampaign(input)` - the tournament settlement BLUEPRINT:
    aggregate per user over a window, pre-load already-paid ids, pay each
    user once inside `db.$transaction`, unique `idempotencyKey` anchor
    created FIRST in the transaction, P2002 caught and treated as
    `skipped_duplicate`, `dryRun` short circuits before any write.
  - `loadPaidUserIds(campaignId, periodKey)` - resume helper pattern; the
    tournament engine mirrors it with `loadPaidUserIds(tournamentId)`.
  - `fmtBdt(amount)` - BDT presentation for notification text.
  - The exact grant transaction shape (steps 1..6: idempotency row, wallet
    upsert increment, UserBonus lock, Transaction row, Notification plus
    NotificationRecipient, wire-back update, ActivityLog) is copied.
- `apps/web/lib/bonuses/engine.ts`
  - `DIRECT_BALANCE_LOCK_SOURCES` (Set) - ADD `'tournament_prize'` here so a
    prize credited straight into `Wallet.balance` is locked by the withdrawal
    gate via a `UserBonus` row and its release is a no-op (money is already in
    balance and must never be credited twice). This is the prize-lock hook.
  - `grantBonusInTx`, `creditBonus`, `releaseBonus`, `addTurnover` - the
    turnover-lock semantics the prize lock rides on. The settlement path does
    NOT call `grantBonusInTx` (it needs no BonusRule); it mirrors the
    cashback path of a direct `wallet.upsert` plus a hand-built `UserBonus`
    row with `sourceType='tournament_prize'`, exactly like the promo
    `main_balance` lock in `redeemPromoCode`.
- `apps/web/lib/promo-codes/redeem.ts`
  - `redeemPromoCode({ rawCode, userId })` - UNCHANGED. Players redeem
    giveaway codes on the promotions page through this exact path. The
    giveaway action only creates a `PromoCode` and broadcasts the code.
  - The `main_balance` lock block (create `UserBonus` with `bonusRuleId=null`,
    `sourceType='promo_code'`, `turnoverRequired = amount * turnoverX`) is the
    model the prize lock copies (source swapped to `tournament_prize`).
  - `promoCodeSummary(promo)` - reused to render the giveaway summary line.
- `apps/web/lib/telegram/notify.ts`
  - `sendTelegramAlert(text, { ignoreEnabled })` - best-effort, 5s abort,
    never throws, called AFTER the DB commit, fire and forget. The giveaway
    broadcast uses it.
  - `escapeTelegramHtml(raw)` - escape all dynamic strings (code, amount,
    titles) before composing the HTML message.
  - `buildAdminTelegramMessage({...})` - reused to compose the bilingual
    giveaway message (bold Bangla title, English title, body, link).
  - `publicSiteBaseUrl()` - absolute base for the redeem link in the message.
- `apps/web/lib/wingo/flag.ts`
  - `loadWingoSettings`, `upsertSetting` pattern with `SystemSetting`
    (`category:'general'`, the enum has no tournament value). The optional
    tournament settings (see below) follow this exact key-constant plus
    loader plus setter shape.
- `apps/web/app/api/cron/wingo-tick/route.ts`
  - `bearerMatchesCronSecret(req)` plus the dual-auth POST body (Bearer
    `CRON_SECRET` OR `withAuth` + `ensurePermission('users.read')`,
    `recordActivity` on the admin branch). The tournament tick copies this
    file structure verbatim.
- `apps/web/app/api/admin/wingo/route.ts`
  - `withAuth` + `ensurePermission` + `recordActivity` handler shape; GET
    gated on read, mutating verbs gated on write, zod `safeParse`,
    `jsonOk` / `jsonError`. The admin tournament routes copy this.
- `apps/web/app/api/admin/promo-codes/route.ts`
  - `createSchema` (zod) and `POST` gated on `bonuses.write`. The giveaway
    action reuses the same create validation for the underlying PromoCode.
- `apps/web/app/api/admin/users/[id]/balance/route.ts`
  - The manual-credit reference (`wallet.upsert` increment, Transaction with
    balanceBefore/After, `recordActivity`) that confirms the credit shape.
- `apps/web/lib/auth/admin-permission-map.ts`
  - `ADMIN_PERMISSION_MAP` + `ADMIN_MENU_PERMISSIONS` - add the
    `/admin/tournaments` prefix and `tournaments` menu key, both on
    `bonuses.write` (same perm as promo codes and cashback).
- `apps/web/lib/constants/routes.ts`
  - `ROUTES.admin.*` - add `tournaments: '/admin/tournaments'`; add a public
    `ROUTES.leaderboard = '/leaderboard'` (or under the site group).
- `packages/database/prisma/schema.prisma`
  - `CashbackCampaign` (~L2656) and `CashbackPayout` (~L2686) - the field,
    type and index template for the two new models.
  - `WingoBet` (~L2875: `userId`, `betAmount`, `status`, `createdAt`, index
    `[userId, createdAt]`) - the leaderboard aggregation source.

## Data models (ADDITIVE only)

Two new models, mirroring `CashbackCampaign` / `CashbackPayout`. Add the
back-relation arrays to `User` (`tournamentPayouts`) exactly as
`cashbackPayouts` is wired. Nothing existing is renamed or removed. After the
schema edit run `pnpm --filter @pasha9/database exec prisma generate`.

### Tournament

```prisma
model Tournament {
  id            String    @id @default(cuid())
  nameEn        String
  nameBn        String?
  descriptionEn String?   @db.Text
  descriptionBn String?   @db.Text
  // Lifecycle: draft | active | ended | paid | void.
  // draft   editing / staging, not visible on the public leaderboard
  // active  published; scoring is governed by the [startsAt, endsAt) window
  // ended   window closed, standings frozen, not yet paid
  // paid    settlement claimed; prizes credited (idempotent, resumable)
  // void    terminal; never pays
  status        String    @default("draft")
  startsAt      DateTime
  endsAt        DateTime
  // Minimum total wagered for a player to qualify for a rank. 0 = everyone
  // with score > 0 qualifies (the default).
  minTurnover   Decimal   @default(0) @db.Decimal(14, 2)
  // Turnover multiplier applied to each prize as a UserBonus lock. Default
  // 1 (prize must be wagered once before withdrawal). 0 = pure cash.
  turnoverX     Decimal   @default(1) @db.Decimal(6, 2)
  // Ordered prize table: [{ "rank": 1, "amount": 5000 }, ...]. Validated on
  // write: ranks 1..N contiguous and unique, every amount > 0.
  prizes        Json      @default("[]")
  settledAt     DateTime?
  voidedAt      DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  payouts TournamentPayout[]

  // Mirrors CashbackCampaign @@index([isActive, endsAt]); the tick and the
  // public selector both filter by status and window.
  @@index([status, endsAt])
  @@index([status, startsAt])
}
```

### TournamentPayout

```prisma
model TournamentPayout {
  id             String   @id @default(cuid())
  tournamentId   String
  userId         String
  // Strict rank 1..N in the frozen final standings.
  rank           Int
  // Frozen total wagered that earned the rank (for the audit view).
  score          Decimal  @db.Decimal(14, 2)
  prizeAmount    Decimal  @db.Decimal(14, 2)
  // prizeAmount * tournament.turnoverX at settlement time. 0 = pure cash.
  turnoverRequired Decimal @default(0) @db.Decimal(14, 2)
  walletTxId     String?
  bonusGrantId   String?
  status         String   @default("granted")
  // tournamentId:userId . The exactly-once anchor, created FIRST inside the
  // payout transaction so a concurrent settle collides here (P2002).
  idempotencyKey String   @unique
  createdAt      DateTime @default(now())

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  // One payout per user per tournament, and one winner per rank. The rank
  // uniqueness is a second guard against ever inventing a duplicate winner.
  @@unique([tournamentId, userId])
  @@unique([tournamentId, rank])
  @@index([userId, createdAt])
  @@index([tournamentId, createdAt])
}
```

`User` gets `tournamentPayouts TournamentPayout[]` (back-relation only,
additive).

Design notes:

- Prize table as `Json` (not a child table) because it is a short, variable
  length ordered list edited as a unit, and it matches how cashback stores
  its config on the parent row. Validation lives in the admin write schema
  and in a shared `validatePrizeTable(prizes)` helper in the engine so the
  dry-run, the settlement and the admin form all agree.
- `turnoverX` default is 1 (spec), unlike cashback whose default is 0. A
  prize therefore locks once by default.
- No `TournamentBet` model: the leaderboard reads `WingoBet` directly, which
  is the single source of truth for wager.

### Optional settings (SystemSetting, category general)

New file `apps/web/lib/tournaments/flag.ts` following `lib/wingo/flag.ts`
exactly. Only one key is needed and it is optional:

- `tournaments_leaderboard_enabled` `'true' | 'false'`, default `'true'`.
  Controls whether the public leaderboard nav link renders. The page itself
  always renders an honest empty state when no tournament is live, so this is
  purely a visibility switch, not a money gate. Setter mirrors
  `setWingoEnabled`. No global "tournaments off" money gate is required
  because a tournament only exists and pays when an admin explicitly creates
  and publishes one, and the system ships with none.

## Leaderboard aggregation and the exact tiebreak

Aggregation is a single grouped read over `WingoBet`, mirroring the cashback
`groupBy`. Window is HALF OPEN `[startsAt, endsAt)`.

```ts
const grouped = await db.wingoBet.groupBy({
  by: ['userId'],
  where: {
    createdAt: { gte: tournament.startsAt, lt: tournament.endsAt },
    // Exclude REFUNDED: a refunded bet is a voided-round stake returned to
    // the player, so it is not real wager and must not inflate the score.
    // PENDING, WON and LOST all count as wagered.
    status: { not: 'REFUNDED' },
  },
  _sum: { betAmount: true },
  _min: { createdAt: true },
});
```

Then in memory:

1. Map each row to `{ userId, score: _sum.betAmount, firstAt: _min.createdAt }`.
2. Keep only `score > 0` AND `score >= tournament.minTurnover`
   (`minTurnover` default 0). Only these participate.
3. DETERMINISTIC STRICT RANKING. Sort by:
   1. `score` DESC (higher wager ranks first),
   2. then `firstAt` ASC (earlier first qualifying bet wins the tie: the
      player who reached that wager earlier is ranked higher),
   3. then `userId` ASC (final, fully deterministic tiebreak so two players
      with identical score and identical `firstAt` still get distinct ranks).
4. Assign strict ranks `1..N` by array position. No shared ranks.

`firstAt` is `min(createdAt)` of the user first bet in the window (the row
`_min.createdAt` already computes it), which is a stable, replayable value.
Because `endsAt` has passed at settlement, the frozen standings are identical
on every recomputation, so a resumed settlement pays exactly the same ranks.

This tiebreak is surfaced to players in the leaderboard help text so the
ordering is transparent: "Ranked by total wagered. Ties are broken by who
reached that amount first, then by account id."

Shared function (read-only, no money): `computeStandings(tournament, { limit })`
in `apps/web/lib/tournaments/leaderboard.ts`. Returns
`{ rows: [{ rank, userId, score, firstAt }], totalParticipants }`. Used by the
public API (top slice plus the caller own row), the admin dry-run preview, and
settlement (full slice up to the number of prize slots).

## Guarded, idempotent settlement algorithm

File `apps/web/lib/tournaments/engine.ts`, function `settleTournament(id, { dryRun, actorId, actorRole })`.
This is the money-critical path. It mirrors cashback plus the WinGo
guarded-transition pattern.

### Step 0. Load and classify

Read the tournament. Decide by status:

- `void` -> no-op, return `{ status: 'void', paid: 0 }`.
- `draft` -> no-op (never settles; publishing is an admin action).
- `active` and `now < endsAt` -> not due, no-op. (The tick handles
  `active -> ended`; `settleTournament` never ends a live tournament.)
- `active` and `now >= endsAt` -> treat as due: first perform the guarded
  `active -> ended` transition (see the tick), then fall through to `ended`.
- `ended` -> claim and settle (below).
- `paid` -> RESUME. Re-run only the payout loop; already-paid ranks are
  skipped by the unique key, so only missing ranks are paid. This is how a
  crash mid-settlement finishes.

### Step 1. Guarded claim of the status flip (ended -> paid)

Exactly one caller flips the status, so the "tournament settled" audit and
notification-of-record fire once even under concurrent ticks:

```ts
const claim = await db.tournament.updateMany({
  where: { id, status: 'ended' },
  data: { status: 'paid', settledAt: new Date() },
});
// claim.count === 1 -> this caller claimed the flip.
// claim.count === 0 -> another caller already flipped it (or it was already
//   paid). Fall through to the payout loop anyway; per-rank unique keys make
//   the loop safe to run again, which also delivers the crash-resume.
```

The status flip is guarded, but the PAYMENTS are not guarded by the flip.
Payments are guarded individually by `TournamentPayout.idempotencyKey`,
exactly like WinGo guards each bet flip rather than the round transition. So
concurrent callers and crash-resumes can both enter the loop with zero risk of
double payment.

On a `dryRun` this step is SKIPPED entirely (no `updateMany`), matching the
cashback dry-run guarantee that nothing is written.

### Step 2. Compute frozen standings and intended prizes

- `validatePrizeTable(tournament.prizes)` -> ordered `[{ rank, amount }]` with
  ranks `1..N` contiguous and unique, amounts `> 0`. A malformed table aborts
  settlement with a clear error and leaves money untouched (the guarded flip
  in step 1 has already happened, but with zero payouts the tournament is a
  paid-with-no-winners state that the admin can inspect; validation also runs
  at write time so this is defence in depth).
- `standings = computeStandings(tournament, { limit: prizes.length })`.
- Join by array position: prize slot `rank r` maps to the participant at rank
  `r`. If there are fewer participants than prize slots, the unused prizes are
  simply not paid. Never invent a winner.
- Result set: `winners = [{ rank, userId, score, prizeAmount }]` for each rank
  that has a participant.

### Step 3. Pre-load already-paid users (resume)

```ts
const paid = await loadPaidUserIds(tournamentId); // Set<userId>
```

Mirrors cashback `loadPaidUserIds`. Lets the loop short-circuit ranks already
paid on a prior partial run without opening a transaction.

### Step 4. Pay each winning rank exactly once

For each `winner`, if `paid.has(userId)` push `skipped_duplicate` and
continue. On a `dryRun`, record the intended line and continue (NOTHING below
runs). Otherwise open one `db.$transaction` that mirrors the cashback grant
transaction:

```ts
const turnoverRequired = prizeAmount.mul(tournament.turnoverX)
  .toDecimalPlaces(2, ROUND_DOWN);
const idempotencyKey = `${tournamentId}:${userId}`;

await db.$transaction(async (tx) => {
  // 1. Idempotency anchor FIRST. Unique key + unique [tournamentId, rank]
  //    make a concurrent or resumed double-pay throw P2002.
  const payout = await tx.tournamentPayout.create({
    data: { tournamentId, userId, rank, score, prizeAmount,
            turnoverRequired, status: 'granted', idempotencyKey },
  });

  // 2. Credit REAL BDT into Wallet.balance (prize is main-balance cash).
  await tx.wallet.upsert({
    where: { userId },
    update: { balance: { increment: prizeAmount } },
    create: { userId, balance: prizeAmount, bonusBalance: 0, lockedBalance: 0, currency: 'BDT' },
  });

  // 3. Prize lock. Only when turnoverX > 0. sourceType 'tournament_prize' is
  //    in DIRECT_BALANCE_LOCK_SOURCES, so the money stays in balance and the
  //    withdrawal gate subtracts this active UserBonus until turnover is met;
  //    release is a no-op. Mirrors the promo main_balance lock exactly.
  let bonusGrantId: string | null = null;
  if (turnoverRequired.gt(0)) {
    const lock = await tx.userBonus.create({
      data: { userId, bonusRuleId: null, amount: prizeAmount, status: 'active',
              turnoverRequired, turnoverProgress: 0,
              sourceType: 'tournament_prize', sourceId: payout.id,
              note: `Tournament ${tournament.nameEn} . rank ${rank}` },
    });
    bonusGrantId = lock.id;
  }

  // 4. Transaction ledger row. REUSE an existing enum value: type 'bonus'
  //    (same as the cashback prize credit). meta.kind marks it as a
  //    tournament prize. No new TxType enum value is added.
  const walletTx = await tx.transaction.create({
    data: { userId, type: 'bonus', status: 'completed', amount: prizeAmount,
            reference: payout.id,
            description: `Tournament prize . ${tournament.nameEn} . rank ${rank}`,
            meta: { kind: 'tournament_prize', tournamentId, tournamentPayoutId: payout.id,
                    rank, score: Number(score), turnoverRequired: Number(turnoverRequired) } },
  });

  // 5. Winner notification (kind 'tournament_win'). Bilingual, like cashback.
  const notification = await tx.notification.create({
    data: { titleEn: `Congratulations! You won rank ${rank} - ${fmtBdt(prizeAmount)} BDT`,
            titleBn: `অভিনন্দন! আপনি ${rank} নম্বর স্থান পেয়েছেন - ${fmtBdt(prizeAmount)} BDT`,
            bodyEn: `Prize from "${tournament.nameEn}"${turnoverRequired.gt(0) ? ` with a ${tournament.turnoverX}x turnover lock` : ''}.`,
            bodyBn: `"${tournament.nameBn ?? tournament.nameEn}" থেকে পুরস্কার${turnoverRequired.gt(0) ? `, ${tournament.turnoverX}x টার্নওভার শর্তসহ` : ''}।`,
            linkUrl: '/leaderboard', priority: 'high', status: 'sent',
            audience: 'selected', kind: 'tournament_win' },
  });
  await tx.notificationRecipient.create({
    data: { notificationId: notification.id, userId, deliveredAt: new Date() },
  });

  // 6. Wire-back + audit.
  await tx.tournamentPayout.update({
    where: { id: payout.id }, data: { walletTxId: walletTx.id, bonusGrantId },
  });
  await tx.activityLog.create({
    data: { actorId: actorId ?? null, actorRole: actorRole ?? 'system',
            action: 'TOURNAMENT_PRIZE_GRANT', target: payout.id,
            detail: `${tournament.nameEn} . rank ${rank} . user ${userId}`,
            meta: { tournamentId, userId, rank, prizeAmount: Number(prizeAmount),
                    turnoverRequired: Number(turnoverRequired) } },
  });
});
```

Wrap the transaction in the cashback `try/catch`: a `P2002` becomes a
`skipped_duplicate` line (already paid by a concurrent or prior run); any other
error becomes a `failed` line and the loop continues to the next rank so one
bad row never blocks the rest. The prize amount is rounded down to 2 decimals
before crediting so no sub-paisa fraction is credited.

### Step 5. Result

Return `{ tournamentId, status, dryRun, winners: lines, paidCount, totalPrize }`.
`dryRun` returns the intended lines with `payoutId: null` and zero writes.

### Idempotency and money-safety summary

- The status flip `ended -> paid` happens at most once (guarded `updateMany`).
- Each rank is paid at most once (`idempotencyKey` unique + `[tournamentId,
  rank]` unique + `[tournamentId, userId]` unique, all checked inside the
  payout transaction).
- A crash after the flip but before all payouts leaves the tournament `paid`
  with missing `TournamentPayout` rows; the next tick calls
  `settleTournament` again, the `paid` branch re-enters the loop, and only the
  missing ranks pay.
- A voided tournament never enters the loop (`void` short-circuits at step 0),
  and void is only allowed from `draft` / `active` / `ended`, never from
  `paid`.
- Money moves only inside the payout transaction, only for a participant who
  earned a rank, only after the guarded lifecycle reached `paid`.

## Void

`voidTournament(id, { actorId, actorRole })`:

```ts
const res = await db.tournament.updateMany({
  where: { id, status: { in: ['draft', 'active', 'ended'] } },
  data: { status: 'void', voidedAt: new Date() },
});
```

Guarded so a `paid` tournament cannot be voided (`res.count === 0` means it was
already paid or already void; return a clear conflict). No money is touched; a
voided tournament simply never pays. `recordActivity('TOURNAMENT_VOID')`.

## Cron driver contract

New route `apps/web/app/api/cron/tournament-tick/route.ts`, copied from
`wingo-tick` (dual auth: Bearer `CRON_SECRET` OR admin `users.read`, with
`recordActivity` on the admin branch). It calls `tournamentTick()` in the
engine:

```ts
export async function tournamentTick() {
  const now = new Date();
  // 1. End due tournaments. Guarded bulk transition active -> ended.
  const ended = await db.tournament.updateMany({
    where: { status: 'active', endsAt: { lte: now } },
    data: { status: 'ended' },
  });
  // 2. Settle every ended (and any paid-but-incomplete) tournament. Each call
  //    is guarded + idempotent, so this is safe to run every minute.
  const toSettle = await db.tournament.findMany({
    where: { status: { in: ['ended', 'paid'] } },
    select: { id: true },
  });
  const results = [];
  for (const t of toSettle) {
    try { results.push(await settleTournament(t.id, { actorRole: 'system' })); }
    catch (err) { results.push({ tournamentId: t.id, error: String(err) }); }
  }
  return { endedCount: ended.count, settled: results };
}
```

Notes:

- Including `paid` in the settle sweep is what makes crash resume automatic.
  A fully-paid tournament is a cheap no-op (all ranks already in `paid` set).
  To bound the sweep, `settleTournament` early-returns for a `paid` tournament
  whose payout count already equals its winner count (checked with one
  `count` before the loop), so a long-finished tournament costs a single
  query per tick and is dropped from the sweep once complete.
- `active -> ended` is a guarded bulk `updateMany`; concurrent ticks converge.
- Idempotent and safe every minute. Added to the VPS loopback crontab later,
  next to `wingo-tick` (loopback, Bearer `CRON_SECRET`).

Publishing is a separate admin action, not the tick: `draft -> active` is set
explicitly when the operator is ready. The tick never auto-publishes a draft,
so an unfinished draft can never go live or pay by itself.

### Settle-on-read (lazy correctness between ticks)

`ensureTournamentSettled(id)` (thin wrapper that runs the `active -> ended`
check for one tournament then `settleTournament`) is called at the top of:

- the public leaderboard API (for the selected tournament), and
- the admin list and detail reads.

So the admin console and the public page always show correct state even if the
last cron tick has not fired yet. It reuses the same guarded, idempotent
functions, so a lazy settle and a cron settle can race with no double pay.

## Public leaderboard API and page

### API

`GET apps/web/app/api/tournaments/active/route.ts` (public, no auth required;
if a session exists it adds the caller own row). Response:

```jsonc
{
  "tournament": {
    "id": "...", "nameEn": "...", "nameBn": "...",
    "descriptionEn": "...", "descriptionBn": "...",
    "status": "active", "startsAt": "...", "endsAt": "...",
    "state": "live",            // upcoming | live | ended | none
    "turnoverX": 1, "minTurnover": 0,
    "prizes": [{ "rank": 1, "amount": 5000 }, ...]
  },
  "standings": [                // top slice, e.g. top 50
    { "rank": 1, "maskedName": "Ra***11", "score": 12000, "isMe": false }
  ],
  "me": { "rank": 87, "score": 640, "qualified": true } // null if signed out or no bets
}
```

Selection logic (the "active" tournament shown):

1. Call `ensureTournamentSettled` for any due tournament first.
2. Pick the LIVE tournament: `status='active'` and `startsAt <= now < endsAt`,
   soonest `endsAt` first. If found, `state='live'`.
3. Else the next UPCOMING: `status='active'` and `startsAt > now`, soonest
   `startsAt`. `state='upcoming'` (countdown to start, prize table shown,
   empty standings).
4. Else the most recently ENDED-or-PAID within a short grace window (e.g. 24h)
   so winners can still see the final board. `state='ended'`.
5. Else `tournament=null`, `state='none'` (honest empty state).

Standings come from `computeStandings(tournament, { limit: 50 })`. Player
names are masked (reuse the existing public masking helper used elsewhere on
the site; never expose full names or ids publicly). The caller own row is
looked up separately by full `computeStandings` position (so a player outside
the top 50 still sees their real rank), keyed on the session `sub`.

Polling: the client re-fetches every ~15s. The endpoint is `force-dynamic`
and cheap (one grouped read plus one small settle check).

### Page

`apps/web/app/(site)/leaderboard/page.tsx` (client component, matches the
existing `app/(site)/*` fetch-JSON pattern like promotions and rewards).
Premium Pasha9 dark and gold identity, fully bilingual (English and Bangla via
the i18n dictionaries). Sections:

- Header: tournament name (bilingual), `state` badge, and a live COUNTDOWN
  (to `startsAt` when upcoming, to `endsAt` when live, "Finished" when ended).
- Prize table: rank and amount rows, plus the `turnoverX` note ("prizes carry
  a 1x wagering requirement" when turnoverX > 0, "paid as pure cash" when 0).
- Standings: rank, masked name, total wagered. Poll every 15s. The signed-in
  player own row is pinned and highlighted in gold, showing real rank and
  score even when outside the visible top slice; a "not qualified yet" hint
  shows when `score < minTurnover`.
- Help text stating the exact tiebreak (wager desc, earliest-to-reach, then
  account id) for transparency.
- Empty state when `state='none'`: a friendly bilingual "no tournament running
  right now, check back soon" panel.

Linked from the games lobby / primary nav (add the `leaderboard` route to the
site nav, gated on `tournaments_leaderboard_enabled`).

## Admin surface

Perm `bonuses.write` throughout (same as promo codes and cashback).

Plumbing edits (all additive, following the documented admin recipe):

- `apps/web/app/api/admin/tournaments/route.ts` - `GET` (list with status,
  window, participant count, prize count; gated `bonuses.write`) and `POST`
  (create; zod `createSchema` validates bilingual name, `startsAt < endsAt`,
  `turnoverX >= 0`, `minTurnover >= 0`, and the prize table via
  `validatePrizeTable`). Created as `status='draft'`.
- `apps/web/app/api/admin/tournaments/[id]/route.ts` - `GET` detail (config
  plus, when paid, the final ranks / amounts / payout status audit), `PATCH`
  edit (only while `draft` or `active`; the prize table and window are locked
  once `ended`), and the lifecycle actions below.
- Lifecycle action endpoints (or a single `PATCH` with an `action` field):
  - `publish` -> `draft -> active` (guarded `updateMany`).
  - `void` -> `voidTournament` (guarded, confirm dialog on the client).
  - `preview` -> `settleTournament(id, { dryRun: true })` returns intended
    standings and prizes WITHOUT crediting (admin preview).
  - `settle-now` -> `settleTournament(id)` for a manual settle of an already
    `ended` tournament (normally the tick does this).
  - Each mutating action calls `recordActivity`.
- Read layer `apps/web/lib/tournaments/admin.ts` (read-only, never moves
  money) following `lib/wingo/admin.ts`: `listTournaments()`,
  `getTournamentDetail(id)` (config + dry-run standings for a live one, or the
  frozen payout audit for a paid one).
- Page `apps/web/app/(admin)/admin/tournaments/page.tsx`: create / edit form
  (bilingual name and description, `startsAt` / `endsAt` pickers, a prize
  table BUILDER with add / remove rows validating contiguous ranks and
  positive amounts, `turnoverX`, `minTurnover`), a list with status chips, a
  "Preview standings" button (dry-run), a "Void" action with a confirm
  dialog, a "Publish" button for drafts, and a paid-results audit view (final
  ranks, amounts, per-rank payout status, wallet tx links).
- `lib/auth/admin-permission-map.ts`: add
  `{ prefix: '/admin/tournaments', permission: 'bonuses.write' }` to
  `ADMIN_PERMISSION_MAP` and `tournaments: 'bonuses.write'` to
  `ADMIN_MENU_PERMISSIONS`.
- `components/admin/AdminSidebar.tsx` AND `components/admin/AdminMobileDrawer.tsx`:
  add `{ key: 'tournaments', href: ROUTES.admin.tournaments, icon: Trophy }`
  to the Bonuses + promotions group (Trophy icon, already imported).
- `lib/i18n/dictionaries/{en,bn}.json`: add `admin.tournaments.*` labels and
  the public `leaderboard.*` strings.
- `lib/constants/routes.ts`: add `admin.tournaments: '/admin/tournaments'` and
  a public `leaderboard: '/leaderboard'`.

Ships with NO active tournament by default: nothing is seeded, so the admin
must create and publish one before anything is live or paid.

## Giveaway flow (Telegram group codes)

A small admin action, NOT a new redeem path. Players still redeem on the
promotions page through the UNCHANGED `redeemPromoCode`. The action:

- Endpoint `apps/web/app/api/admin/promo-codes/[id]/broadcast/route.ts`
  (`POST`, gated `bonuses.write`), OR a "Broadcast to Telegram" button on the
  existing promo-codes admin area. Optionally a small "Giveaway" panel that
  does create-and-broadcast in one step, reusing the promo-codes `createSchema`
  (reward `main_balance` or `bonus_grant`, `rewardAmount`, `maxRedemptions`,
  `perUserLimit` default 1, optional `endsAt` expiry, optional `turnoverX`).
- Step 1: create (or read) the multi-use `PromoCode` via the EXISTING promo
  plumbing (`db.promoCode.create` with the validated create schema). No new
  wallet logic; redemption stays on the promo path.
- Step 2: AFTER the DB commit, best-effort broadcast the code to the
  configured Telegram group:

```ts
const msg = buildAdminTelegramMessage({
  titleBn: `🎁 নতুন গিফট কোড: ${escapeTelegramHtml(promo.code)}`,
  titleEn: `New giveaway code: ${escapeTelegramHtml(promo.code)}`,
  bodyEn: `${promoCodeSummary(promo)}. Redeem on the promotions page.`,
  linkUrl: '/promotions',
});
await sendTelegramAlert(msg); // never throws; returns { ok } for the UI
```

- The action reports the `sendTelegramAlert` result to the admin
  (sent / skipped / error) but the promo creation is already committed, so a
  Telegram failure never rolls back the code. `recordActivity('PROMO_CODE_BROADCAST')`.
- Bilingual friendly message (bold Bangla first, English next), all dynamic
  values escaped, deep link to `/promotions` via `publicSiteBaseUrl()`.

## Edge cases and decisions

- Fewer participants than prize slots: unused prizes are not paid. Never
  invent a winner (join by array position, skip empty positions).
- `minTurnover` filters BEFORE ranking, so a sub-threshold player is neither
  ranked nor paid.
- REFUNDED WingoBets are excluded from the score (voided-round stakes are not
  real wager).
- A tie in both score and first-reach time is still broken deterministically
  by `userId`, so ranks are always strict `1..N` and the `[tournamentId, rank]`
  unique constraint can never be violated by legitimate settlement.
- Prize amounts and turnover locks are rounded down to 2 decimals before any
  credit, matching the wallet column and the cashback rounding.
- Editing after `ended` is blocked for the prize table and window so the
  frozen board and the paid prizes always agree.
- Overlapping tournaments are allowed by the model, but the public API shows
  one at a time (soonest-ending live one); the admin can run several and each
  settles independently.

## Verification plan for the build stage (not this stage)

- `pnpm --filter @pasha9/database exec prisma generate` after the additive
  schema edit.
- `pnpm --filter @pasha9/web typecheck`.
- `node scripts/check-branding.mjs` (no banned names, no long dashes,
  bilingual strings, Anointed Coder credit on touched credit files).
- Unit tests mirroring the cashback tests: dry-run writes nothing; a single
  settle pays each rank once; a concurrent double settle pays once (P2002);
  a crash-resume (`paid` with missing payouts) pays only the remainder; void
  never pays; fewer participants than prizes leaves slots unpaid; REFUNDED
  bets excluded; strict ranking and tiebreak deterministic.

## File manifest (build stage)

New:

- `packages/database/prisma/schema.prisma` (edit: add `Tournament`,
  `TournamentPayout`, `User.tournamentPayouts`).
- `apps/web/lib/bonuses/engine.ts` (edit: add `'tournament_prize'` to
  `DIRECT_BALANCE_LOCK_SOURCES`).
- `apps/web/lib/tournaments/engine.ts` (settlement, void, tick,
  validatePrizeTable, loadPaidUserIds).
- `apps/web/lib/tournaments/leaderboard.ts` (computeStandings).
- `apps/web/lib/tournaments/admin.ts` (read layer).
- `apps/web/lib/tournaments/flag.ts` (optional leaderboard visibility setting).
- `apps/web/app/api/cron/tournament-tick/route.ts`.
- `apps/web/app/api/tournaments/active/route.ts`.
- `apps/web/app/api/admin/tournaments/route.ts`.
- `apps/web/app/api/admin/tournaments/[id]/route.ts`.
- `apps/web/app/api/admin/promo-codes/[id]/broadcast/route.ts` (giveaway).
- `apps/web/app/(site)/leaderboard/page.tsx`.
- `apps/web/app/(admin)/admin/tournaments/page.tsx`.

Edited plumbing:

- `apps/web/lib/auth/admin-permission-map.ts`,
  `apps/web/lib/constants/routes.ts`,
  `apps/web/components/admin/AdminSidebar.tsx`,
  `apps/web/components/admin/AdminMobileDrawer.tsx`,
  `apps/web/lib/i18n/dictionaries/en.json`,
  `apps/web/lib/i18n/dictionaries/bn.json`,
  and the site nav that links `/leaderboard`.
</content>
</invoke>
