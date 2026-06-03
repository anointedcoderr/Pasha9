# M4 - Multi-brand iGamingAPIs catalog import

This phase adds a generic CSV importer alongside the existing JILI
importer so the operator can land 1,500+ games across PGSoft, JDB,
Pragmatic Play Asia, Spribe, Evolution Live, Evolution Live Asia,
Habanero, BTI Sports and 9Wickets in one pass without touching the
JILI flow.

## Architecture

All brands sit under the existing iGamingAPIs `GameProvider` row
(`providerKey='igamingapis'`). Each brand becomes a `ProviderBrand`
row keyed by `(providerId, brandKey)`. Each game becomes an
`ExternalGame` row keyed by `(providerId, gameUid)`. The adapter at
`apps/web/lib/providers/adapters/igamingapis.ts` is unchanged - the
same token / secret / callback secret stored on the `GameProvider`
launches every brand.

## Importer

`packages/database/scripts/import-provider-games.ts`

Run:

```bash
# Default: every CSV in packages/database/seed-data/provider-games,
# JILI skipped (the dedicated import:jili script owns it).
pnpm --filter @pasha9/database import:provider-games

# Single file.
pnpm --filter @pasha9/database import:provider-games \
  ./packages/database/seed-data/provider-games/pgsoft.csv

# Dry-run. Parses, validates and prints the summary without
# writing to the DB. Always run this first on a new export.
pnpm --filter @pasha9/database import:provider-games --dry-run

# Include JILI (e.g. re-importing a full export that includes JILI).
pnpm --filter @pasha9/database import:provider-games --include-jili

# Update existing rows but do not insert new ones.
pnpm --filter @pasha9/database import:provider-games --update-only
```

Output per brand:
- total in CSV
- inserted
- updated
- skipped in this brand
- per category (slots, live_casino, fishing, crash, flash, table, sportsbook)
- unknown categories (mapped to slots, but flagged)

Plus a global summary with the first 40 skipped-row reasons.

### CSV format

Header required:

```
Game ID,Game Name,Brand,Category,Image URL
```

- **Game ID**: numeric `gameUid` when set. Most exports leave this
  blank and the importer reads the number out of the **Image URL**:
  - `https://imagedelivery.net/.../<digits>/public` -> gameUid = digits
  - `https://igamingapis.com/img/<digits>.<ext>` -> gameUid = digits
- Rows where no numeric id is recoverable are skipped and reported.
  No fake ids are generated.

### Brand normalisation

| CSV `Brand` value | Slug (`ProviderBrand.brandKey`) | Display name |
|---|---|---|
| JILI | `JILI` | JILI |
| PGSoft | `PGSOFT` | PGSoft |
| JDB | `JDB` | JDB |
| PragmaticPlay-Asia | `PRAGMATIC_ASIA` | Pragmatic Play Asia |
| Spribe | `SPRIBE` | Spribe |
| Evolution Live | `EVOLUTION_LIVE` | Evolution Live |
| Evolution Live (Asia) | `EVOLUTION_LIVE_ASIA` | Evolution Live Asia |
| Habanero | `HABANERO` | Habanero |
| BtiGaming | `BTI_GAMING` | BTI Sports |
| 9wickets | `NINE_WICKETS` | 9Wickets |

Any other brand falls back to an uppercased snake-case slug of the
CSV value.

### Category normalisation

The importer maps the messy `Category` values onto a small set of
canonical buckets the public lobby filters use:

| Source values | Canonical |
|---|---|
| slot, slots, slot game, hotslots | `slots` |
| flash, instant, minigames | `flash` |
| casinolive, casino live, livecasino, live casino, casino, lobby | `live_casino` |
| table, card, poker, baccarat, blackjack, chess, pvc, gamble game | `table` |
| fish, fishing | `fishing` |
| crash | `crash` |
| sports, sport, sportsbook | `sportsbook` |

Unknown values fall back to `slots` and are flagged in the per-brand
summary so the operator can decide whether to update the CSV or
remap.

### Idempotency

- Upsert key per game: `(providerId, gameUid)`. Re-running the import
  produces `inserted=0, updated=N`.
- Upsert key per brand: `(providerId, brandKey)`. Status is set to
  `active` on insert and **never** overwritten on update so the
  operator can hide a brand from `/admin/providers/[id]` and the
  import won't flip it back.
- `ExternalGame.status` is **never** overwritten on update. New games
  default to `active`; existing rows keep whatever the admin set.
- `GameProvider` row is untouched (`providerKey`, name, status,
  credentials).

## Public browsing

`/api/providers/[providerKey]/games` now accepts a `brand` query
param (also accepts `brandKey`):

```
/api/providers/igamingapis/games?brand=PGSOFT
/api/providers/igamingapis/games?brand=PGSOFT&category=slots
/api/providers/igamingapis/games?category=live_casino&q=baccarat
```

The response includes a new `counts.byBrand` array:

```json
"counts": {
  "total": 1248,
  "byCategory": { "slots": 945, "live_casino": 217, "fishing": 12, "table": 74 },
  "byBrand": [
    { "brandKey": "PRAGMATIC_ASIA", "brandName": "Pragmatic Play Asia", "count": 624 },
    { "brandKey": "EVOLUTION_LIVE", "brandName": "Evolution Live", "count": 237 },
    { "brandKey": "HABANERO", "brandName": "Habanero", "count": 227 },
    ...
  ]
}
```

