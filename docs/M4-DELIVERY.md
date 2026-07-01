# M4 Delivery + Handover

Single index for everything shipped in the M4 sprint plus the
multi-brand provider follow-ups. Phase docs in this directory
(M4-PHASE-A through G, M4-PROVIDER-IMPORT) carry the per-phase
detail; this doc is the operator-facing summary.

## Completed modules

| Module | Phase | Status | Notes |
|---|---|---|---|
| Schema foundation (PublicSection, DepositNotice, PromotionClaim, ReferralBalance, etc.) | A | shipped | additive, `prisma db push` safe |
| DB-driven homepage sections | B | shipped | PublicSection + HomepageFeaturedGame |
| Deposit notice + proof upload + Upay + bonus tiers + live preview + ledger | C | shipped | mandatory rejection reason |
| Promotion banners + claim flow + image validation + Terms + My Bonuses | D | shipped | guest claim routes to login |
| Referral real data + balance projection + claim + maturity cron + admin claims | E | shipped | backfill script idempotent |
| Lotto result history + My Tickets + My Winnings + claim mode + Babu88 settle | F | shipped | manual + auto claim |
| About + Sponsors + Public payment display + footer surfaces | G | shipped | DB-driven, no fake data when empty |
| Multi-brand iGamingAPIs catalog import (9 brands) | provider-import | shipped | Pragmatic Play Asia operator-supplied |
| Provider UI clarity (Aggregator rename, brand summary, public brand filter) | follow-up | shipped | one-time rename script |
| Native games (Dice + Mines + lobby + admin) | M2 | shipped | provably fair, verified |
| JILI / iGamingAPIs wallet + callback + transaction ledger + repair + rollback | M3 | shipped | 241 JILI rows imported |
| Tracking, WhatsApp, payment, payout, SMS, integrations admin surfaces | M3 | shipped | credential-dependent at runtime |

## Gates this delivery passes

- `pnpm exec prisma generate --schema packages/database/prisma/schema.prisma` clean
- `pnpm check:branding` clean (no banned refs, no em / long dashes, credits present)
- `pnpm --filter @pasha9/web typecheck` exits 0
- `pnpm --filter @pasha9/web build` exits 0 (49 admin routes + 30+ public routes + pages router scaffolding)

## Deploy commands (VPS)

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm exec prisma db push --schema packages/database/prisma/schema.prisma

# Idempotent. Picks up the new homepage_sportsbook PublicSection row.
pnpm --filter @pasha9/database seed

# One-time, idempotent. Renames the iGamingAPIs row from
# "iGamingAPIs JILI" to "iGamingAPIs Aggregator". No credential change.
pnpm --filter @pasha9/database rename:igamingapis-provider

# JILI catalog (re-run safe).
pnpm --filter @pasha9/database import:jili

# Multi-brand catalog. Default skips JILI to avoid duplicates.
# Drop pragmatic_play_asia.csv into seed-data/provider-games first
# if you have the operator-supplied export.
pnpm --filter @pasha9/database import:provider-games --dry-run
pnpm --filter @pasha9/database import:provider-games

# Recompute referral balance projections after any commission change.
pnpm --filter @pasha9/database referral:backfill

pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

## Cron setup

Three cron endpoints, each gated by `Authorization: Bearer $CRON_SECRET`.
Schedule from the VPS crontab (or any external scheduler that can send
a Bearer header). Replace `https://<host>` with the public origin.

```cron
# Lotto draw rollover - every minute. Idempotent: no-op when no draw is due.
* * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/lotto-rollover > /dev/null

# Referral hold maturity + ReferralBalance refresh - hourly.
17 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/referral-mature > /dev/null

# Account-recovery sweep - twice daily.
13 5,17 * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/recovery-sweep > /dev/null

# Cashback maturity - daily just after midnight UTC. Idempotent per UTC
# day via CashbackPayout.idempotencyKey, so weekly/monthly campaigns are
# safe under the same daily cron; only campaigns whose period matures pay.
5 0 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/cashback >> /var/log/cashback-cron.log 2>&1
```

`CRON_SECRET` MUST be set on the VPS env before any of these run. If
the env is empty the endpoint rejects every call as `UNAUTHENTICATED`.

## Provider import notes

- `packages/database/scripts/import-provider-games.ts` is the canonical
  multi-brand importer. CSV format documented in
  `packages/database/seed-data/provider-games/README.md`.
