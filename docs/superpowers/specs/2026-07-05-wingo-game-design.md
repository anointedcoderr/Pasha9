# WinGo colour-prediction game - design

Date: 2026-07-05. Built by Anointed Coder.

## Context

WinGo is a shared, round-based colour and number prediction game that runs
continuous back-to-back rounds in four independent time modes (30s, 1m, 3m,
5m). Every player in a mode bets into the same round and every round draws a
single number 0..9 whose colour identity and size decide all payouts. This is
a REAL MONEY game inside the live Pasha9 casino, so the entire risk is
correctness of round settlement: idempotent payout, guarded status
transitions, server-enforced bet close, no double-pay.

WinGo differs from the existing native games (dice, mines, crash, keno,
roulette, slots) in one structural way. Those games are per-user,
per-session, instant-settle: one player, one `GameSession` with a rolling
`nonce`, and the bet settles synchronously inside the same request. WinGo is
multi-player and time-driven: a round is shared by everyone, betting closes on
a clock, and settlement happens later (on a cron tick or lazily on read), not
in the placing request. So WinGo needs its own two models and its own service,
but it MUST reuse the exact same wallet ledger path, turnover accrual,
cashback scope stamping, admin gating, provably-fair primitives, and UI shell
that the native games already use. This document is the implementation-ready
design; it does not build.

## Existing money path studied (files and functions WinGo reuses)

Everything below already exists and is the authoritative pattern. WinGo calls
these directly or mirrors them exactly.

### Wallet ledger and the bet/win transaction pattern

`apps/web/lib/native-games/service.ts` is the reference implementation. The
instant-settle template `settleInstant` (and the standalone `settleDiceBet`)
show the exact wallet movement WinGo mirrors:

- Debit the stake: `tx.wallet.update({ where: { userId }, data: { balance: { decrement: stake } } })`.
- Credit a win: `tx.wallet.update({ where: { userId }, data: { balance: { increment: payout } } })`.
- One ledger row per movement via `tx.transaction.create`:
  - bet debit: `{ type: 'bet', status: 'completed', amount: stake.neg(), reference: <roundId or betId>, description, meta: { gameCode, roundId, sessionId, nonce, scope: 'casino' } }`
  - win credit: `{ type: 'win', status: 'completed', amount: payout, reference, description, meta: { ..., scope: 'casino' } }`
- The `Prisma.Decimal` wrapper `dec(value)` in the same file (line 78). WinGo
  reuses this pattern for all money math (never floats).
- Min/max enforcement helper `assertBetInRange(game, bet)` in the same file
  (line 88): throws `BET_BELOW_MIN` / `BET_ABOVE_MAX` against
  `NativeGameProvider.minBet` / `maxBet`. WinGo reuses the same guard against
  its own seeded `wingo` provider row.
- Idempotency guard pattern: a unique key column plus a `findUnique` replay
  check that returns the stored row instead of re-debiting
  (`settleInstant` lines 400..417). WinGo mirrors this on `WingoBet.idempotencyKey`.
- Guarded terminal transition pattern: `revealMinesTile` / `cashoutMines`
  gate on `round.outcome !== 'PENDING'` before paying. WinGo hardens this into
  a conditional `updateMany` (see settlement) so exactly one caller pays each bet.

### Cashback scope stamping

Cashback eligibility is computed by reading `Transaction.meta.scope` against
the campaign's `scopeKeys`. See `apps/web/lib/cashback/engine.ts` (the scoped
path, lines 187..226): `meta: { path: ['scope'], equals: key }`. Every native
game bet and win Transaction stamps `meta.scope = 'casino'`. WinGo stamps the
identical `scope: 'casino'` on its bet debit and win credit Transaction rows so
WinGo wagering feeds casino-scoped cashback with zero cashback-engine changes.

### Turnover accrual (bonus wagering progress)

