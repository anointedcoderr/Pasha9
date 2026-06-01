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

