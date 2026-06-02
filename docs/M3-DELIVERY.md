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

## DOM mutation guard for browser extensions (M3 Phase 3K)

`Cannot read properties of null (reading 'removeChild')` kept
re-surfacing after the notranslate + pages-router scaffolding
fixes because Chrome's translation engine (and other DOM-mutating
extensions like content blockers) ignore the `notranslate` hint
when the user clicks the toolbar Translate icon manually. Once
they reparent a text node inside a React-owned tree, React's
reconciler later calls `parent.removeChild(child)` with the wrong
parent and throws.

Fix: patch `Node.prototype.removeChild` and
`Node.prototype.insertBefore` defensively, BEFORE React loads.

`apps/web/app/layout.tsx` injects an inline `<script>` as the
first child of `<head>`. The script:

1. Runs synchronously before any other JS.
2. Sets `window.__PASHA9_DOM_GUARD_INSTALLED__` to guard against
   double-install.
3. Replaces `Node.prototype.removeChild`: if
   `child.parentNode === this`, defers to the original. Otherwise
   returns `child` without throwing so React's reconciliation
   can continue.
4. Replaces `Node.prototype.insertBefore`: if
   `referenceNode == null || referenceNode.parentNode === this`,
   defers to the original. Otherwise falls back to
   `appendChild(newNode)` so the new node still ends up in the
   tree.
5. In development only (`process.env.NODE_ENV !== 'production'`),
   `console.warn` once per type when the guard suppresses a
   mismatch. Production stays silent.

What this does NOT do:

- It does not swallow unrelated errors. Any call with valid inputs
  goes through the original method untouched.
- It does not interfere with React's own DOM operations when the
  tree is consistent.
- It does not patch `replaceChild` or `appendChild` because those
  have not surfaced as production crashes.

Known and proven workaround used across many React apps to
coexist with Google Translate, content blockers, and DOM-mutating
extensions in general.

## Production runtime scaffolding (M3 Phase 3J)

PM2 logs surfaced the upstream cause of every "Application error"
on the platform:

```
Cannot find module '/var/www/pasha9/app/apps/web/.next/server/pages/_error.js'
  at Module._resolveFilename ...
  at Object.requirePage (next/dist/server/require.js)
```

Pasha 9 is app-router only and never declared a `pages/`
directory. Next.js 14's server runtime requires
`.next/server/pages/_error.js` as the pages-router error fallback
even in app-router-only deployments. When that file is missing,
EVERY rendering error (real or hydration) crashes the framework's
error rendering path BEFORE app-router boundaries
(`app/global-error.tsx`, route-scoped `error.tsx`) can mount. The
browser sees a stack-trace surface formatted as
`Cannot read properties of null (reading 'X')` because the
framework's own error-rendering code threw on a null Map lookup
while trying to load the missing module.

Fix:

- `apps/web/pages/_error.tsx` . minimal styled fallback. Defines
  `getInitialProps` so the build emits a real component, not a
  stub. The build now produces `.next/server/pages/_error.js`.
- `apps/web/pages/404.tsx` and `apps/web/pages/500.tsx` for the
  matching pages-router static fallbacks (the build emits
  `.next/server/pages/404.html` + `500.html`).
- `apps/web/scripts/verify-build.mjs` . post-build smoke check
  that fails the build if any of those files are missing. Wired
  into `apps/web/package.json` as
  `build: next build && node scripts/verify-build.mjs`. The
  previous behaviour stays available as `build:noverify`.

Real errors still surface through `app/global-error.tsx` and the
route-scoped `error.tsx` files. The pages-router scaffolding is
pure runtime contract.

Cleanup mop-up for stricter null types after the pages directory
was added:

- `apps/web/components/site/CategoryNav.tsx`,
  `apps/web/components/site/Sidebar.tsx`,
  `apps/web/components/site/StickyBottomNav.tsx`,
  `apps/web/components/site/MobileDrawer.tsx` . `usePathname()`
  result is now coerced via `?? ''` before `.startsWith / .endsWith`.
