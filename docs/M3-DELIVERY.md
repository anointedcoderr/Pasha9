# M3 delivery summary

Pasha 9 Milestone 3 covered the external provider integration layer
plus the launch-readiness work needed to take the platform live.

This document is the engineer/operator handover record. Use it
alongside `PROVIDER-SETUP.md` and `LAUNCH-CHECKLIST.md`.

Built by Anointed Coder.

## JILI integration summary

- Provider: **iGamingAPIs / SoftAPI** (adapter key `igamingapis`).
- Brand: **JILI** (only brand we have credentials for today).
- Launch contract: `GET <apiBase>?payload=<AES-256-ECB(JSON)>&token=<API_TOKEN>`.
- Callback contract: `POST /api/providers/igamingapis/callback?key=<callbackSecret>`
  with body `{ game_id, game_round, member_account, bet_amount, win_amount, timestamp }`.
- Response we send back: `{ credit_amount, timestamp }` where
  `credit_amount` honours the operator-picked `callbackResponseMode`
  (`updated_balance` or `net_loss_amount`).
- Encryption: AES-256-ECB, base64, PKCS7 padding, secret length 32
  bytes after decoding (`secretEncoding` may be `utf8` / `hex` /
  `base64`).
- Timestamp: `Date.now()` in **milliseconds**, generated fresh
  inside `adapter.launch` each call. Optional drift offset via
  `GameProvider.launchTimestampOffsetMs`.
- Player account on the wire: numeric `member_account` allocated
  from `ProviderPlayerAccount` (10-digit). Internal cuid never
  leaves the server.
- Public base URL: per-provider override `GameProvider.publicBaseUrl`,
  then `process.env.PUBLIC_SITE_URL`, then the incoming request
  origin. Public launch refuses non-HTTPS / private hosts.

## Catalog import result

- Importer: `pnpm --filter @pasha9/database import:jili [csvPath]`.
- Default path: `packages/database/seed-data/jili_games_import_ready.csv`.
- Idempotent on `(providerId, gameUid)`. Non-numeric `gameUid`
  rows are skipped with a per-row reason; first run on the bundled
  CSV reports 241 inserted, 1 skipped (TeenPatti, no numeric id in
  source CDN URL). Re-running flips to 0 inserted, 241 updated.
- Category is normalized via `lib/providers/category.ts` into
  `slots / flash / table / fishing / crash`.
- Brand row `JILI` is upserted as `active`.
- Provider status is NEVER changed by the importer.

## Admin provider controls

`/admin/providers/[id]` exposes everything an operator needs:

- **Setup** tab: credentials (API token, API secret, callback
  secret), API base, callback path, IP whitelist, clock skew,
  currency, language, callback response mode, launch mode, public
  base URL, launch timestamp offset, **launch minimum balance**,
  status toggle (Live / Maintenance). Test encryption + Test
  connection buttons. Callback readiness panel with the resolved
  callback / return URLs (with Copy buttons) and a 7-line health
  checklist plus the Simulate callback launcher.
- **Brands** tab: synced brands, manual brand add (used when the
  upstream catalog is gated).
- **Games** tab: stats tiles, category pills, search (debounced),
  brand / category / status filters, per-row checkbox + sticky
  bulk-status toolbar (active / maintenance / hidden), Test launch
  per row, Add Manual Game (single + bulk CSV/JSON).
- **Logs** tab: outbound request + inbound callback logs. Secrets
  masked at write time.
- **Transactions** tab: provider ledger with GGR aggregate and a
  super-admin **Rollback** action per accepted row.
- **Reports** tab (NEW): date-range totals, by-status counts, daily
  series, top games, top users, by-category summary, **Export CSV**.

## Callback / wallet flow

`/api/providers/<providerKey>/callback?key=<callbackSecret>`:
1. Provider exists + active.
2. `?key=` matches `callbackSecret` (timing-safe).
3. Source IP is on the whitelist (when configured).
4. `adapter.parseCallback` normalises the body.
5. Member-account map (`ProviderPlayerAccount`) resolves the
   internal `User.id`. **Unmapped accounts are rejected with
   `MEMBER_ACCOUNT_NOT_FOUND` and the wallet is never touched.**
