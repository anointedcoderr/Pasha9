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
import { loadWingoSettings, type WingoCardOverlays } from '@/lib/wingo/flag';

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
  // Per-card overlay visibility flags, set on curated Hot Games rows
  // and defaulted to "show everything" for organic strip sections.
  showProviderLabel?: boolean;
  showGameName?: boolean;
  showHotBadge?: boolean;
  showPlayButton?: boolean;
  imageOnlyMode?: boolean;
  imageFitMode?: 'cover' | 'contain';
  // Editable HOT badge text. Defaults to "HOT" in the renderer when unset;
  // set on the WinGo card so an operator can rename the badge.
  hotBadgeText?: string;
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
  // Operator-uploaded custom icon image. Stored in PublicSection.meta
  // so the field is additive (no schema change). When set, the public
  // strip renders this image instead of the lucide icon for iconKey.
  iconImageUrl: string | null;
  href: string;
  games: HomeSectionGame[];
}

export interface HomeSectionsBundle {
  sections: HomeSection[];
  // Number of HomepageFeaturedGame rows that resolved to a renderable
  // game (post status/native filter). This is what landed in the
  // homepage_hot section's games array.
  featuredCount: number;
  // Raw HomepageFeaturedGame row count, INDEPENDENT of native flag /
  // status filtering. Use this to decide "operator has curation" -
  // featuredCount can be 0 while curatedCount is non-zero when all
  // curation is native and the public flag is off.
  curatedCount: number;
  // Per-row diagnostics for rows the assembler dropped silently. The
  // public API route forwards this in a non-load-bearing field so the
  // admin sync-check can surface drift without re-querying the DB.
  blockedCuratedRows: Array<{ curatedId: string; source: 'external' | 'native'; ref: string; reason: string }>;
}

const STRIP_LIMIT = 12;
const FEATURED_LIMIT = 60;
// Hot Games is operator-curated end-to-end; render every row the
// operator added (capped by FEATURED_LIMIT in loadFeaturedGames) so
// the public strip mirrors the Manager exactly. The cap is set to 60
// so the operator can curate at least 50 rows as requested while
// leaving a small safety buffer above the requested headline figure.
// Other category strips (slots/casino/etc) keep STRIP_LIMIT.
const HOMEPAGE_HOT_LIMIT = FEATURED_LIMIT;

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

interface LoadFeaturedResult {
  games: HomeSectionGame[];
  curatedCount: number;
  blocked: Array<{ curatedId: string; source: 'external' | 'native'; ref: string; reason: string }>;
}

