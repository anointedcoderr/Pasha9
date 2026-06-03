# M4 Phase A - Schema, seed, scaffolding

Phase A of the M4 launch-readiness sprint. Purely additive. No public site or
admin behaviour changes; this phase puts the data layer in place so phases B
through G can ship their UIs without touching the schema again.

## What landed

### Schema (additive only)

Eleven new Prisma models, plus six optional columns on the existing
`BonusRule` table. Zero column changes anywhere else. `prisma db push` is
safe and requires no data migration.

| Model | Purpose |
|---|---|
| `PublicSection` | Unified directory of public-facing blocks (homepage strips, about region, public payment row). Drives show/hide, reorder, title editing. |
| `HomepageFeaturedGame` | Curated featured-game list. Admins pick up to 20 across providers (external + native). Soft FK so provider re-imports do not orphan-cascade the curation. |
| `DepositNotice` | Pre-deposit notice popup rows. Multiple supported with `position`; `isEnabled` toggles without deletion. |
| `DepositBonusTier` | Tier table (1000 BDT = 3%, 5000 BDT = 5%, ...) materialised into `BonusRule` rows by the Phase C service. |
| `ReferralBalance` | Per-user pending / claimable / claimed ledger sitting alongside `Wallet.balance`. Backfilled from existing `AffiliateCommission` rows in Phase E. |
| `ReferralClaim` | One row per player-initiated transfer from referral balance into the main wallet. |
| `PromotionClaim` | Claim ledger with `@@unique([userId, ruleId, dayBucket])` blocking duplicate daily/weekly/first-deposit claims at the database layer. |
| `UploadConstraint` | Per-category dimension + MIME + byte caps. Drives the Phase D `<ImageUpload>` widget and warnings. |
| `BrandAmbassador` | Replaces the hardcoded `AMBASSADORS` array in `Footer.tsx`. |
| `Sponsor` | Replaces the hardcoded `SPONSORS` array in `Footer.tsx`. |
| `PublicPaymentMethod` | Public icon pills shown on homepage / footer / about. Separate from the gateway `PaymentMethod` rows so the operator can show/hide brands without touching the deposit pipeline. |

`BonusRule` additive columns (all optional):
`bannerDesktopUrl`, `bannerMobileUrl`, `thumbnailUrl`, `backgroundUrl`,
`termsEn`, `termsBn`.

### User back-relations

`ReferralBalance`, `ReferralClaim`, `PromotionClaim` cascade-delete with
`User`. No existing relations were touched.

### Seed (idempotent)

Re-running the seed never overwrites operator edits. Upsert keys:
`PublicSection.key`, `UploadConstraint.categoryKey`, `SystemSetting.key`.
Create-if-missing-by-name for the rest.

- **12 PublicSection rows**: homepage_hot, homepage_slots, homepage_live_casino, homepage_fishing, homepage_crash, homepage_lottery, homepage_brand, homepage_video, homepage_upcoming (hidden by default), about_ambassadors, about_sponsors, public_payment_methods.
- **11 UploadConstraint rows**: banners, banners_mobile, promo_desktop, promo_mobile, promo_thumbnail, promo_background, ambassadors, sponsors, payment_icons, provider_banners, games. Each carries the required dimensions, accepted MIME list and byte cap.
- **1 DepositNotice baseline row**: disabled by default. Operator enables from `/admin/deposit-notice` in Phase C after reviewing the wording.
- **4 PublicPaymentMethod rows**: bKash, Nagad, Rocket, **Upay** (newly added per spec).
- **2 BrandAmbassador placeholder rows** + **3 Sponsor placeholder rows** so Phase G admin renders against non-empty preview cards.
- **5 SystemSetting keys**: `deposit_notice_enabled`, `referral_claim_cadence`, `referral_hold_days`, `referral_turnover_x`, `promotion_claim_engine`.

### Scaffolding

- `GET /api/admin/m4/health` - read-only counts per new table. Returns `phaseAComplete: true` once the baseline seed has run.
- `/admin/m4` - read-only console showing the health counts and a roadmap of upcoming admin surfaces. Not wired into the admin sidebar (kept off-nav so operators are not led to 404s). Direct URL only.

## What did NOT change

- No public site page rendering touched.
- No existing admin page touched.
- No wallet, callback, lotto, affiliate, bonus engine or simulate-callback code touched.
- No new public API endpoints. The only new API surface is `/api/admin/m4/health`, gated by `settings.write`.

## VPS deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

# Generate the client against the new schema.
pnpm exec prisma generate --schema packages/database/prisma/schema.prisma

# Push the additive schema (safe, no data migration).
pnpm exec prisma db push --schema packages/database/prisma/schema.prisma

# Run the seed to populate Phase A baselines.
pnpm --filter @pasha9/database seed

# Standard build + restart.
pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

## Test checklist (Phase A only)

1. `pnpm exec prisma db push` finishes without prompting for a data migration.
2. `pnpm seed` exits 0 and logs the M4 upsert counts.
3. `GET /api/admin/m4/health` (super admin session) returns `phaseAComplete: true` with non-zero counts for `PublicSection`, `UploadConstraint`, `PublicPaymentMethod`, `BrandAmbassador`, `Sponsor`, `DepositNotice`.
4. `/admin/m4` (super admin session) renders the count grid and the upcoming-surfaces list. No application error overlay.
5. **Regression**: JILI launch (`/games/provider`) still works.
6. **Regression**: Provider callback simulation (bet 10 then win 20 same gameRound) still creates two accepted `ProviderTransaction` rows.
7. **Regression**: Wallet, transactions, admin providers, native games, deposit, withdrawal, affiliate, lotto, promotion, reports, tracking, WhatsApp, settings, admin login all load without error.
8. **Regression**: Admin sidebar stays fixed while page scrolls (Phase 3O fix preserved).
9. **Regression**: Application error overlay does not return on `/admin`, `/admin/providers/[id]`, `/admin/transactions`.
10. **Idempotency**: Re-running `pnpm seed` reports the same upsert counts and does not duplicate ambassador / sponsor / payment-method rows.

## What remains for Phase B

- Replace the hardcoded `mockGames` arrays on `/` with a section-assembly query that joins `PublicSection` (for visibility / order / titles) and `HomepageFeaturedGame` (for the manual featured pick).
- Build `/admin/homepage-sections` with two panes: section editor (toggle, reorder, edit title) and featured-game picker (max 20, searchable across providers).
- Add nav entry to `AdminSidebar.tsx` + `AdminMobileDrawer.tsx` under `groupContentAndMedia`.
- Update `/api/providers/[providerKey]/games` ordering only if the featured-list pre-empts the provider ordering (it should not - per-provider browse stays unchanged).

Phase B target diff: one new admin page, one new admin API, one rewrite of
`apps/web/app/(site)/page.tsx` to fetch sections + games from DB instead of
mocks. Zero schema changes.