6. `processProviderCallback` runs inside `db.$transaction`:
   - idempotency check on `${providerKey}:${gameRound}`,
   - balance check,
   - `Wallet.balance` decrement/increment,
   - `Transaction(bet|win)` row,
   - `ProviderTransaction` row.
7. After commit, fail-safe `addTurnover({ kind: 'provider_game' })`
   runs outside the wallet transaction. A misbehaving bonus engine
   cannot roll back a settled provider bet.
8. Adapter builds the response envelope.
9. Every hit is logged to `ProviderCallbackLog`, masked, valid or not.

## Security model

- API token, API secret and callback secret are AEAD-encrypted
  (AES-256-GCM) at rest via `lib/crypto/aead.ts` with `SECRETS_KEY`
  from env.
- Secrets never appear in any response body. Logs go through
  `maskPayload` first.
- Public launch returns only `{ launchUrl, mode }`. The encrypted
  payload + token + secret stay server-side.
- Internal `User.id` (cuid) is never sent upstream; `member_account`
  is a numeric 10-digit string.
- Callback `?key=` is compared with a constant-time equality.
- IP whitelist is exact-match today; CIDR can layer on later.
- Timestamp drift over 5000ms is a local hard reject; the upstream
  call is never made with a suspect clock.
- Rollback (Task 4) is **super-admin only** and reverses wallet only;
  we do NOT call the provider's rollback API (unconfirmed).

## Provider-dependent systems (status at delivery)

This is the honest split. **Live** means a real connection is
verified end-to-end. **Provider-ready** means the structure and
admin surface exist; only operator credentials are missing.

- **iGamingAPIs / JILI** . **Live and tested.** Encryption, launch
  payload, callback wallet flow, 241 imported games, simulate
  callback, rollback and reports all verified. Visible in
  `/admin/integrations` -> Launch readiness as "Live" once the
  provider chip is flipped Live.
- **Real payment gateway** . **Provider-ready.** Adapter registry
  (`lib/payments/registry.ts`) lists every shape; each tile in
  `/admin/integrations` -> Inbound payments shows
  "Awaiting credentials" until merchant credentials are stored
  on the corresponding `/admin/payments` editor.
- **Real payout provider** . **Provider-ready.** Same pattern as
  payments via `lib/payouts/registry.ts`; surfaced under Outbound
  payouts.
- **SMS / OTP** . **Provider-ready.** Adapter registry
  (`lib/sms/registry.ts`) shows every supported provider. The
  active key is `manual` until an admin picks an adapter AND
  stores its credentials in `/admin/notifications`.
- **WhatsApp API** . **Provider-ready** (structure only). No
  WhatsApp adapter is wired today; the Launch Readiness tile
  reports "Configured" only when a `whatsapp_*` SystemSetting row
  exists.
- **Facebook / TikTok / GA4 / Google Ads tracking** .
  **Provider-ready.** Browser pixels + server-side CAPI / Events
  API plumbing exists; each platform tile flips to "Live" only
  when its real pixel id + token are saved in
  `/admin/notifications`.
- **APK** . **Build guide ready** (`docs/APK-BUILD.md`). No
  signed APK has been generated yet; build runs on a developer
  laptop with Android SDK + JDK 17.

## Remaining provider-dependent limitations

- **PG Soft, Pragmatic, Evolution etc.** are not connected. Each
  requires its own commercial credentials + a `lib/providers/adapters/<key>.ts`
  adapter following the same `ProviderAdapter` interface. See
  `PROVIDER-ROADMAP.md`.
- The iGamingAPIs **rollback API** is unconfirmed. Our rollback
  corrects the wallet on our side only; if the provider also marks
  the round void, the operator must handle that on the upstream
  panel.
- IP whitelist on the iGamingAPIs portal is self-service. Confirm
  every VPS IP (including any new ones added during a deploy
  rotation) is whitelisted.

## Production testing checklist

See `LAUNCH-CHECKLIST.md`.

## Requested admin controls (status table)

Every item the client asked for, with its live state and the exact
admin location. Anything marked Provider-ready / Awaiting credentials
is structure only and depends on the operator pasting real values.