async function loadFeaturedGames(nativePublicArg?: boolean): Promise<LoadFeaturedResult> {
  const rows = await db.homepageFeaturedGame.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: FEATURED_LIMIT,
  });
  const curatedCount = rows.length;
  if (curatedCount === 0) return { games: [], curatedCount: 0, blocked: [] };

  // Native games stay hidden from the public Hot Games strip while the
  // native_games_public_enabled flag is off, even if a previous admin
  // added a native row. The caller (buildHomeSections) resolves the
  // flag once and passes it in so every per-section decision sees the
  // same snapshot.
  const nativePublic = nativePublicArg ?? (await isNativeGamesPublic());

  const blocked: LoadFeaturedResult['blocked'] = [];
  const usable = rows.filter((r) => {
    if (r.source === 'native') {
      if (!nativePublic) {
        blocked.push({
          curatedId: r.id,
          source: 'native',
          ref: r.nativeGameCode ?? '',
          reason: 'native_games_public_enabled=false',
        });
        return false;
      }
    }
    return true;
  });

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
      if (!g) {
        blocked.push({
          curatedId: r.id,
          source: 'external',
          ref: r.externalGameId,
          reason: 'external_game_or_provider_inactive_or_missing',
        });
        continue;
      }
      games.push({
        ...externalToGame(g),
        isHot: r.isHot,
        isJackpot: r.isJackpot,
        imageUrl: r.customImageUrl?.trim() || g.imageUrl || null,
        showProviderLabel: r.showProviderLabel,
        showGameName: r.showGameName,
        showHotBadge: r.showHotBadge,
        showPlayButton: r.showPlayButton,
        imageOnlyMode: r.imageOnlyMode,
        imageFitMode: (r.imageFitMode === 'contain' ? 'contain' : 'cover'),
      });
    } else if (r.source === 'native' && r.nativeGameCode) {
      const g = nativeByCode.get(r.nativeGameCode);
      if (!g) {
        blocked.push({
          curatedId: r.id,
          source: 'native',
          ref: r.nativeGameCode,
          reason: 'native_game_inactive_or_missing',
        });
        continue;
      }
      games.push({
        ...nativeToGame(g),
        isHot: r.isHot,
        isJackpot: r.isJackpot,
        imageUrl: r.customImageUrl?.trim() || null,
        showProviderLabel: r.showProviderLabel,
        showGameName: r.showGameName,
        showHotBadge: r.showHotBadge,
        showPlayButton: r.showPlayButton,
        imageOnlyMode: r.imageOnlyMode,
        imageFitMode: (r.imageFitMode === 'contain' ? 'contain' : 'cover'),
      });
    }
  }

  // One aggregated warn per request when at least one curated row was
  // dropped, so production logs surface drift without per-row spam.
  if (blocked.length > 0) {
    console.warn('[homepage] curated rows blocked from Hot Games strip', {
      curatedCount,
      renderedCount: games.length,
      blockedCount: blocked.length,
      blocked: blocked.slice(0, 10),
    });
  }

  return { games, curatedCount, blocked };
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
    iconImageUrl: null,
    href: HREF_BY_SECTION.homepage_hot,
    games,
  };
}

// Synthetic Hot Games entry for Pasha WinGo. WinGo is a round-based
// native game behind its own wingo_enabled flag (lib/wingo/flag.ts),
// separate from the external catalog and the native-games public flag,
// so it is injected here rather than curated through
// HomepageFeaturedGame. It renders through the existing native Link
// path in HomeDbGameSection (a Link to /games/wingo with the amber Play
// pill). With no image upload it falls back to the CategoryHeroArt
// artwork like any other card, so the strip stays visually consistent.
function wingoHotCard(imageUrl: string | null, overlays: WingoCardOverlays): HomeSectionGame {
  return {
    key: 'native:wingo',
    source: 'native',
    providerKey: null,
    // Editable source label; maps to the provider-label pill (brandName is
    // null on this card so the renderer uses providerName).
    providerName: overlays.labelText,
    gameUid: null,
    gameCode: 'wingo',
    // Editable card name.
    displayName: overlays.nameText,
    category: null,
    // Operator-managed card image (admin/homepage-sections). When null the
    // renderer falls back to CategoryHeroArt like any other card.
    imageUrl: imageUrl,
    brandName: null,
    isHot: true,
    isJackpot: false,
    minBet: null,
    href: '/games/wingo',
    // Overlay visibility, driven by the admin config. imageOnly suppresses
    // every overlay through the same HomeDbGameSection gating the featured
    // cards use, leaving just the uploaded image.
    showProviderLabel: overlays.showOriginalsLabel,
    showGameName: overlays.showName,
    showHotBadge: overlays.showHotBadge,
    showPlayButton: overlays.showPlay,
    imageOnlyMode: overlays.imageOnly,
    hotBadgeText: overlays.hotText,
  };
}

