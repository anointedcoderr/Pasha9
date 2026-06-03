# M4 Phase B - DB-driven homepage sections + admin curation

Phase B replaces the hardcoded `mockGames` arrays on the public homepage
with sections assembled from `PublicSection` + `HomepageFeaturedGame` +
the real game catalogs (`ExternalGame`, `NativeGameProvider`). Operators
get a new admin page at `/admin/homepage-sections` to edit titles,
visibility, ordering, and to curate up to 20 featured games across all
active providers.

## How the homepage works now

`apps/web/app/(site)/page.tsx` fetches `/api/content/homepage-sections`
on mount and renders the returned sections in order. The chrome above
the strips (HeroSlider, WalletStrip, CategorySlider, PromoTicker,
JackpotStrip, HomeNativeGamesSection, ProviderGamesSection) is
unchanged. The 6 legacy `HomeGameSection` calls that were reading
`mockGames` are gone.

Section assembly lives in `apps/web/lib/homepage/sections.ts`:

| Section key | Source | Filter |
|---|---|---|
| `homepage_hot` | `HomepageFeaturedGame` curation | up to 12 admin-picked games (max 20 curated) |
| `homepage_slots` | `ExternalGame` | category matches `slot` (case-insensitive) |
| `homepage_live_casino` | `ExternalGame` | category matches `live`, `casino`, or `table` |
| `homepage_fishing` | `ExternalGame` | category matches `fish` |
| `homepage_crash` | `ExternalGame` + native | category matches `crash` + native `crash` code |
| `homepage_lottery` | `NativeGameProvider` | native `keno` code |
| `homepage_brand` | layout marker | no game list; page renders its own banner |
| `homepage_video` | layout marker | controls AmbassadorVideoSection visibility |
| `homepage_upcoming` | layout marker | hidden by default per Phase A seed |

Public endpoint behaviour:

- Returns an empty list when assembly fails (try/catch around the entire
  build). The homepage degrades silently: hero + jackpot + provider rail
  + chrome still render.
- Filters out hidden sections (`isVisible=false`).
- Hides strip sections with zero games so visitors never see an empty
  heading. Layout-marker sections always render so the page logic can
  toggle the ambassador video / upcoming-matches slot independently.

External games launch through the same flow as `ProviderGamesSection`:
balance preflight via `/api/auth/me`, `DepositRequiredModal` on
insufficient funds, 401 -> login modal. Native games link to
`/games/<gameCode>`. Image errors fall back to `CategoryHeroArt`.

## How admin manages sections

Path: `/admin/homepage-sections` (now in the Content and Media sidebar
group, EN: "Homepage Sections", BN: "হোমপেজ সেকশন").

The page has two panes:

### Pane A - section manager
Lists every `PublicSection` row in `group='homepage'`. Each row exposes:
- Visibility toggle (live update on click)
- Title EN / BN inline edit
- Subtitle EN / BN inline edit
- Position field
- Save button (greyed until dirty)

### Pane B - featured-game manager
Lists the current `HomepageFeaturedGame` rows in position order with:
- Inactive games shown dimmed and chip-tagged `Inactive`
- Per-row `Hot` and `Jackpot` toggles
- Up / Down reorder (swaps the two adjacent positions)
- Remove button

Header shows `N / 20` selected count. The Add button opens a picker
modal that:
- Searches across both `ExternalGame` (active, on active providers)
  and `NativeGameProvider` (active) in parallel
- Filter dropdown: Both / External only / Native only
- Already-added games appear with `Added` (disabled)
- Add button is disabled when the 20-cap is reached and the header
  switches to `Max 20 reached` until a row is removed