`apps/web/lib/bonuses/engine.ts:addTurnover` (line 654) applies a wager amount
to the player's active bonus grants and writes `TurnoverEvent` rows. Native
games call it AFTER the wallet transaction commits, fire-and-forget, so a bonus
failure can never roll back the bet. See
`apps/web/app/api/native-games/[gameCode]/bet/route.ts` line 144:
`addTurnover({ userId, amount: betAmount, kind: 'native_game', reference: roundId, meta: { gameCode } }).catch(...)`.
WinGo calls `addTurnover` on the stake at placement time, after the placement
transaction commits, with `kind: 'native_game'`, `meta: { gameCode: 'wingo', mode }`.

### Enable gating (global flag and per-game active)

- Global switch: `apps/web/lib/native-games/flag.ts:isNativeGamesEnabled`
  (reads SystemSetting `native_games_enabled`). Every WinGo route calls this
  first and returns a disabled state when off, exactly like
  `apps/web/app/api/native-games/[gameCode]/bet/route.ts` line 122 and
  `.../[gameCode]/route.ts`.
- Public visibility: `apps/web/lib/native-games/flag.ts:isNativeGamesPublic`
  gates whether the game appears in the public lobby / homepage.
- Per-game active + min/max + config: the `NativeGameProvider` row (schema
  line 1829) with `isActive`, `minBet`, `maxBet`, `config Json`. WinGo seeds a
  row `gameCode = 'wingo'`, `isActive = false` (ships DISABLED), so the
  existing admin PATCH surface toggles it. Per-mode enable lives in that row's
  `config.modes`.
- Admin write gate: `apps/web/lib/auth/guard.ts:ensurePermission('settings.write')`
  for config edits and `ensurePermission('users.read')` for read/audit, as used
  in `apps/web/app/api/admin/native-games/[gameCode]/route.ts` (line 35) and
  `.../native-games/route.ts` (line 19). The global on/off writer
  `apps/web/lib/native-games/flag.ts:setNativeGamesEnabled` is reused as-is.

### Auth, HTTP, rate limiting

- `apps/web/lib/auth/guard.ts:withAuth`, `recordActivity`, `ensurePermission`.
- `apps/web/lib/auth/rbac.ts:requireActiveUser`.
- `apps/web/lib/auth/errors.ts:jsonOk`, `jsonError`.
- `apps/web/lib/auth/rate-limit.ts:rateLimit` (native games use max 30 per 60s
  per user per game; WinGo reuses the same constants shape from a WinGo config).

### Provably-fair primitives (fairness record and the draw)

`apps/web/lib/native-games/provably-fair.ts`:
- `generateServerSeed()` (32 random bytes hex) for each round's server seed.
- `hashServerSeed(seed)` (SHA-256 hex) committed publicly at round open.
- `hmacBytes(serverSeed, clientSeed, nonce, cursor)` and
  `bytesToInt(bytes, max)` to derive the result deterministically from the
  committed seed. WinGo derives the drawn number as
  `bytesToInt(hmacBytes(serverSeed, periodNumber, 0), 10).value`. The seed is
  fixed and hash-committed BEFORE the draw, revealed AFTER settlement, so the
  draw is auditable and not riggable. The house edge lives in the paytable,
  not the draw.
- Seed at rest is AEAD-encrypted with
  `apps/web/lib/crypto/aead.ts:encryptString` / `decryptString`, the same as
  `GameSession.serverSeed`.

### Cron auth pattern

`apps/web/app/api/cron/cashback/route.ts` shows the Bearer `CRON_SECRET`
pattern (the `bearerMatchesCronSecret` helper, lines 31..37, requiring the
`Bearer ` prefix) plus the admin fallback. WinGo's tick copies this exactly.

### UI shell and celebration components to reuse

- `apps/web/components/native-games/GameShell.tsx`: `GameShell`, `GamePanel`,
  `GamePanelTitle` (the dark mahogany + gold game frame, disabled-state and
  deposit-required handling).
- `apps/web/components/native-games/FairnessDrawer.tsx` (seed hash + reveal UI),
  `RulesModal.tsx`, `BetCard.tsx`, `DepositRequiredModal.tsx`.
- Win celebration: `apps/web/components/site/RewardCelebration.tsx` /
  `LottoWinCelebration.tsx` are the existing celebration components the reveal
  feeds with the real payout amount.

## Data model (additive: two new models, one seed row)