- `apps/web/app/(site)/games/[category]/page.tsx` . `useParams<...>`
  result is read via `params?.category ?? ''`.

Hydration warning suppression on `<html>` and `<body>` so any
late-arriving locale class / theme bootstrap script does not
trigger React's hydration overlay (which has caused first-load
flicker since the theme-bootstrap script landed).

### Clean deploy contract

```
cd /var/www/pasha9/app
git fetch origin
git reset --hard <commit>
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a
pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm exec prisma db push --schema packages/database/prisma/schema.prisma
rm -rf apps/web/.next                   # purge any partial output
pnpm check:branding
pnpm --filter @pasha9/web build         # verify-build.mjs runs at the end
test -f apps/web/.next/server/pages/_error.js  # explicit gate
pm2 delete pasha9-web                   # avoid loading the previous server module graph
pm2 start ecosystem.config.cjs --name pasha9-web --update-env
pm2 save
```

If `pm2 delete` is not desired in the workflow, at minimum run
`pm2 restart pasha9-web --update-env` after a successful
`verify-build`.

## Browser-translation safety + null .get() (M3 Phase 3I)

Production reproduced two distinct errors after commit `028f738`:

- `/admin` . `Cannot read properties of null (reading 'get')`
- `/admin/transactions` . `Cannot read properties of null (reading 'removeChild')`

Both have the same root cause: Google Chrome's translate engine
was active and replaced text nodes inside React-owned trees. React
expects the exact text node it created when later updating or
unmounting. After translation:

- The reconciler tries `parent.removeChild(child)` and the new
  parent is null because the child has been moved or wrapped by
  Translate. -> `removeChild` error.
- Radix internals (Dropdown, Tooltip, Modal portals) keep a Map of
  rendered elements. After Translate mutates a DOM node, the next
  Map.get returns null and the code calls `.get(...)` on it. ->
  `'get'` error.

The fix is to opt the entire app out of browser translation. Pasha
9 ships its own EN/BN dictionaries, so the only thing external
translation could do is break things.

Three places now declare opt-out:

- `apps/web/app/layout.tsx` . `<html translate="no" class="notranslate">`,
  `<meta name="google" content="notranslate">` in `<head>`, and
  `<body translate="no" class="notranslate">`. Metadata also sets
  `other: { google: 'notranslate' }`.
- `apps/web/app/(admin)/admin/layout.tsx` . `notranslate
  translate="no"` on the admin shell wrapper AND on the login-only
  branch.

A secondary nullable that surfaced in tests was
`useSearchParams()` returning null during the brief window before
client hydration finishes. We patched every call site to use
optional chaining:

- `apps/web/app/(admin)/admin/login/page.tsx` . exports
  `dynamic = 'force-dynamic'` AND uses `params?.get(...)`.
- `apps/web/components/site/AuthModal.tsx` . `params?.get(...)`.
- `apps/web/components/site/Header.tsx` . same in the deps array
  and useEffect.
- `apps/web/app/(site)/games/provider/return/page.tsx` . same.

### Acceptance checklist

- [ ] Fresh incognito Chrome with Translate available: open
      `https://pasha9.com/admin`. No "Cannot read properties of
      null" overlay. Either renders the login form (if
      unauthenticated) or the dashboard.
- [ ] Same browser, click Chrome's Translate icon. The page does
      not translate (`notranslate` opt-out honoured) and React
      does not throw.
- [ ] `/admin/transactions`, `/admin/withdrawal-limits`, `/admin`
      all open directly without first-load crash.
- [ ] Toggling the in-app EN/BN switch still works (the dictionary
      is internal; the `notranslate` only blocks BROWSER
      translation engines).
- [ ] `/games/provider` JILI launch flow still works end-to-end.
- [ ] Logs tab `Reprocess` and `Manual repair` actions still work
      on /admin/providers/[id].

## Stability sprint (M3 Phase 3H)

Three production safety nets after the type-aware idempotency and
encrypted-payload fixes.

