// Built by Anointed Coder.
//
// Homepage section/block types, ported 1:1 from the website source of truth:
//   apps/web/lib/homepage/sections.ts (HomeSection, HomeSectionGame)
//   apps/web/lib/homepage/blocks.ts   (HomeBlock)
// so the mobile home screen and its game-section components can be strongly
// typed against the exact shape /api/content/homepage-sections returns.
//
// Every field here was confirmed present on the live endpoint, for example:
//   curl -s -H "X-Client: mobile" \
//     -H "User-Agent: Pasha9Mobile/1.0.0 (Android)" \
//     https://pasha9.com/api/content/homepage-sections
//
// Media fields (game imageUrl, section iconImageUrl) come back site-relative
// ("/uploads/...") on the wire. The fetch layer in homepage.ts resolves them to
// absolute URLs before the values reach these typed objects, so by the time a
// component reads imageUrl it is already loadable by expo-image.

/** Where a card's game lives: an external aggregator game or a native game. */
export type GameSource = 'external' | 'native';

/** How a card image is fitted inside its square tile. */
export type ImageFitMode = 'cover' | 'contain';

/** How a custom homepage block is filled with games. */
export type BlockSourceType = 'manual' | 'category' | 'brand' | 'jackpot' | 'featured';

/**
 * One game inside a homepage strip or block. External games launch through
 * their provider; native games link straight to their in-app route via `href`.
 */
export interface HomeSectionGame {
  key: string;
  source: GameSource;
  providerKey: string | null;
  providerName: string | null;
  gameUid: string | null;
  gameCode: string | null;
  displayName: string;
  category: string | null;
  /** Absolute image URL, or null when the card falls back to category art. */
  imageUrl: string | null;
  brandName: string | null;
  isHot: boolean;
  isJackpot: boolean;
  minBet: number | null;
  /** Internal app route (native) or provider deep path (external), or null. */
  href: string | null;
  // Per-card overlay visibility flags. Set on curated Hot Games rows and left
  // undefined (meaning "show everything") for organic strip sections.
  showProviderLabel?: boolean;
  showGameName?: boolean;
  showHotBadge?: boolean;
  showPlayButton?: boolean;
  imageOnlyMode?: boolean;
  imageFitMode?: ImageFitMode;
  // Editable HOT badge text. Defaults to "HOT" in the renderer when unset.
  hotBadgeText?: string;
}

/**
 * One homepage strip: an admin-managed titled row (bilingual) over a curated
 * or category-filled game list. `homepage_brand`/`homepage_video`/
 * `homepage_upcoming` are layout markers and carry an empty `games` array.
 */
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
  /** Operator-uploaded custom icon image (absolute URL), else null. */
  iconImageUrl: string | null;
  href: string;
  games: HomeSectionGame[];
}

/**
 * One custom homepage block: same visual shape as a section but sourced from a
 * HomepageGameBlock row (manual picks, a category fill, a brand, jackpot games,
 * or the featured set). Blocks with no games are dropped by the backend.
 */
export interface HomeBlock {
  id: string;
  key: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  sourceType: BlockSourceType;
  category: string | null;
  brandKey: string | null;
  brandName: string | null;
  layout: string;
  position: number;
  href: string;
  games: HomeSectionGame[];
}

/**
 * The assembled homepage payload. `sections` drives the ordered strips and
 * `blocks` the custom rows rendered after them. The count fields are backend
 * diagnostics; the home screen only needs `sections` + `blocks`.
 */
export interface HomeSectionsBundle {
  sections: HomeSection[];
  blocks: HomeBlock[];
}