Both models are new; no existing table changes. Evolve with `prisma db push`
per the Pasha9 schema convention, then `prisma generate`.

### WingoRound

One shared round per (mode, epoch index). Result and seed reveal are
round-scoped, not per player.

| Field            | Type       | Notes |
|------------------|------------|-------|
| id               | String @id @default(cuid()) | |
| mode             | String     | `wingo_30s` \| `wingo_1m` \| `wingo_3m` \| `wingo_5m` |
| epochIndex       | Int        | Deterministic round index from the fixed epoch anchor. Creation idempotency key |
| periodNumber     | String     | Human id, unique. `YYYYMMDD` + mode tag + per-mode-per-day sequence |
| seq              | Int        | Per-mode-per-day running sequence (1-based) used inside periodNumber |
| startsAt         | DateTime   | Round open time |
| betCloseAt       | DateTime   | `drawsAt` minus 5 seconds; betting hard-stops here |
| drawsAt          | DateTime   | Draw + settle time; equals the next round's `startsAt` |
| status           | String @default("OPEN") | `OPEN` \| `CLOSED` \| `DRAWN` \| `SETTLED` |
| result           | Int?       | 0..9, null until DRAWN |
| serverSeed       | String @db.Text | AEAD-encrypted server seed, committed at open |
| serverSeedHash   | String     | SHA-256 hex, public from open |
| revealedAt       | DateTime?  | Set when the plaintext seed becomes revealable (at settle) |
| totalBetAmount   | Decimal @default(0) @db.Decimal(14,2) | Sum of stakes, for audit |
| totalPayout      | Decimal @default(0) @db.Decimal(14,2) | Sum of payouts, for audit |
| settledAt        | DateTime?  | |
| createdAt        | DateTime @default(now()) | |

Indexes and constraints:
- `@@unique([mode, epochIndex])` (idempotent creation; the round for a mode at
  an index exists at most once even under concurrent ticks and reads).
- `@@unique([periodNumber])`.
- `@@index([mode, status, drawsAt])` (find due-to-settle rounds fast).
- `@@index([mode, drawsAt])` (recent-results and current-round lookups).

### WingoBet

One row per bet line. A player may place several per round; each line carries
its own X multiplier.

| Field            | Type       | Notes |
|------------------|------------|-------|
| id               | String @id @default(cuid()) | |
| roundId          | String     | FK to WingoRound |
| userId           | String     | FK to User |
| mode             | String     | Denormalized for query |
| selectionType    | String     | `color` \| `number` \| `size` |
| selection        | String     | color: `green`\|`red`\|`violet`; number: `0`..`9`; size: `big`\|`small` |
| quantity         | Int        | X multiplier chip, 1..100 |
| unitStake        | Decimal @db.Decimal(14,2) | Base stake per chip, min 1 |
| stake            | Decimal @db.Decimal(14,2) | `unitStake * quantity`, the debited/wagered amount, max 100000 |
| status           | String @default("PENDING") | `PENDING` \| `SETTLED` \| `VOID` |
| outcome          | String?    | `WIN` \| `LOSS`, null until settled |
| payoutMultiplier | Decimal @default(0) @db.Decimal(10,4) | Total-return multiplier on win, 0 on loss |
| payoutAmount     | Decimal @default(0) @db.Decimal(14,2) | Gross credit on win, 0 on loss |
| idempotencyKey   | String @unique | Replay guard; client key or `${roundId}:${userId}:${selectionType}:${selection}:${clientNonce}` |
| settledAt        | DateTime?  | |
| createdAt        | DateTime @default(now()) | |

Relations and indexes:
- `round WingoRound @relation(fields: [roundId], references: [id], onDelete: Cascade)`.
- `user User @relation(fields: [userId], references: [id])`.
- `@@index([roundId, status])` (the settlement pending-bet scan).
- `@@index([userId, createdAt])` (my-history).
- `@@index([roundId, userId])`.

### Seed row (data, not schema)

Seed a `NativeGameProvider` row so WinGo reuses the whole native-games admin
enable surface and min/max columns:

```
gameCode: 'wingo', displayName: 'Pasha WinGo',
isActive: false,          // ships DISABLED
isFeatured: false, sortOrder: 70,
houseEdgeBps: 0,          // WinGo edge is in the paytable, not a bps knob
minBet: 1, maxBet: 100000,
config: { modes: { wingo_30s: false, wingo_1m: false, wingo_3m: false, wingo_5m: false } }
```

Note: `wingo` is intentionally NOT added to `SUPPORTED_GAME_CODES` in
`apps/web/lib/native-games/config.ts`, because the generic session-based
`/api/native-games/[gameCode]/*` routes must ignore it. WinGo has its own
routes and its own `lib/wingo` config. The admin games list
(`listGamesWithTotals`) iterates all provider rows, so the WinGo enable toggle
appears automatically; WinGo money audit comes from the dedicated WinGo
aggregate, not from `GameRound`.

## Round lifecycle and epoch-anchored timing math

A fixed UTC epoch anchor is a constant, `WINGO_EPOCH` (for example
`2025-01-01T00:00:00.000Z`). Never change it once live. Each mode has a fixed
duration `D` in seconds:

| Mode      | Tag   | D (s) |
|-----------|-------|-------|
| wingo_30s | `30`  | 30    |
| wingo_1m  | `01`  | 60    |
| wingo_3m  | `03`  | 180   |
| wingo_5m  | `05`  | 300   |

For any wall-clock `now` (ms) and mode duration `D`:

```
epochIndex   = floor((now - WINGO_EPOCH) / (D * 1000))
startsAt     = WINGO_EPOCH + epochIndex * D * 1000
drawsAt      = startsAt + D * 1000
betCloseAt   = drawsAt - 5000
nextStartsAt = drawsAt                      // == startsAt(epochIndex + 1)
```

Because `startsAt(index + 1) == drawsAt(index)`, the stream is continuous and
fully deterministic. Given only `WINGO_EPOCH`, `D`, and a timestamp, any caller
computes the same round boundaries, so cron ticks and lazy-on-read agree
without coordination.

Round state as a function of `now` for the current index:
- `startsAt <= now < betCloseAt`  -> OPEN, betting accepted.
- `betCloseAt <= now < drawsAt`   -> CLOSED, betting rejected, draw pending.
- `now >= drawsAt`                -> DRAWN then SETTLED (settlement runs).

Stored `status` starts OPEN. The CLOSED state can be left time-derived (the UI
and the bet route both compute it from `betCloseAt`); the tick may also persist
CLOSED, but bet acceptance never trusts stored status alone (see money rules).

### periodNumber

Human-facing id, unique per (mode, round):

```
dayStartLocal = local midnight (Asia/Dhaka, UTC+6) of startsAt
seq           = floor((startsAt - dayStartLocal) / (D * 1000)) + 1
periodNumber  = format(startsAt in Asia/Dhaka, 'YYYYMMDD') + modeTag + zeroPad(seq, 6)
```

Example shape: `20260705` + `30` + `000173`. The date and per-day sequence are
computed in Asia/Dhaka because Pasha9 is Bangladesh-facing, matching the
reference id style. Uniqueness is guaranteed by `@@unique([periodNumber])` and,
independently, by `@@unique([mode, epochIndex])`.

## Paytable (total-return multipliers)

Number to colour and size map (fixed):

| Number | Colours       | Size  |
|--------|---------------|-------|
| 0      | red + violet  | small |
| 1      | green         | small |
| 2      | red           | small |
| 3      | green         | small |
| 4      | red           | small |
| 5      | green + violet| big   |
| 6      | red           | big   |
| 7      | green         | big   |
| 8      | red           | big   |
| 9      | green         | big   |

Total-return multiplier: a winning line returns `stake * multiplier`; a losing
line returns 0. Net profit on a win is `stake * (multiplier - 1)`.

| Bet         | Wins on result             | Multiplier |
|-------------|----------------------------|------------|
| GREEN       | 1, 3, 7, 9                 | 2.0        |
| GREEN       | 5 (green + violet)         | 1.5        |
| RED         | 2, 4, 6, 8                 | 2.0        |
| RED         | 0 (red + violet)           | 1.5        |
| VIOLET      | 0 or 5                     | 4.5        |
| NUMBER n    | result == n                | 9.0        |
| BIG         | 5, 6, 7, 8, 9              | 2.0        |
| SMALL       | 0, 1, 2, 3, 4              | 2.0        |