| Requested control | Status | Admin location | Notes |
| --- | --- | --- | --- |
| Game providers | Live (JILI) | /admin/providers . /admin/providers/[id] | Add / edit / enable / disable; AES-256-GCM at rest. |
| Game catalog import + manual add | Live | /admin/providers/[id] -> Games tab | Bulk CSV via `pnpm import:jili`, manual add, bulk JSON. |
| Game edit (name, category, image, status, brand) | Live | /admin/providers/[id] -> Games tab -> Edit | PATCH /api/admin/providers/[id]/games/[gameId]; category normalized. |
| Bulk game status (active / maintenance / hidden) | Live | /admin/providers/[id] -> Games tab -> bulk toolbar | PATCH /games/bulk-status. |
| Game categories | Live | Edit modal -> Category select | Five canonical buckets: slots / flash / table / fishing / crash. |
| Game images | Live | Edit modal -> Image URL | Fallback art when image fails. |
| Banners + homepage content | Live | /admin/banners . /admin/homepage . /admin/popups . /admin/promo-text . /admin/ambassador | M1 admin pages; bilingual fields. |
| Website settings | Live | /admin/settings . /admin/website | Site name, support email/phone, currency, language, etc. |
| Payment gateway credentials | Provider-ready | /admin/payments | Adapter registry; tile reads Awaiting credentials until real merchant credentials saved. |
| Payout provider credentials | Provider-ready | /admin/payouts | Same pattern as payments. |
| SMS / OTP credentials | Provider-ready | /admin/notifications -> SMS tab | Active key `manual` until an adapter is picked. |
| WhatsApp API credentials | Configured (when set) | /admin/whatsapp | NEW page; AES-256-GCM secrets; tile reads Configured, never Live. |
| Facebook Pixel ID + CAPI token | Live (when set) | /admin/notifications -> Tracking tab (also via sidebar "Tracking") | Public ID renders client-side; CAPI token server-only. |
| GA4 Measurement ID + API secret | Live (when set) | /admin/notifications -> Tracking tab | Measurement ID renders client-side; API secret server-only. |
| Google Tag Manager (GTM-XXXX) | Live (when set) | /admin/notifications -> Tracking tab | gtm.js injected on every page when ID is configured. |
| TikTok Pixel ID + Events API token | Live (when set) | /admin/notifications -> Tracking tab | Public ID client-side; access token server-only. |
| Google Ads Conversion ID + label | Live (when set) | /admin/notifications -> Tracking tab | Both IDs are public; render via gtag config. |
| Enable / disable third-party integrations | Live | /admin/integrations -> Launch Readiness panel + per-page toggles | Status chips computed live from real signals. |
| Affiliate verification | Live | /admin/affiliate . /admin/affiliate/tiers | Approve, reject, suspend; commission tiers CRUD. |
| Lotto verification | Live | /admin/lotto | Draws + ticket settings; M1 admin page. |
| Reports verification | Live | /admin/reports + /admin/providers/[id] -> Reports + /admin/native-games -> Rounds | CSV export on provider reports. |
| Provider transaction rollback | Live (super_admin only) | /admin/providers/[id] -> Transactions -> Rollback | Idempotent; ALREADY_ROLLED_BACK on retry. |
| Launch readiness panel | Live | /admin/integrations top of page | Tile state computed from snapshot; nothing hardcoded. |
| PWA install | Live | /manifest.webmanifest | Add to Home Screen works today; signed APK is operator-side. |
| Signed Android APK | Not generated | n/a | docs/APK-BUILD.md is the recipe; needs Android SDK + JDK 17 on a developer laptop / CI. |

## Final M3 admin additions (delivered in the final sprint)

- **Tracking pixels.** Google Tag Manager (`analytics_gtm`) joined
  Facebook Pixel, TikTok Pixel, GA4 and Google Ads. All public IDs
  render via `components/site/TrackingScripts.tsx`; server-side
  tokens stay encrypted at rest and never leave the server.
- **WhatsApp admin** (`/admin/whatsapp`). Structured fields for
  Meta Cloud API / gateway / manual modes. Access token + verify
  token are AES-256-GCM at rest. Tile honestly reads "Configured"
  until a real adapter ships.
- **Game edit.** Per-row Edit button in the admin Games tab edits
  displayName, category, imageUrl, status and brand on a single
  ExternalGame row. Category is normalized; activity logged as
  PROVIDER_GAME_EDIT.