- `gameUid` is read from the CSV `Game ID` column when set, otherwise
  extracted from the Image URL. Rows with no recoverable id are skipped
  and reported. No fake ids are generated.
- Brand normalisation table in M4-PROVIDER-IMPORT.md section "Brand
  normalisation". Adding a new brand: add the override entry, drop the
  CSV in, re-run the importer.
- Idempotent. Re-running produces inserted=0, updated=N. Brand and game
  `status` are never overwritten on update.
- Default run skips JILI (the dedicated `import:jili` script owns it).
  Pass `--include-jili` only when re-importing a full export.
- `--dry-run` always recommended first on a new CSV.

## Provider limitations (handover-relevant)

1. **Pragmatic Play Asia CSV is operator-supplied**. ~624 rows. Drop
   the file at `packages/database/seed-data/provider-games/pragmatic_play_asia.csv`
   on the VPS before running the importer.
2. **Per-brand activation is upstream**. Each brand (PGSoft, JDB,
   Habanero, etc.) must be enabled on the iGamingAPIs account before
   `/launch` returns a URL. The platform sends the brand's `gameUid`
   to the same iGamingAPIs token / secret; whether the upstream
   provider accepts that brand is out of our control.
   - If a launch fails because the upstream has not enabled that brand,
     the admin `Test launch` modal surfaces the provider's verbatim
     error and the public `/games/provider` lobby returns a user-safe
     error string. Player is not charged.
3. **BTI Sports + 9Wickets ship one catalog row each** as
   sportsbook entry points. Deep linking to a specific event/market is
   not in scope.
4. **Rollback / cancel / refund semantics are not confirmed by
   iGamingAPIs**. The admin rollback endpoint writes a compensating
   `adjust` transaction; it does not call any upstream rollback API.
5. **Bonus turnover contribution is flat 100% per bet** across all
   brands. Per-brand game-weighted contribution is not implemented.
6. **`Game UID` types are strings** in our schema even when the
   provider exposes integers. The wallet pipeline already stores and
   matches them as strings via the `(providerId, gameUid)` unique key.

## Payment / payout / SMS / WhatsApp - credential-dependent at runtime

These admin surfaces exist and persist credentials AEAD-encrypted at
rest; runtime behaviour depends on the operator wiring the matching
account on the upstream service. Without real credentials the surface
saves cleanly but transactions stay in "Awaiting credentials".

| Surface | Admin route | Runtime needs |
|---|---|---|
| Payment providers | /admin/payments | Upay / SureCash / bKash / Nagad token + ipn key |
| Payout providers | /admin/payouts | Same as payments, write side |
| Payment methods (display) | /admin/payment-methods | none, internal labels |
| Public payment methods | /admin/public-payment-methods | none, footer display |
| Withdrawal limits | /admin/withdrawal-limits | none, internal policy |
| SMS providers | /admin/integrations -> SMS card | Twilio / SslWireless token + sender id |
| Tracking | /admin/tracking | analytics IDs (GA4 / GTM) |
| WhatsApp | /admin/whatsapp | provider gateway token + webhook key |

## APK build note

The Capacitor wrapper is documented in `docs/APK-BUILD.md`. It points
to a static `https://<host>` once the platform is live. APK build is
not part of M4; see that doc for the sync + Android Studio steps.

## Admin guide links

- `docs/admin-guide.md` operator handbook
- `docs/api-guide.md` API reference (M3 callback + M4 lotto + native games)
- `docs/PROVIDER-SETUP.md` step-by-step provider activation
- `docs/PROVIDER-ROADMAP.md` per-provider integration matrix
- `docs/deployment-guide.md` clean-room VPS deploy
- `docs/backup-guide.md` Postgres backup / restore
- `docs/LAUNCH-CHECKLIST.md` pre-go-live checklist
- `docs/handover-checklist.md` ownership transfer

## Final QA checklist

Run this top-to-bottom on the VPS after the deploy commands above.

### Gates (offline)

- [ ] `pnpm exec prisma generate` clean
- [ ] `pnpm check:branding` clean
- [ ] `pnpm --filter @pasha9/web typecheck` exits 0
- [ ] `pnpm --filter @pasha9/web build` exits 0

### Admin pages (every entry must load with no application error)