Anything not listed loses. This is encoded in
`apps/web/lib/wingo/paytable.ts:evaluateBet(result, selectionType, selection)`
returning `{ win: boolean, multiplier: Decimal }`, with a `colourOf(n)` helper.

Stake rules: `unitStake >= 1` BDT; `stake = unitStake * quantity` with
`quantity` in 1..100; `stake <= 100000` BDT enforced AFTER the multiplier, and
`stake >= minBet` / `<= maxBet` from the seeded provider row via the reused
`assertBetInRange` guard.

## Bet-placement transaction

Route: `POST /api/games/wingo/bet`. Guarded, server-authoritative.

1. `withAuth` + `requireActiveUser`; `rateLimit` per user (reuse the native
   games rate constants shape).
2. Gate: `isNativeGamesEnabled()` true, the `wingo` provider row `isActive`
   true, and `config.modes[mode]` true. Otherwise return a disabled state.
3. Validate body with zod: `mode` in the four modes; `selectionType` and
   `selection` consistent; `quantity` integer 1..100; `unitStake` positive.
   Compute `stake = unitStake * quantity`; reuse `assertBetInRange` and the
   100000 cap.
4. Compute the current round for the mode via
   `ensureRound(mode, epochIndexNow)`. Reject with `BET_CLOSED` if
   `now >= round.betCloseAt` (server clock). This rejection is server-side and
   is the authoritative close, never merely a UI lock.
5. `db.$transaction`:
   - Re-read the round inside the transaction; re-assert `status` is not past
     draw and `now < betCloseAt`. Reject `BET_CLOSED` if the window closed
     during the request.
   - Idempotency: `WingoBet.findUnique({ idempotencyKey })`; if present, return
     the stored bet unchanged (no second debit).
   - `wallet.findUnique`; reject `WALLET_NOT_FOUND` / `INSUFFICIENT_FUNDS`
     (`balance < stake`).
   - Debit: `wallet.update({ balance: { decrement: stake } })`.
   - Create `WingoBet` as `PENDING` (outcome null, payout 0).
   - Create the bet Transaction:
     `{ type: 'bet', status: 'completed', amount: dec(stake).neg(), reference: bet.id, description: 'Pasha WinGo bet', meta: { gameCode: 'wingo', roundId, periodNumber, mode, selectionType, selection, quantity, scope: 'casino' } }`.
   - Increment `round.totalBetAmount` by `stake` (best-effort audit).
6. After commit (fire-and-forget, mirroring native games):
   - `addTurnover({ userId, amount: stake, kind: 'native_game', reference: roundId, meta: { gameCode: 'wingo', mode } }).catch(log)`.
   - `recordActivity({ action: 'NATIVE_BET', target: bet.id, meta: {...} })`.

Cashback scope is stamped on the bet Transaction at placement (`scope: 'casino'`)
and turnover accrues on the wagered stake at placement, so the wager feeds
casino cashback and bonus wagering regardless of the later outcome. Settlement
stays a pure payout step. This matches the existing games, which also accrue
turnover at the bet call rather than on a later event, and keeps the money-safe
property that settlement never has to touch turnover or cashback.

## Idempotent settlement algorithm (step by step)

Runs from the cron tick and lazily on read. Fully idempotent: re-running a
settled round is a no-op and can never double-pay or double-debit.

Input: `now`. For each mode, and for the specific due round(s):

1. Select due rounds: `WingoRound` where `drawsAt <= now` and
   `status != 'SETTLED'`, oldest `drawsAt` first (bounded batch).
2. Guarded draw (exactly one caller generates the result):
   ```
   const claimed = await db.wingoRound.updateMany({
     where: { id: round.id, status: { in: ['OPEN', 'CLOSED'] } },
     data: { status: 'DRAWN', result, revealedAt: now },
   });
   ```
   where `result = bytesToInt(hmacBytes(decryptString(round.serverSeed), round.periodNumber, 0), 10).value`.
   Because `result` is derived from the already-committed seed, every caller
   computes the same value, but only the caller whose `updateMany` returns
   `count === 1` writes it. If `count === 0`, another caller already drew;
   re-read the row to get the authoritative `result` and continue to payout.
   The result is generated ONCE and is not admin-selectable.
