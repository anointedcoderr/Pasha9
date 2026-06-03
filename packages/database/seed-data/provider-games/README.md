# Provider-games seed data

CSV exports from the iGamingAPIs provider panel, one file per brand.
The runner at `packages/database/scripts/import-provider-games.ts`
walks every CSV in this directory and upserts each row as an
`ExternalGame` under the iGamingAPIs `GameProvider`, grouped by
`ProviderBrand`.

## File format

Every CSV must have this header row:

```
Game ID,Game Name,Brand,Category,Image URL
```

- **Game ID** is the canonical numeric `gameUid`. The exports often
  leave this column blank. When it is blank the importer extracts the
  numeric id from the Image URL:
  - `https://imagedelivery.net/.../10035/public` -> `gameUid = 10035`
  - `https://igamingapis.com/img/11539.png` -> `gameUid = 11539`
  If no numeric id can be derived from either field, the row is
  skipped and reported. No fake ids are ever generated.
- **Brand** is the operator-visible brand name (e.g. `PGSoft`, `JDB`,
  `PragmaticPlay-Asia`). The importer normalises it to a
  `ProviderBrand.brandKey` slug (`PGSOFT`, `JDB`, `PRAGMATIC_ASIA`) and
  a human-readable `displayName` (`PGSoft`, `JDB`, `Pragmatic Play Asia`).
- **Category** is mapped through a normalisation table that lands on
  `slots`, `live_casino`, `table`, `fishing`, `crash`, `flash`,
  `sportsbook`. Unknown values fall back to `slots` with a warning in
  the import summary.
- **Image URL** is stored verbatim on `ExternalGame.imageUrl`.

## Running the importer

```bash
# Default: every CSV in this directory, JILI skipped (the dedicated
# import:jili script owns it).
pnpm --filter @pasha9/database import:provider-games

# Single file.
pnpm --filter @pasha9/database import:provider-games \
  ./packages/database/seed-data/provider-games/pgsoft.csv

# Dry-run. Parses, validates and prints the summary without touching
# the DB. Always run this first on a new export.
pnpm --filter @pasha9/database import:provider-games --dry-run

# Include JILI (e.g. when re-importing a full export). The dedicated
# JILI importer (import:jili) remains the canonical path.
pnpm --filter @pasha9/database import:provider-games --include-jili

# Update existing rows but do not insert new ones.
pnpm --filter @pasha9/database import:provider-games --update-only
```

## Idempotency

The importer is safe to re-run. Every row is upserted by the unique
key `(providerId, gameUid)`. Re-running with the same CSVs will report
`inserted=0, updated=N`. Operator-set `ExternalGame.status` and
`ProviderBrand.status` are never overwritten by the importer; only
metadata (displayName, category, imageUrl, lastSyncAt) is refreshed.

## Brands shipped today

| File | Brand display | Brand key | Approx rows |
|---|---|---|---|
| `pgsoft.csv` | PGSoft | `PGSOFT` | 159 |
| `jdb.csv` | JDB | `JDB` | 108 |
| `pragmatic_play_asia.csv` | Pragmatic Play Asia | `PRAGMATIC_ASIA` | ~624 (operator-supplied, see below) |
| `spribe.csv` | Spribe | `SPRIBE` | 12 |
| `evolution_live.csv` | Evolution Live | `EVOLUTION_LIVE` | 237 |
| `evolution_live_asia.csv` | Evolution Live Asia | `EVOLUTION_LIVE_ASIA` | 189 |
| `habanero.csv` | Habanero | `HABANERO` | 227 |
| `bti_gaming.csv` | BTI Sports | `BTI_GAMING` | 1 |
| `nine_wickets.csv` | 9Wickets | `NINE_WICKETS` | 1 |

### Pragmatic Play Asia

The PragmaticPlay-Asia export (~624 rows) is too large to ship inline.
Save the original CSV export to `pragmatic_play_asia.csv` in this
directory and re-run the importer. The header row + the same
gameUid-from-Image-URL rule applies; no other config is needed.

```bash
cp /path/to/your-export.csv \
  packages/database/seed-data/provider-games/pragmatic_play_asia.csv
pnpm --filter @pasha9/database import:provider-games --dry-run
pnpm --filter @pasha9/database import:provider-games
```

JILI lives at `packages/database/seed-data/jili_games_import_ready.csv`
and is imported by `import:jili`. It is intentionally **not** copied
here.

## Security

- Do not paste API tokens, secrets, or callback secrets into any CSV
  in this directory. The importer never reads them.
- Player-side launch routes still use the credentials stored on the
  `GameProvider` row (encrypted at rest by `lib/crypto/aead.ts`). The
  importer never touches them.