// Pull the admin-uploaded iconImageUrl out of PublicSection.meta. The
// meta column is free-form Json; the value is stored as a plain
// /uploads/categories/<file> URL or any absolute https URL.
function extractIconImageUrl(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const v = (meta as Record<string, unknown>).iconImageUrl;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
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

  // Snapshot the native flag once so every per-section decision sees
  // the same value, even if an admin toggles it mid-assembly.
  const nativePublic = await isNativeGamesPublic();
  // WinGo has its own gate, independent of the native-games public flag.
  // When it is on we prepend a synthetic Pasha WinGo card to the Hot
  // Games strip so the round-based game is reachable from the homepage.
  const wingoSettings = await loadWingoSettings();
  const wingoEnabled = wingoSettings.enabled;
  const featured = await loadFeaturedGames(nativePublic);
  const featuredGames = featured.games;
  const curatedCount = featured.curatedCount;

  const sections: HomeSection[] = [];
  for (const s of sectionRows) {
    let games: HomeSectionGame[] = [];
    switch (s.key) {
      case 'homepage_hot': {
        // Operator curation is the SINGLE source of truth. As soon as
        // any HomepageFeaturedGame row exists we render only those
        // rows and never fall back to ExternalGame.isFeatured, even if
        // every curated row was filtered out (e.g. all-native curation
        // while native_games_public_enabled=false). The empty-games
        // case here cascades to the route filter which the route now
        // short-circuits via bundle.curatedCount.
        if (curatedCount > 0) {
          games = featuredGames.slice(0, HOMEPAGE_HOT_LIMIT).map((g) => ({ ...g, isHot: true }));
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
        const native = nativePublic ? await loadNativeCrash() : [];
        games = [...native, ...external].slice(0, STRIP_LIMIT);
        break;
      }
      case 'homepage_lottery': {
        games = nativePublic ? await loadNativeLottery() : [];
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
      iconImageUrl: extractIconImageUrl(s.meta),
      href: HREF_BY_SECTION[s.key] ?? '/games',
      games,
    });
  }

  // Resilience: HomepageFeaturedGame curation must reach the visitor
  // whenever the operator has added rows, regardless of the
  // PublicSection.homepage_hot row's visibility state. Cover both
  // missing-row and hidden-row cases here so the public API filter
  // never silently drops curated games.
  if (curatedCount > 0) {
    const hotIdx = sections.findIndex((s) => s.key === 'homepage_hot');
    const hotGames = featuredGames.slice(0, HOMEPAGE_HOT_LIMIT).map((g) => ({ ...g, isHot: true }));
    if (hotIdx === -1) {
      sections.unshift(syntheticHotSection(hotGames));
    } else {
      const row = sections[hotIdx];
      const needsForce = !row.isVisible || row.games.length === 0;
      if (needsForce) {
        // The operator either staged curation with the strip hidden
        // (overridden so curation reaches the visitor) or every curated
        // row was filtered out at this snapshot (overridden with the
        // resolved games array, which may be empty). Either way the
        // homepage_hot row MUST land in the public payload so the
        // operator can confirm changes propagate.
        console.warn('[homepage] forcing homepage_hot visible because curation exists', {
          curatedCount,
          resolvedGames: hotGames.length,
          sectionWasVisible: row.isVisible,
          sectionHadGames: row.games.length,
        });
        sections[hotIdx] = { ...row, isVisible: true, games: hotGames };
      }
    }
  }

  // Prepend the Pasha WinGo card to Hot Games when the game is enabled.
  // Done after the curation force-block so WinGo always leads the strip.
  // If the homepage_hot row is missing entirely we synthesise it so the
  // card still reaches the visitor, and we force the section visible so
  // an operator who hid Hot Games does not also hide WinGo.
  if (wingoEnabled) {
    const card = wingoHotCard(wingoSettings.homepageImageUrl, wingoSettings.cardOverlays);
    const hotIdx = sections.findIndex((s) => s.key === 'homepage_hot');
    if (hotIdx === -1) {
      sections.unshift(syntheticHotSection([card]));
    } else {
      const row = sections[hotIdx];
      sections[hotIdx] = { ...row, isVisible: true, games: [card, ...row.games] };
    }
  }

  return {
    sections,
    featuredCount: featuredGames.length,
    curatedCount,
    blockedCuratedRows: featured.blocked,
  };
}