3. Pay every pending bet exactly once. Load
   `WingoBet where roundId = round.id and status = 'PENDING'`. For each bet, in
   its own `db.$transaction`:
   ```
   const paid = await tx.wingoBet.updateMany({
     where: { id: bet.id, status: 'PENDING' },
     data: { status: 'SETTLED', outcome, payoutMultiplier, payoutAmount, settledAt: now },
   });
   if (paid.count === 1 && payoutAmount > 0) {
     await tx.wallet.update({ where: { userId: bet.userId }, data: { balance: { increment: payoutAmount } } });
     await tx.transaction.create({ data: { type: 'win', status: 'completed', amount: dec(payoutAmount), reference: bet.id, description: 'Pasha WinGo win', meta: { gameCode: 'wingo', roundId, periodNumber, mode, scope: 'casino' } } });
   }
   ```
   The `where status: 'PENDING'` guard is the per-bet lock: a concurrent tick
   or a retry sees `count === 0` and credits nothing. `outcome` /
   `payoutMultiplier` / `payoutAmount` come from `evaluateBet(result, ...)`
   times `stake`.
4. Finalize: once no `PENDING` bets remain for the round:
   ```
   await db.wingoRound.updateMany({
     where: { id: round.id, status: 'DRAWN' },
     data: { status: 'SETTLED', settledAt: now, totalPayout: <sum credited> },
   });
   ```
   Re-runs: `status === 'SETTLED'` short-circuits at step 1's filter; a `DRAWN`
   round with leftover pending bets (a crash mid-loop) simply resumes paying
   the remaining ones; already-settled bets are skipped by the guard. No win is
   ever credited twice; no stake is ever debited twice.

There is no per-bet debit at settlement (the stake was debited at placement),
so settlement is credit-only and losers need no wallet movement, only the
status flip.

## Cron tick contract

Route: `POST /api/cron/wingo-tick`. Auth: Bearer `CRON_SECRET` (reuse the
`bearerMatchesCronSecret` pattern from the cashback cron, requiring the
`Bearer ` prefix) with an admin `users.read` fallback. Idempotent and safe to
call every few seconds; scheduled on the VPS loopback crontab.

On each call, for every mode:
1. Compute `epochIndexNow`. `ensureRound(mode, epochIndexNow)` and
   `ensureRound(mode, epochIndexNow + 1)` so the current and next rounds always
   exist. `ensureRound` upserts on `@@unique([mode, epochIndex])`, generating a
   fresh `serverSeed` + `serverSeedHash` + computed `periodNumber` and window
   times; concurrent callers collide harmlessly on the unique constraint.
2. Settle any rounds with `drawsAt <= now` and `status != 'SETTLED'` using the
   algorithm above.
3. Return a JSON summary: per mode, the current period number, whether current
   and next were created, how many rounds were settled, how many bets were
   paid, and total credited. Errors per round are collected and do not abort
   the batch.

Lazy-on-read: the WinGo state GET endpoints call the same `ensureRound` and
`settleDueRounds` helpers so the UI is correct even between ticks. A read never
depends on the cron having run.

## Public API surface (routes)

All under `/api/games/wingo*`; each returns a disabled state when the game is
off, matching native games.

- `GET /api/games/wingo` -> for all four modes: current round (period number,
  startsAt/betCloseAt/drawsAt, status, serverSeedHash), the last N results
  (recent mini-balls), and the enabled flags. Runs `settleDueRounds` and
  `ensureRound` lazily first.
- `POST /api/games/wingo/bet` -> place a bet (transaction above).
- `GET /api/games/wingo/history?mode=&tab=` -> game history (recent settled
  rounds with result + period), chart (colour/size/number frequency for the
  chart tab), and my-history (the caller's `WingoBet` rows joined to round
  results). Paginated.