- **PWA manifest.** `/manifest.webmanifest` ships with the build
  pointing at `apps/web/public/app-assets/`. Players can Add to
  Home Screen before any signed APK exists.
- **docs/ADMIN-GUIDE.md** expanded with an M3 section covering
  every new admin surface.

## Handover checklist

- [ ] Operator has `/admin/providers` access (super_admin role).
- [ ] `SECRETS_KEY`, `DATABASE_URL`, `PUBLIC_SITE_URL` set in prod `.env`.
- [ ] iGamingAPIs API token + secret stored via Setup (never in env).
- [ ] `publicBaseUrl` set to `https://pasha9.com`.
- [ ] `launchMinBalance` set (default 0 = disabled; recommended 1 BDT).
- [ ] Callback URL + return URL copied to the iGamingAPIs portal.
- [ ] VPS IP whitelisted on the iGamingAPIs portal.
- [ ] `timedatectl status` shows NTP active.
- [ ] `pm2 list` shows `pasha9-web` Online.
- [ ] HTTPS valid on `pasha9.com`.
- [ ] Backups for Postgres scheduled.
- [ ] One real player launch tested end-to-end.
- [ ] One callback received and accepted (visible in Logs tab).
- [ ] Duplicate callback verified (status: duplicate in Logs).
- [ ] Reports tab returns non-zero numbers for the test period.

## Client-side crash safety nets (M3 Phase 3F)

Two route-level error boundaries protect the admin shell:

- `apps/web/app/(admin)/admin/error.tsx` catches any uncaught render
  error anywhere under `/admin/*` and shows a recovery card with the
  digest copy-pasteable for triage.
- `apps/web/app/(admin)/admin/providers/[id]/error.tsx` is the
  closer-scoped boundary for the provider detail page (Setup,
  Brands, Games, Logs, Transactions, Reports). It wins over the
  admin-level boundary when the failure is on this page.

`fmt`, `safeNumber`, `safeDate` helpers replace every `.toString()`
and `new Date(x).toLocaleString()` in the provider Transactions,
Logs and Reports panels so a missing column or a partial API
payload renders `-` instead of crashing the table.

If the operator forgot to run `prisma db push` after deploying the
new ProviderTransaction columns, the API would return 500 for any
query that mentions those columns. The defensive panels still
render an empty state; the error boundary captures the failure if
something deeper raises. **Always run `prisma db push` on the
deploy host after pulling a new commit.**

## Provider callback troubleshooting

### Symptom: real winning round did not credit the player wallet

**Root cause (fixed in M3 Phase 3E).** The earlier idempotency key
was `${providerKey}:${gameRound}`. iGamingAPIs sometimes sends a
BET callback and a separate WIN callback for the same `game_round`.
The second callback hit the existing ProviderTransaction row with
the same key, short-circuited as `duplicate`, and the wallet was
never credited. Real player wins were silently lost.

**Fix.**
- Idempotency key is now `${providerKey}:${gameRound}:${type}` where
  type is one of `bet / win / settle / rollback` derived from the
  amounts by the adapter.
- BET callback and WIN callback for the same round now produce
  different keys, so both go through.
- Duplicate same-type replays still collide on the same key and are
  rejected as duplicate (correct).
- Double-debit guard: when a SETTLE or WIN callback arrives AFTER an
  accepted BET (or SETTLE) for the same gameRound, the wallet
  pipeline applies only the win portion of the new callback and
  treats the repeated bet as already-debited.
- `ProviderTransaction.walletBefore` / `walletAfter` are now captured
  inside the same `db.$transaction` so the admin can audit a round
  without re-deriving wallet state from `Transaction` rows.

### Inspecting a failed round

1. `/admin/providers/<id>` -> Logs tab -> Callbacks. Filter by the
   `member_account` or scroll to the time the player reported. The
   raw masked body is on every row.
2. `/admin/providers/<id>` -> Transactions tab. Find the row by
   `gameRound`. New columns surface walletBefore / walletAfter.
   Status chip shows `accepted / duplicate / rejected / rolled_back`,
   plus a `repaired` chip if a credit-missing repair was applied.
