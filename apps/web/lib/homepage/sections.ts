// Built by Anointed Coder.
//
// Homepage section assembler. Joins:
//   - PublicSection rows (group='homepage') for layout + show/hide + titles
//   - HomepageFeaturedGame rows for the curated featured list
//   - ExternalGame + NativeGameProvider for per-category fills
//
// Behaviour per section.key:
//   homepage_hot       . curated featured games (HomepageFeaturedGame),
//                        falls back to recently-updated active external
//                        games when no curation rows exist
//   homepage_slots     . ExternalGame where category matches 'slot'
//   homepage_live_casino. ExternalGame where category matches live / casino / table
//   homepage_fishing   . ExternalGame where category matches 'fish'
//   homepage_crash     . ExternalGame where category matches 'crash' + native crash
//   homepage_lottery   . NativeGameProvider keno + lotto codes (lotto draw rail
//                        is rendered separately by the page)
//   homepage_brand     . layout-only marker (no game list, page renders its own banner)
//   homepage_video     . layout-only marker
//   homepage_upcoming  . hidden by default per Phase A seed
//
// All filters are lenient: case-insensitive `contains` so providers
// that ship slightly different category vocabularies still bucket
// correctly. Featured games are always rendered first inside the strip
// limit. Inactive games are filtered out so curation can never surface
// a maintenance row by mistake.

import { db } from '@/lib/db/client';
import { isNativeGamesPublic } from '@/lib/native-games/flag';

export interface HomeSectionGame {
  key: string;
  source: 'external' | 'native';
  providerKey: string | null;
  providerName: string | null;
  gameUid: string | null;
  gameCode: string | null;
  displayName: string;
  category: string | null;
  imageUrl: string | null;
  brandName: string | null;
  isHot: boolean;
  isJackpot: boolean;
  minBet: number | null;
  href: string | null;
}

export interface HomeSection {
  id: string;
  key: string;
  group: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  position: number;
  isVisible: boolean;
  layout: string | null;
  iconKey: string;
  href: string;
  games: HomeSectionGame[];
}

export interface HomeSectionsBundle {
  sections: HomeSection[];
  featuredCount: number;
}

const STRIP_LIMIT = 12;
const FEATURED_LIMIT = 20;

const ICON_KEY_BY_SECTION: Record<string, string> = {
  homepage_hot: 'flame',
  homepage_slots: 'cherry',
  homepage_live_casino: 'tv',
  homepage_fishing: 'fish',
  homepage_crash: 'zap',
  homepage_lottery: 'ticket',
  homepage_brand: 'sparkles',
  homepage_video: 'play',
  homepage_upcoming: 'calendar',
  homepage_sportsbook: 'flag',
};

// View All hrefs. After M4 catalog import these route to the real
// filtered ExternalGame catalog at /games/provider, not the old mock
// category pages. The lobby preselects the dropdowns from the URL
// query so the visitor lands directly on the filtered list.
const HREF_BY_SECTION: Record<string, string> = {
  homepage_hot: '/games/provider?featured=1',
  homepage_slots: '/games/provider?category=slots',
  homepage_live_casino: '/games/provider?category=live_casino',
  homepage_fishing: '/games/provider?category=fishing',
  homepage_crash: '/games/provider?category=crash',
  homepage_lottery: '/lotto',
  homepage_brand: '/promotions',
  homepage_video: '/',
  homepage_upcoming: '/games/provider?category=sportsbook',
  homepage_sportsbook: '/games/provider?category=sportsbook',
};

const CATEGORY_MATCHERS: Record<string, string[]> = {
  homepage_slots: ['slot'],
  homepage_live_casino: ['live', 'casino', 'table'],
  homepage_fishing: ['fish'],
  homepage_crash: ['crash'],
  homepage_sportsbook: ['sport'],
};

function matchesAny(category: string | null | undefined, needles: string[]): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return needles.some((n) => c.includes(n));
}

interface ExternalGameRow {
  id: string;
  providerId: string;
  gameUid: string;
  displayName: string;
  category: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  sortOrder: number;
  status: string;
  provider: { providerKey: string | null; name: string; status: string };
  brand: { displayName: string } | null;
}

interface NativeGameRow {
  id: string;
  gameCode: string;
  displayName: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  minBet: { toString: () => string } | number | null;
}

function externalToGame(row: ExternalGameRow): HomeSectionGame {
  return {
    key: `external:${row.id}`,
    source: 'external',
    providerKey: row.provider.providerKey,
    providerName: row.provider.name,
    gameUid: row.gameUid,
    gameCode: null,
    displayName: row.displayName,
    category: row.category,
    imageUrl: row.imageUrl,
    brandName: row.brand?.displayName ?? null,
    isHot: false,
    isJackpot: false,
    minBet: null,
    href: row.provider.providerKey ? `/games/provider?provider=${encodeURIComponent(row.provider.providerKey)}&game=${encodeURIComponent(row.gameUid)}` : null,
  };
}