- [ ] /admin/overview (alias for /admin)
- [ ] /admin/deposits
- [ ] /admin/withdrawals
- [ ] /admin/transactions (Transaction Log)
- [ ] /admin/payments (Payment Providers)
- [ ] /admin/payouts (Payout Providers)
- [ ] /admin/payment-methods
- [ ] /admin/withdrawal-limits
- [ ] /admin/payments/reconciliation
- [ ] /admin/users (User Management)
- [ ] /admin/balance (Balance Management)
- [ ] /admin/referrals
- [ ] /admin/referral-claims
- [ ] /admin/bonuses (Bonus Rules)
- [ ] /admin/affiliate
- [ ] /admin/affiliate/tiers (Commission Tiers)
- [ ] /admin/website (Website Customization)
- [ ] /admin/banners (Banners and Sliders)
- [ ] /admin/popups
- [ ] /admin/promo-text
- [ ] /admin/homepage (Homepage Content)
- [ ] /admin/homepage-sections
- [ ] /admin/deposit-notice
- [ ] /admin/deposit-bonus-tiers
- [ ] /admin/lotto (Lotto Draws)
- [ ] /admin/rewards (Reward Catalog)
- [ ] /admin/native-games
- [ ] /admin/categories
- [ ] /admin/providers (Providers)
- [ ] /admin/reports (Reports and Analytics)
- [ ] /admin/marketing (Marketing Center)
- [ ] /admin/notifications
- [ ] /admin/tracking
- [ ] /admin/whatsapp
- [ ] /admin/brand-ambassadors
- [ ] /admin/sponsors
- [ ] /admin/public-payment-methods
- [ ] /admin/integrations
- [ ] /admin/settings
- [ ] /admin/security (Security Center)

### Public + dashboard pages (every entry mobile-safe at 320/375/430/tablet/desktop)

- [ ] /
- [ ] /games/provider (brand dropdown + provider dropdown)
- [ ] /promotions
- [ ] /referral
- [ ] /lotto
- [ ] /lotto/my-tickets
- [ ] /lotto/my-winnings
- [ ] /deposit
- [ ] /withdraw
- [ ] /wallet
- [ ] /transactions
- [ ] /dashboard
- [ ] /dashboard/wallet
- [ ] /dashboard/transactions
- [ ] /dashboard/bonus

### Provider QA

- [ ] /admin/providers card reads "iGamingAPIs Aggregator"
- [ ] Card shows Brands / Games / Active % tiles and brand-name pill strip
- [ ] /admin/providers/[id] Brands tab lists every brand with status,
      brandKey, active count, category breakdown
- [ ] "View games" on a brand jumps to Games tab with brand pre-selected
- [ ] Games tab brand dropdown matches the imported brand list
- [ ] /games/provider brand dropdown lists every brand with counts
- [ ] JILI test launch returns a launch URL
- [ ] PGSoft test launch - upstream-dependent. Document any failure.
- [ ] JDB test launch - upstream-dependent.
- [ ] Habanero test launch - upstream-dependent.
- [ ] Spribe test launch - upstream-dependent.
- [ ] Evolution Live test launch - upstream-dependent.
- [ ] Evolution Live Asia test launch - upstream-dependent.
- [ ] BTI Sports / 9Wickets test launch - upstream-dependent.

Per-brand launch failure protocol: capture the upstream error
verbatim into `/admin/providers/[id]` Logs tab. If the provider has
not activated that brand on this account, the admin sees the
verbatim provider error and the public lobby returns a user-safe
error. Player wallet stays intact.

### Callback + wallet (Game UID 10035, round `final-handover-provider-001`)

- [ ] Send bet 10 win 0 (via `/admin/providers/[id]/simulate-callback`)
- [ ] Send bet 0 win 20 on same round
- [ ] Two accepted rows in /admin/providers/[id] -> Transactions
- [ ] Wallet net +10 (bet -10, win +20)
- [ ] User-facing /transactions shows bet and win
- [ ] /admin/transactions shows bet and win
- [ ] Re-sending bet 10 win 0 returns the stored result, wallet unchanged

### Deposit

- [ ] /deposit opens
- [ ] Upay method visible if enabled
- [ ] Deposit notice text shown when enabled
- [ ] Proof upload accepts image, rejects PDF/other types
- [ ] Bonus preview reflects active deposit-bonus tier
- [ ] Admin approve -> wallet credits + deposit + bonus + lotto + referral txns visible
- [ ] Admin reject requires reason; reason visible on /transactions