- `GET /api/games/wingo/round/[periodNumber]/verify` -> after settle, returns
  the revealed plaintext `serverSeed`, the committed `serverSeedHash`, the
  `periodNumber`, and the `result`, so anyone can recompute
  `bytesToInt(hmacBytes(serverSeed, periodNumber, 0), 10)` and confirm the draw.
  Refuses to reveal before `revealedAt`.

## Admin surface

Consistent with `apps/web/app/(admin)/admin/native-games`.

- Enable/disable the whole game: reuse the global `native_games_enabled`
  toggle (`setNativeGamesEnabled`) plus the `wingo` provider row `isActive`
  toggle via the existing `PATCH /api/admin/native-games/wingo`
  (`ensurePermission('settings.write')`). No new endpoint needed for on/off,
  min, max, or house settings.
- Enable/disable per mode and edit min/max stake: the same PATCH writes the
  provider row `config.modes` map and `minBet` / `maxBet`. The admin editor
  gains four mode switches and the two stake fields. Ships with all modes false
  and `isActive` false.
- Rounds and bets audit view: new read endpoints
  `GET /api/admin/games/wingo/rounds` and `GET /api/admin/games/wingo/bets`
  (`ensurePermission('users.read')`), backed by new service functions
  `listWingoRounds` and `listWingoBets` that mirror
  `apps/web/lib/native-games/service.ts:listRecentRounds` (join usernames,
  bounded `take`, filter by mode/user/outcome). A WinGo section in the admin UI
  shows per-mode totals (wagered, paid, house result, rounds in last 24h) and a
  recent rounds table (period, result ball, bet count, house result) and a
  recent bets table.
- No admin control can select or override a round result. The audit view is
  read-only over the cryptographic draw. A super-admin rollback of a single
  bet, if ever needed, follows the existing
  `apps/web/lib/native-games/service.ts:rollbackRound` adjust-transaction
  pattern (write a reversing `adjust` Transaction, mark the bet `VOID`), never
  a silent balance edit.

All admin and player strings are bilingual (English + Bangla), matching the
native-games pattern.

## Module layout (to build in later stages)

- `apps/web/lib/wingo/config.ts`: modes, durations, tags, `WINGO_EPOCH`,
  paytable multipliers, min/max, gameCode `'wingo'`, rate-limit constants,
  mode-enable helpers reading the provider `config.modes`.
- `apps/web/lib/wingo/timing.ts`: `epochIndexFor(mode, now)`, `roundWindow`,
  `periodNumberFor` (Asia/Dhaka date + seq).
- `apps/web/lib/wingo/fairness.ts`: `deriveResult(serverSeed, periodNumber)`
  using `hmacBytes` + `bytesToInt`; seed generation and hash via the reused
  provably-fair primitives.
- `apps/web/lib/wingo/paytable.ts`: `colourOf(n)`, `sizeOf(n)`, `evaluateBet`.
- `apps/web/lib/wingo/service.ts`: `ensureRound`, `getModesState`, `placeBet`,
  `settleDueRounds`, `verifyRound`, `listWingoRounds`, `listWingoBets`.
- `apps/web/app/api/games/wingo/*` and
  `apps/web/app/api/cron/wingo-tick/route.ts`.
- `apps/web/app/(site)/games/wingo/page.tsx` and
  `apps/web/components/wingo/*`.
- Admin: extend `apps/web/app/(admin)/admin/native-games/page.tsx` mode
  controls plus a WinGo audit section and
  `apps/web/app/api/admin/games/wingo/*`.

## Premium UI and animation plan (section by section)

Pasha9 dark mahogany + gold premium language, original artwork, the spin-wheel
quality bar. All motion is transform/opacity only for 60fps, every animation
has a `prefers-reduced-motion` variant, all copy is bilingual (English +
Bangla), mobile-first, minimum 44px touch targets, visible focus rings. Wrap
the whole screen in the existing `GameShell` (accent gold) so disabled-state
and deposit-required flows come for free.

1. Four-mode tab switcher. A gold-underline segmented control (30s / 1m / 3m /
   5m). Switching modes crossfades the round card (opacity) and swaps the
   active stream without layout shift. Selected tab has an animated gold sheen;
   reduced-motion shows a static underline.