function nativeToGame(row: NativeGameRow): HomeSectionGame {
  const minBet = typeof row.minBet === 'number'
    ? row.minBet
    : row.minBet
      ? Number(row.minBet.toString())
      : null;
  return {
    key: `native:${row.id}`,
    source: 'native',
    providerKey: null,
    providerName: 'Pasha Originals',
    gameUid: null,
    gameCode: row.gameCode,
    displayName: row.displayName,
    category: null,
    imageUrl: null,
    brandName: null,
    isHot: false,
    isJackpot: false,
    minBet,
    href: `/games/${row.gameCode}`,
  };
}

async function loadFeaturedGames(): Promise<HomeSectionGame[]> {
  const rows = await db.homepageFeaturedGame.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: FEATURED_LIMIT,
  });
  if (rows.length === 0) return [];

  // Native games stay hidden from the public Hot Games strip while the
  // native_games_public_enabled flag is off, even if a previous admin
  // added a native row. Without this guard a flag-flip back to false
  // would leak Pasha Originals onto the homepage strip.
  const nativePublic = await isNativeGamesPublic();
  const usable = rows.filter((r) => (r.source === 'native' ? nativePublic : true));

  const externalIds = usable.filter((r) => r.source === 'external' && r.externalGameId).map((r) => r.externalGameId as string);
  const nativeCodes = usable.filter((r) => r.source === 'native' && r.nativeGameCode).map((r) => r.nativeGameCode as string);

  const [externals, natives] = await Promise.all([
    externalIds.length
      ? db.externalGame.findMany({
          where: { id: { in: externalIds }, status: 'active', provider: { status: 'active' } },
          include: {
            provider: { select: { providerKey: true, name: true, status: true } },
            brand: { select: { displayName: true } },
          },
        })
      : Promise.resolve([] as ExternalGameRow[]),
    nativeCodes.length
      ? db.nativeGameProvider.findMany({
          where: { gameCode: { in: nativeCodes }, isActive: true },
          select: { id: true, gameCode: true, displayName: true, isActive: true, isFeatured: true, sortOrder: true, minBet: true },
        })
      : Promise.resolve([] as NativeGameRow[]),
  ]);

  const externalById = new Map(externals.map((g) => [g.id, g as ExternalGameRow]));
  const nativeByCode = new Map(natives.map((g) => [g.gameCode, g as NativeGameRow]));

  const games: HomeSectionGame[] = [];
  for (const r of usable) {
    if (r.source === 'external' && r.externalGameId) {
      const g = externalById.get(r.externalGameId);
      if (!g) continue;
      games.push({ ...externalToGame(g), isHot: r.isHot, isJackpot: r.isJackpot });
    } else if (r.source === 'native' && r.nativeGameCode) {
      const g = nativeByCode.get(r.nativeGameCode);
      if (!g) continue;
      games.push({ ...nativeToGame(g), isHot: r.isHot, isJackpot: r.isJackpot });
    }
  }
  return games;
}

// Synthetic Hot Games section used when the PublicSection seed row is
// missing in production but HomepageFeaturedGame already has rows.
// Without this fallback the operator's curation is silently dropped
// because the assembler key-loop never reaches the `homepage_hot` case.
function syntheticHotSection(games: HomeSectionGame[]): HomeSection {
  return {
    id: 'synthetic:homepage_hot',
    key: 'homepage_hot',
    group: 'homepage',
    titleEn: 'Hot Games',
    titleBn: 'হট গেমস',
    subtitleEn: 'Trending right now',
    subtitleBn: null,
    position: 10,
    isVisible: true,
    layout: 'strip',
    iconKey: ICON_KEY_BY_SECTION.homepage_hot,
    href: HREF_BY_SECTION.homepage_hot,
    games,
  };
}

async function loadExternalByCategoryMatch(needles: string[]): Promise<HomeSectionGame[]> {
  // Lenient case-insensitive match across multiple needles. Run one
  // findMany per needle then merge; Prisma 5 does not yet support
  // case-insensitive OR-of-contains on a SQLite back-end so this is
  // future-proof against test envs.
  const seen = new Map<string, HomeSectionGame>();
  for (const needle of needles) {
    const rows = await db.externalGame.findMany({
      where: {
        status: 'active',
        provider: { status: 'active' },
        category: { contains: needle, mode: 'insensitive' },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'desc' }, { displayName: 'asc' }],
      take: STRIP_LIMIT * 2,
      include: {
        provider: { select: { providerKey: true, name: true, status: true } },
        brand: { select: { displayName: true } },
      },
    });
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.set(r.id, externalToGame(r as ExternalGameRow));
      if (seen.size >= STRIP_LIMIT) break;
    }
    if (seen.size >= STRIP_LIMIT) break;
  }
  return Array.from(seen.values()).slice(0, STRIP_LIMIT);
}