### Stale-chunk auto-reload

The "application error on first load, works after refresh" pattern
was an nginx/CDN cache vs new-build mismatch: the HTML referenced
chunk hashes from the previous build, the browser fetched the old
chunks, and the root client raised before any route-level boundary
mounted.

Fixes:

- `apps/web/next.config.mjs` ships explicit `Cache-Control`:
  `_next/static/*` is `public, max-age=31536000, immutable` so the
  browser caches forever (paths are hashed). Every HTML response
  is `no-store, must-revalidate` so the page itself is never
  cached.
- `apps/web/app/global-error.tsx` is a root boundary that detects
  `ChunkLoadError` (and the matching message patterns) and forces
  one `window.location.reload()` with a 30s cooldown stored in
  `sessionStorage` to prevent reload loops if the new chunks are
  also broken.

### Defensive format helpers

`apps/web/lib/utils/format.ts` was a documented crash source on the
admin transaction log: `Intl.DateTimeFormat.format(InvalidDate)`
throws `RangeError`. Every helper now:

- Coerces non-finite numbers to `0` instead of `NaN`.
- Returns `-` on invalid dates instead of throwing.
- Wraps `Intl.*` in try/catch so any future locale issue cannot
  crash the page.

Helpers affected: `formatBDT`, `formatNumber`, `formatDate`,
`formatDateTime`, `relativeTime`.

### Legacy masked-payload detection + Manual repair

Old callback logs saved before commit `50a0cee` had their
encrypted `payload` field masked at write time. We cannot decrypt
those rows. The Reprocess endpoint detects this:

- If the stored `body.payload` contains the bullet character or is
  not valid base64 → `409 LEGACY_MASKED_PAYLOAD` with the message
  "This old callback cannot be reprocessed because its encrypted
  payload was stored in masked form before the parser fix landed."

The LogsPanel catches that code and offers **Manual repair**
instead:

- New POST `/api/admin/providers/[id]/callback-logs/[logId]/manual-repair`
- Body: `{ userQuery, gameRound?, gameUid?, betAmount, winAmount, reason }`
- Resolves the user by id / username / phone / email.
- Applies `delta = win - bet` to the wallet inside `db.$transaction`,
  writes a `Transaction(type='adjust')`, stamps the original
  ProviderCallbackLog with `response._manualRepair` so a second
  attempt returns `409 ALREADY_REPAIRED`.
- Activity log: `PROVIDER_CALLBACK_MANUAL_REPAIR`.

The Logs tab now shows two action buttons per rejected callback
row:

- **Reprocess**. runs the new parser. Works for any row whose
  encrypted payload survived (any new row, post-fix).
- **Manual repair**. opens the modal for the legacy-masked case,
  prefilled from the row context. Same flow if the operator
  prefers a manual correction for any reason.

### Encrypted callback simulator (admin verify tool)

POST `/api/admin/providers/[id]/simulate-encrypted-callback`
(super_admin) builds the exact `{ payload: AES-256-ECB(JSON), timestamp }`
shape that iGamingAPIs sends and pushes it through the live
`parseCallback` + `processProviderCallback`. Logs the rehearsal in
ProviderCallbackLog with an `_simulated: 'encrypted'` marker and
records `PROVIDER_CALLBACK_ENCRYPTED_SIM` in the activity log.

Use this to verify end-to-end before relying on live JILI traffic:

```
curl -X POST https://pasha9.com/api/admin/providers/<id>/simulate-encrypted-callback \
  -H 'cookie: ...' \
  -H 'content-type: application/json' \
  -d '{"gameUid":"10035","betAmount":10,"winAmount":0}'
```

## Encrypted callback payload + reprocess tool (M3 Phase 3G)

**Symptom.** Production callbacks reached the server, security gates
passed (`callbackKeyValid: true`, `ipValid: true`), but every row
rejected with `CALLBACK_INVALID: member_account is required`.

**Root cause.** iGamingAPIs sends the real callback body
**AES-256-ECB encrypted** in a `payload` field at the top level:

```json
{ "payload": "<base64 ciphertext>", "timestamp": 1780391038793 }
```

The old parser tried to read `member_account` from the WRAPPER body
(which only has `payload` and `timestamp`) and never decrypted the
inner blob. Zero accepted transactions because every callback failed
at parse time.

**Fix.**

1. Adapter `parseCallback` detects `body.payload` (string, length ≥ 16),
   base64-decodes it, AES-256-ECB-decrypts with `creds.apiSecret`,
   parses the resulting JSON, and unwraps one level of common
   wrappers (`data / payload / result / message`).
2. Alias-driven extraction. Each logical field tries multiple names:
   - **member**: `member_account, memberAccount, user_id, userId,
     user, player_id, playerId, account, username`
   - **game**: `game_uid, game_id, gameUid, gameId`
   - **round**: `game_round, gameRound, round_id, roundId,
     transaction_id, transactionId, bet_id, betId`
   - **bet**: `bet_amount, betAmount, bet, amount`
   - **win**: `win_amount, winAmount, win, payout`
   - **timestamp**: `timestamp, time, created_at, createdAt,
     round_time, roundTime` (wrapper timestamp is a fallback).
3. Callback route now accepts both `application/json` and
   `application/x-www-form-urlencoded` body content types.
4. Improved errors carry the actually-seen top-level keys:
   `CALLBACK_INVALID: account field missing. Seen keys: payload,timestamp`.
5. `lib/providers/mask.ts` now preserves the `payload` field
   verbatim at storage time. Plaintext is still protected behind the
   AEAD-encrypted apiSecret; storing the ciphertext is what makes
   the reprocess tool actually work.

**Diagnostics on every callback log row.**
`response._diagnostics` now carries:

- `encryptedPayloadDetected` (true if a payload blob was decrypted)
- `seenKeys` (top-level keys after unwrap)
- `parsedMemberAccount / parsedGameRound / parsedGameUid /
  parsedBetAmount / parsedWinAmount / derivedType`
- `status / errorCode / userId / walletBefore / walletAfter / netResult`

The Logs tab callback table renders an inline diagnostics row under
each parent row when any of these are present. Rejected rows get a
**Reprocess** button.

### Reprocess workflow

POST `/api/admin/providers/[id]/callback-logs/[logId]/reprocess`
with `{ reason }`. Super-admin only.

- Loads the saved ProviderCallbackLog row (with the verbatim
  encrypted `payload` field).
- Re-runs adapter.parseCallback + processProviderCallback exactly
  as a fresh inbound hit would.
- Idempotency comes from the wallet pipeline: the new
  `(providerKey, gameRound, type)` key. If the same round was
  already settled (or already reprocessed once), the second attempt
  short-circuits as `duplicate` and the wallet stays put.
- Writes a NEW ProviderCallbackLog row tagged with the replay
  outcome (`response._reprocess.originalLogId`). The original row
  is left intact.
- Activity log: `PROVIDER_CALLBACK_REPROCESS`.

Operator flow for the current client incident:

1. Pull the new build + run `pnpm exec prisma db push` (no schema
   change in this commit, but earlier commits still need it).
2. `/admin/providers/<id>` -> Logs tab -> Callbacks.
3. Each previously-rejected row now shows a Reprocess button.
4. Click Reprocess on the winning round → wallet is credited inside
   `db.$transaction`. A toast confirms `accepted` or `duplicate`
   with the wallet before/after.

### Diagnostics tile rewrite

Setup tab Callback diagnostics card now distinguishes:

- **No callbacks at all**: launches > 0 AND callbacks == 0 →
  provider portal misconfigured.
- **Callbacks rejected at parse**: callbacks > 0 AND accepted == 0 →
  payload format mismatch. Points the operator at the Logs tab.

### /admin/transactions safety net

Added `apps/web/app/(admin)/admin/transactions/error.tsx` to catch
any uncaught render error on the platform transaction log. Renders
a recovery card with digest instead of the blank crash overlay.

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