2. Round card. Top row: recent-results mini balls (last ~10 draws) as small
   glossy colour dots that slide in from the right when a new result lands
   (transform translateX, staggered). The long `periodNumber` in a monospace
   gold label with a copy affordance. A digital countdown (MM:SS) driven off
   `betCloseAt` / `drawsAt` computed client-side from the server-sent times, so
   it stays smooth between polls.

3. Last-10-seconds takeover. When `now >= betCloseAt - 10s`, the countdown
   expands into a full-screen digital takeover with large tumbling digits and a
   dimmed backdrop that visibly LOCKS betting (all bet controls disabled and
   greyed, a bilingual "Betting closed / বেট বন্ধ" banner). The lock is a
   client mirror of the server rule; the server still rejects any late bet.
   Reduced-motion swaps the tumble for a simple number step and a static lock.

4. Colour buttons. Three wide glossy buttons Green / Violet / Red with 3D press
   feedback (scale 0.97 on active, spring back), correct brand colours, and a
   subtle inner gloss. Tapping opens the bet sheet tinted to that colour.

5. Number balls. Ten glossy 3D balls 0..9 with the correct colour identity
   (0 red+violet split, 5 green+violet split, evens red, odds green). Press
   feedback is a transform scale + a soft ring. Balls are pure CSS/SVG gradients
   (original art), not images of the reference.

6. Multiplier and quick controls. A Random button (picks a number ball) and X1
   / X5 / X10 / X20 / X50 / X100 quantity chips. The chosen chip glows gold and
   updates the running total. Big / Small selection bar below, two wide buttons
   with the size colour hint.

7. Bet bottom-sheet. Slides up (transform translateY) tinted to the chosen
   colour. Contains: the selection summary, quick amounts 1 / 10 / 100 / 1000,
   a quantity stepper (minus / value / plus, 1..100), an agree-to-rules check
   (links the reused `RulesModal`), the live total, and a confirm button
   showing the exact total amount. Insufficient balance routes into the reused
   `DepositRequiredModal`. Confirm posts the bet with an `idempotencyKey`.

8. History tabs. Game history (recent settled rounds: period + result ball +
   Big/Small + colour), Chart (colour and size frequency bars and a
   missing-streak chart for the chart tab), and My history (the player's bets
   with win/loss and payout). Each tab has a designed empty state with gold
   line art and bilingual copy.

9. Result reveal. At `drawsAt`, a suspense reveal: the result ball tumbles into
   place and pops with a colour burst (opacity + scale keyframes only). If the
   player won, feed the real payout into the existing celebration component
   (`RewardCelebration` / `LottoWinCelebration`) with the summed win amount.
   Reduced-motion shows the final ball and a static amount, no burst.

10. Fairness affordance. Reuse `FairnessDrawer` to show the current round's
    `serverSeedHash` (committed) and, for any past round, the revealed seed +
    result so a player can verify the draw. Bilingual labels throughout.

## Money-safety invariants (the whole point)

- Bet acceptance is server-enforced on `now < betCloseAt`, re-checked inside
  the placement transaction. A bet after close is rejected server-side, never
  merely hidden.
- The draw is a cryptographic function of a seed committed (by hash) before the
  draw and revealed after; it is generated once via a guarded `updateMany` and
  is not admin-selectable.
- Every wallet move goes through the existing ledger path (`wallet.update` +
  `Transaction` with `scope: 'casino'`); turnover and cashback are fed exactly
  like the other native games.
- Settlement is idempotent end to end via the `@@unique([mode, epochIndex])`
  round key and the per-bet `status: 'PENDING'` guarded update: re-running is a
  no-op, and no bet is ever paid twice nor any stake debited twice.
- The game ships DISABLED (`isActive: false`, all modes false); every
  `/api/games/wingo*` route returns a disabled state until an admin turns it on.

## Out of scope for this design

Live chat, social feed, provider-side integration, and any change to the
existing native-games session engine. WinGo is self-contained in `lib/wingo`,
two new models, and its own routes, reusing the money, gating, fairness, and UI
primitives listed above.