3. If the win was duplicate-blocked under the old idempotency scheme
   (any row with status `duplicate` AND `winAmount > 0`), the
   Transactions tab shows a **Credit missing win** action on that
   row.

### Repair tool (super_admin only)

POST `/api/admin/providers/[id]/transactions/[txId]/credit-missing`
with `{ amount, reason }`. Admin UI: Transactions tab -> per-row
**Repair** (on accepted rows with a positive win that need a
correction) or **Credit missing win** (on duplicate rows that
carry a positive win and never moved the wallet).

- Writes ONE `Transaction(type='adjust')` row crediting the wallet.
- Marks the ProviderTransaction with `repairedAt`, `repairedBy`,
  `repairReason`, `repairAmount`, `repairTransactionId`.
- Refuses a second repair on the same row with `409 ALREADY_REPAIRED`.
- Refuses if the row was already rolled back (`409 ALREADY_ROLLED_BACK`).
- Activity log: `PROVIDER_TX_REPAIR_CREDIT`.
- We do NOT call the provider. This is wallet correction inside
  Pasha 9 only.

### Callback diagnostics card

Setup tab now opens with a Callback diagnostics panel:

- **Last launch / Last callback / Last accepted tx / Last accepted round**:
  the four timestamps an operator needs to see at a glance whether
  the wallet pipeline is moving.
- **Last 24h counters**: launches, callbacks, accepted, duplicates,
  rejected.
- **Rose warning headline**: if the platform sent any launch in the
  last 24h but received zero callbacks, the panel surfaces a clear
  alert pointing at the three likely causes (wrong callback URL in
  provider portal, IP whitelist missing the VPS public IPs, or the
  callback key in the portal does not match what is saved here).

### Manual test matrix

Run these against `/admin/providers/<id>` -> Setup -> Simulate
callback (or via curl to the public callback URL) to confirm the new
pipeline.

| # | Setup | Callback | Expected wallet behaviour |
| --- | --- | --- | --- |
| 1 | Funded user, balance 100 | bet=10 win=0 | -10 . status accepted |
| 2 | Same | (replay #1, same gameRound) | unchanged . status duplicate |
| 3 | Funded user, fresh gameRound | bet=0 win=20 | +20 . status accepted |
| 4 | Funded user, fresh gameRound | bet=10 win=20 (combined settle) | -10 +20 . status accepted, type settle |
| 5 | Funded user, fresh gameRound | bet=10 then later bet=0 win=20 (two separate callbacks) | first -10 (accepted, bet), second +20 (accepted, win). Wallet net +10 |
| 6 | Funded user, fresh gameRound | bet=10, then settle bet=10 win=20 for same round | first -10 (bet), second +20 (settle, bet portion skipped). Wallet net +10 |
| 7 | Funded user, balance 5 | bet=10 win=0 | rejected, errorCode INSUFFICIENT_FUNDS, wallet unchanged |
| 8 | Unmapped member_account | bet=10 win=0 | rejected, errorCode MEMBER_ACCOUNT_NOT_FOUND, wallet unchanged |
| 9 | Blocked user | bet=10 win=0 | rejected, errorCode USER_BLOCKED, wallet unchanged |
| 10 | Repair a duplicate-blocked old win | use the Credit missing win button | wallet +winAmount, status flags repaired, second click returns 409 |

## Known risks and maintenance notes

- **Token rotation.** Provider portal may rotate tokens. The
  operator can paste the new token into Setup -> API token. Empty
  field leaves the existing encrypted blob untouched.
- **Adapter behaviour.** The iGamingAPIs adapter detects HTML
  marketing-page responses on the catalog endpoints and surfaces a
  clear admin error rather than silently inserting zero rows.
- **No automated seed rotation.** Launch payload secrets are static
  per provider; rotate manually when needed.
- **Bonus turnover misuse.** `addTurnover` is fail-safe; if the
  bonus engine ever raises, the provider bet still settles and the
  error is logged.
- **Member account collisions.** 10-digit space with a unique
  constraint; collision retry caps at 8 attempts before throwing.
- **Game catalog drift.** Re-running the importer after the
  provider adds new titles is the supported path; the unique
  `(providerId, gameUid)` constraint keeps existing rows stable.