The `/games/provider` lobby reads this on mount; pass `?brand=` in
the URL to filter to a single brand. Inactive brands are filtered
out server-side.

## Homepage sections

The Phase B section assembler (`apps/web/lib/homepage/sections.ts`)
already case-insensitive-matches categories, so once the import
lands every homepage strip picks up real games:

| Section key | Category match | Brands that contribute |
|---|---|---|
| `homepage_slots` | `slot` | PGSoft, JDB, Habanero, PragmaticPlay-Asia, JILI |
| `homepage_live_casino` | `live`, `casino`, `table` | Evolution Live, Evolution Live Asia |
| `homepage_fishing` | `fish` | JILI, JDB, PragmaticPlay-Asia |
| `homepage_crash` | `crash` (+ native Pasha) | Spribe Aviator, etc. |
| `homepage_sportsbook` | `sport` | BTI Sports, 9Wickets |

Phase H adds the new `homepage_sportsbook` PublicSection row. After
the Phase A seed re-runs (or after a manual upsert), the strip
renders the BTI Sports + 9Wickets entries.

The Hot Games strip (`homepage_hot`) is still admin-curated through
`HomepageFeaturedGame`. The operator picks up to 20 games from any
provider at `/admin/homepage-sections`.

## Launch + callback compatibility

The iGamingAPIs adapter (`apps/web/lib/providers/adapters/igamingapis.ts`)
is **unchanged**. Brand information is metadata; the launch payload
still uses the existing `gameUid` + token / secret / callback secret
stored on the `GameProvider` row.

Callback parsing, simulate-callback, wallet pipeline, transaction
ledger, `processProviderCallback`, type-aware idempotency, double-
debit guard and the encrypted-payload parsing are all unchanged.

## Files changed

- `packages/database/scripts/import-provider-games.ts` (new)
- `packages/database/seed-data/provider-games/` (new directory)
  - `README.md`
  - `pgsoft.csv` (159 rows)
  - `jdb.csv` (108 rows)
  - `spribe.csv` (12 rows)
  - `evolution_live.csv` (237 rows)
  - `evolution_live_asia.csv` (189 rows)
  - `habanero.csv` (227 rows)
  - `bti_gaming.csv` (1 row)
  - `nine_wickets.csv` (1 row)
  - `pragmatic_play_asia.csv` - **operator-supplied** (see README)
- `packages/database/package.json` - `import:provider-games` script
- `packages/database/prisma/seed.ts` - adds `homepage_sportsbook` PublicSection row
- `apps/web/app/api/providers/[providerKey]/games/route.ts` - brand filter + per-brand counts
- `apps/web/lib/homepage/sections.ts` - sportsbook section assembly
- `docs/M4-PROVIDER-IMPORT.md` (this file)

## Schema

No changes. Every model (`GameProvider`, `ProviderBrand`,
`ExternalGame`, `PublicSection`) is already in place.

## VPS deploy + import

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

pnpm exec prisma generate --schema packages/database/prisma/schema.prisma

# Re-run the seed once for the new homepage_sportsbook PublicSection.
pnpm --filter @pasha9/database seed

# Drop the PragmaticPlay-Asia export into the seed-data dir before
# the importer if you want that brand in this pass.
cp /path/to/pragmatic_play_asia.csv \
  packages/database/seed-data/provider-games/pragmatic_play_asia.csv

# Dry-run first to inspect counts and skipped rows.
pnpm --filter @pasha9/database import:provider-games --dry-run

# Live import (JILI skipped by default).
pnpm --filter @pasha9/database import:provider-games

pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

Expected first-run counts (excluding Pragmatic Play Asia and JILI):

| Brand | Expected rows |
|---|---|
| Habanero | 227 |
| Evolution Live | 237 |
| Evolution Live Asia | 189 |
| PGSoft | 159 |
| JDB | 108 |
| Spribe | 12 |
| BTI Sports | 1 |
| 9Wickets | 1 |

Total ~934 games inserted in the first pass; ~1,558 once Pragmatic
Play Asia is added.

## Tests

Importer:
1. `--dry-run` reports counts and skipped rows without touching DB.
2. Default run skips JILI (CSV inclusion does not matter).
3. Re-run produces `inserted=0, updated=N`.
4. Skipped rows include the known missing-ID entries
   (JILI / Teen Patti, PragmaticPlay-Asia / Bigger Bass Splash,
   PragmaticPlay-Asia / Cosmic Cash, Evolution Live / Baccarat B).
5. Per-brand counts match the table above.
6. `--include-jili` writes JILI rows; `--update-only` refuses to
   insert.

Public:
7. `/games/provider` shows games from multiple brands.
8. `/api/providers/igamingapis/games?brand=PGSOFT` returns only PGSoft rows.
9. `/api/providers/igamingapis/games?category=slots&brand=HABANERO` works.
10. Homepage strips pull real games per category.
11. Inactive brand returns `503 BRAND_INACTIVE`.
12. Missing brand returns `404 BRAND_NOT_FOUND`.

Regression:
13. JILI launch still works.
14. Provider callback simulation still works.
15. Phase C deposit, Phase D promotion, Phase E referral, Phase F
    lotto, Phase G about + sponsor + payment-display unaffected.
16. Sidebar fixed, no application error.