### Promotion

- [ ] Guest claim opens login modal
- [ ] Logged-in claim succeeds once
- [ ] Second same-day claim returns ALREADY_CLAIMED
- [ ] Image upload rejects oversize / wrong type
- [ ] EN + BN terms render
- [ ] /dashboard/bonus lists granted bonus

### Referral

- [ ] /referral shows real data
- [ ] Invite link copies
- [ ] Empty state renders when no referees
- [ ] `pnpm --filter @pasha9/database referral:backfill` idempotent
- [ ] `curl ... /api/cron/referral-mature` with CRON_SECRET returns 200
- [ ] Same call without CRON_SECRET returns 401
- [ ] Zero-balance claim returns NOTHING_TO_CLAIM
- [ ] Positive-balance claim credits wallet or creates a pending claim
- [ ] /admin/referral-claims lists, approves and rejects

### Lotto

- [ ] /lotto result history filters by draw and date
- [ ] /lotto/my-tickets lists only the logged-in user's tickets
- [ ] /lotto/my-winnings lists only the logged-in user's winnings
- [ ] /admin/lotto save works
- [ ] /admin/lotto settle accepts first-prize + 1st/2nd/3rd consolation extras
- [ ] Diagnose returns expected match count
- [ ] Manual claim once, second claim blocked
- [ ] Auto-credit settle moves balance and writes Transaction

### Homepage + content

- [ ] Homepage section order matches PublicSection.position
- [ ] Hide a section in /admin/homepage-sections, refresh, it disappears
- [ ] Hot Games strip max 20 enforced on save
- [ ] Imported brand games appear in homepage_slots / homepage_live_casino / homepage_fishing
- [ ] homepage_sportsbook strip shows BTI + 9Wickets after import
- [ ] Ambassador, Sponsors, Public payment method footer rows hide when disabled
- [ ] No placeholder text when a section is empty

### Mobile

Test all of the above public + admin pages at 320, 375, 430, tablet
(768), desktop (1280) widths. Tap targets must be at least 44 px.

### Security (code-verified)

- [ ] Public `/api/providers` response contains no token, secret,
      callback secret or encrypted payload
- [ ] Public `/api/providers/[key]/launch` returns only `{ launchUrl, mode }`
- [ ] Public `/api/providers/[key]/callback` returns only the
      provider-shaped status code + msg
- [ ] Admin secret previews are masked (`....1234`) never the raw value
- [ ] `/api/cron/*` rejects requests without `Bearer $CRON_SECRET`
- [ ] `/api/lotto/me`, `/api/dashboard/*` scope to the authenticated user
- [ ] `/admin/*` routes return 401 for guest, 403 for users without permission

## Known limitations (final, transparent)

- Per-brand upstream activation is required for any brand other than
  JILI to actually launch. The platform does not control upstream
  brand enablement.
- Pragmatic Play Asia CSV is operator-supplied (not committed).
- Provider rollback is a compensating ledger entry, not an upstream
  rollback call.
- Bonus turnover counts every bet at 100%; per-brand contribution
  weighting is out of scope.
- Payment / payout / SMS / WhatsApp surfaces persist credentials but
  do not move money or send messages until real upstream credentials
  are entered.
- APK build is documented separately; not built as part of M4.

## Files-changed index (per-phase docs)

| Phase | Doc | Commit |
|---|---|---|
| A schema | `docs/M4-PHASE-A.md` | 0229c4f |
| B homepage sections | `docs/M4-PHASE-B.md` | f273daf |
| C deposit + tiers + Upay | `docs/M4-PHASE-C.md` | 7c3d131 / ec2f493 |
| D promotion claim + banners | `docs/M4-PHASE-D.md` | f8a5494 |
| E referral + cron | `docs/M4-PHASE-E.md` | 70bab78 |
| F lotto polish | `docs/M4-PHASE-F.md` | e08bf1e |
| G about + sponsor + payment | `docs/M4-PHASE-G.md` | ca68db9 |
| provider import | `docs/M4-PROVIDER-IMPORT.md` | a3f2765 |
| provider UI clarity | this doc | 919707a |
| delivery summary | this doc | <this commit> |