async function loadNativeCrash(): Promise<HomeSectionGame[]> {
  const rows = await db.nativeGameProvider.findMany({
    where: { isActive: true, gameCode: { in: ['crash'] } },
    select: { id: true, gameCode: true, displayName: true, isActive: true, isFeatured: true, sortOrder: true, minBet: true },
  });
  return rows.map((r) => nativeToGame(r as NativeGameRow));
}

async function loadNativeLottery(): Promise<HomeSectionGame[]> {
  const rows = await db.nativeGameProvider.findMany({
    where: { isActive: true, gameCode: { in: ['keno'] } },
    select: { id: true, gameCode: true, displayName: true, isActive: true, isFeatured: true, sortOrder: true, minBet: true },
  });
  return rows.map((r) => nativeToGame(r as NativeGameRow));
}

/**
 * Server-side assembler used by the public homepage and by admin
 * previews. Always returns a stable shape: a section row with an
 * empty `games` array still gets returned so the admin preview can
 * show "no rows match" and so the public page can hide it cleanly.
 */
export async function buildHomeSections(): Promise<HomeSectionsBundle> {
  const sectionRows = await db.publicSection.findMany({
    where: { group: 'homepage' },
    orderBy: [{ position: 'asc' }, { titleEn: 'asc' }],
  });

  const featuredGames = await loadFeaturedGames();

  const sections: HomeSection[] = [];
  for (const s of sectionRows) {
    let games: HomeSectionGame[] = [];
    switch (s.key) {
      case 'homepage_hot': {
        // Featured curation is the source of truth for Hot. When the
        // admin has not curated any games (or the curated set is
        // empty after status filtering) fall back to live ExternalGame
        // rows flagged isFeatured. We deliberately do NOT fall back to
        // native game providers here - inactive native games would
        // surface as "Coming soon" tiles that the visitor cannot
        // actually launch from the homepage strip.
        if (featuredGames.length > 0) {
          games = featuredGames.slice(0, STRIP_LIMIT).map((g) => ({ ...g, isHot: true }));
        } else {
          const fallback = await db.externalGame.findMany({
            where: { status: 'active', provider: { status: 'active' }, isFeatured: true },
            orderBy: [{ sortOrder: 'desc' }, { displayName: 'asc' }],
            take: STRIP_LIMIT,
            include: {
              provider: { select: { providerKey: true, name: true, status: true } },
              brand: { select: { displayName: true } },
            },
          });
          games = fallback.map((r) => ({ ...externalToGame(r as ExternalGameRow), isHot: true }));
        }
        break;
      }
      case 'homepage_slots':
      case 'homepage_live_casino':
      case 'homepage_fishing':
      case 'homepage_sportsbook': {
        games = await loadExternalByCategoryMatch(CATEGORY_MATCHERS[s.key]);
        break;
      }
      case 'homepage_crash': {
        const external = await loadExternalByCategoryMatch(CATEGORY_MATCHERS[s.key]);
        const native = (await isNativeGamesPublic()) ? await loadNativeCrash() : [];
        games = [...native, ...external].slice(0, STRIP_LIMIT);
        break;
      }
      case 'homepage_lottery': {
        games = (await isNativeGamesPublic()) ? await loadNativeLottery() : [];
        break;
      }
      // brand / video / upcoming are layout markers; no game list.
      default:
        games = [];
    }

    sections.push({
      id: s.id,
      key: s.key,
      group: s.group,
      titleEn: s.titleEn,
      titleBn: s.titleBn,
      subtitleEn: s.subtitleEn,
      subtitleBn: s.subtitleBn,
      position: s.position,
      isVisible: s.isVisible,
      layout: s.layout,
      iconKey: ICON_KEY_BY_SECTION[s.key] ?? 'sparkles',
      href: HREF_BY_SECTION[s.key] ?? '/games',
      games,
    });
  }

  // Resilience: if the operator's database is missing the
  // `homepage_hot` PublicSection row (Phase A seed never ran or the
  // row was deleted) but the admin has already curated games via
  // HomepageFeaturedGame, surface those games anyway. The operator
  // should still re-run the seed - the warning on /admin/homepage-sections
  // stays - but the public homepage cannot silently drop curation.
  const hasHotRow = sections.some((s) => s.key === 'homepage_hot');
  if (!hasHotRow && featuredGames.length > 0) {
    const synthetic = syntheticHotSection(
      featuredGames.slice(0, STRIP_LIMIT).map((g) => ({ ...g, isHot: true })),
    );
    sections.unshift(synthetic);
  }

  return { sections, featuredCount: featuredGames.length };
}