## APIs added

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/content/homepage-sections` | Public homepage assembly | public |
| GET | `/api/admin/homepage-sections` | List homepage section rows | `homepage.write` |
| PATCH | `/api/admin/homepage-sections/[id]` | Edit title / subtitle / visibility / position | `homepage.write` |
| GET | `/api/admin/homepage-featured` | List current featured curation (enriched) | `homepage.write` |
| POST | `/api/admin/homepage-featured` | Add a game (409 if dup / inactive / max) | `homepage.write` |
| PATCH | `/api/admin/homepage-featured/[id]` | Toggle Hot / Jackpot / move position | `homepage.write` |
| DELETE | `/api/admin/homepage-featured/[id]` | Remove from curation | `homepage.write` |
| GET | `/api/admin/homepage-featured/search` | Search external + native catalog | `homepage.write` |

All admin endpoints validate input with Zod, log via `recordActivity`,
and never return upstream credentials.

## Files changed (this phase)

- `apps/web/app/(site)/page.tsx` - rewritten to consume `/api/content/homepage-sections`. Removed all `mockGames` reads.
- `apps/web/lib/homepage/sections.ts` - new server-side assembler.
- `apps/web/app/api/content/homepage-sections/route.ts` - new public endpoint.
- `apps/web/app/api/admin/homepage-sections/route.ts` - new admin list.
- `apps/web/app/api/admin/homepage-sections/[id]/route.ts` - new admin PATCH.
- `apps/web/app/api/admin/homepage-featured/route.ts` - new GET/POST.
- `apps/web/app/api/admin/homepage-featured/[id]/route.ts` - new PATCH/DELETE.
- `apps/web/app/api/admin/homepage-featured/search/route.ts` - new search.
- `apps/web/app/(admin)/admin/homepage-sections/page.tsx` - new two-pane admin page.
- `apps/web/components/site/HomeDbGameSection.tsx` - new DB-driven section renderer.
- `apps/web/components/admin/AdminSidebar.tsx` - added nav entry.
- `apps/web/components/admin/AdminMobileDrawer.tsx` - added drawer entry.
- `apps/web/lib/constants/routes.ts` - added `ROUTES.admin.homepageSections`.
- `apps/web/lib/i18n/dictionaries/en.json` / `bn.json` - `homepageSections` label.
- `docs/M4-PHASE-B.md` - this document.

## Schema changes

None. Phase B is pure read-and-render work on top of the Phase A tables.

## VPS deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

## Test checklist (acceptance)

1. `/` opens. No mock game data renders. Sections come from DB.
2. Curate via `/admin/homepage-sections` -> add a JILI game -> appears on the Hot Games strip of `/`.
3. Mark a featured game Hot -> HOT chip renders on the public tile.
4. Mark a featured game Jackpot -> JACKPOT chip renders on the public tile.
5. Reorder up/down -> position numbers update; public order matches.
6. Try to add a 21st game -> button disabled; toast / chip says `Max 20 reached`.
7. Toggle a section visibility off -> strip disappears from `/` after refresh.
8. Edit a section title EN/BN -> renders in the matching language on `/`.
9. View All chip on each strip routes to the right `/slots` / `/live-casino` / `/fishing` / `/games/crash` / `/lotto` / `/games` page.
10. `/games/provider` still works.
11. JILI launch still works.
12. Provider callback simulation: bet 10 then win 20 on the same gameRound still creates two accepted `ProviderTransaction` rows.
13. Admin sidebar stays fixed while page scrolls.
14. No application error overlay on `/`, `/admin`, `/admin/homepage-sections`, `/admin/providers/[id]`.
15. Mobile homepage at 320 / 375 / 430 widths: tiles are 2-col, View All chip wraps cleanly, no horizontal scroll.

## What remains for Phase C

Deposit flow + bonus system:

- Add `Upay` to the public deposit method list (the bKash/Nagad/Rocket/Bank choices).
- Wire screenshot file upload through `/api/admin/uploads?category=payment-proofs` from the deposit form.
- Build `/admin/deposit-notice` (CRUD over `DepositNotice` rows + toggle the `deposit_notice_enabled` SystemSetting).
- Build `/admin/deposit-bonus-tiers` editor (tier table -> materialises into `BonusRule` rows).
- Live bonus preview on the deposit form (when amount is entered, show calculated bonus and total credit).
- Mandatory reject reason on `/admin/deposits/[id]/reject`.
- Surface bonus + total credit on the deposits admin table.
