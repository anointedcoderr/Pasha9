// Built by Anointed Coder.
//
// Live homepage content-sync data layer. These are the admin-driven feeds the
// website home is built from, wired for the app so the two stay in sync. Each
// read is PUBLIC (auth:false) so the home screen renders on a signed-out shell,
// and lightly cached (~60s) since content only changes when an admin edits it,
// mirroring the thin pattern already used in lib/api/home.ts.
//
// Every media field arrives site-relative ("/uploads/...") on the wire; we run
// each through absoluteMediaUrl (shared with home.ts) so components receive
// URLs expo-image can load on native. Nothing here fabricates a value: an
// absent field stays null, an empty list stays empty.
//
// Endpoints (public content reads, verified live):
//   GET /api/content/homepage-sections  -> { sections, blocks, featuredCount, curatedCount, blockedCuratedRows }
//   GET /api/content/homepage-shortcuts -> { icons: { [key]: url } }
//   GET /api/content/promo-text         -> { items: [{ id, message, position, status }] }
//   GET /api/content/homepage-videos    -> { videos: [...] }
//   GET /api/content/ambassador         -> { active, ambassador, video }
//   GET /api/content/homepage-promo-pair-> { refer, pass }
//   GET /api/content/categories         -> { categories: [...] }
//   GET /api/content/apk                -> { url, version }
//
// Duplicates deliberately NOT redeclared here: useBanners/useJackpot live in
// home.ts, useSportsEvents in sports.ts, usePromotions in promotions.ts.

import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { absoluteMediaUrl } from './home';
import type {
  HomeSection,
  HomeSectionGame,
  HomeBlock,
  HomeSectionsBundle,
  GameSource,
  ImageFitMode,
  BlockSourceType,
} from './homepage-types';

export type {
  HomeSection,
  HomeSectionGame,
  HomeBlock,
  HomeSectionsBundle,
} from './homepage-types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const homepageSectionsQueryKey = ['content', 'homepage-sections'] as const;
export const homepageShortcutsQueryKey = ['content', 'homepage-shortcuts'] as const;
export const promoTextQueryKey = ['content', 'promo-text'] as const;
export const homepageVideosQueryKey = ['content', 'homepage-videos'] as const;
export const ambassadorQueryKey = ['content', 'ambassador'] as const;
export const promoPairQueryKey = ['content', 'homepage-promo-pair'] as const;
export const categoriesQueryKey = ['content', 'categories'] as const;
export const apkQueryKey = ['content', 'apk'] as const;

// ---------------------------------------------------------------------------
// Small defensive coercers (same style as lib/api/home.ts)
// ---------------------------------------------------------------------------

/** A non-empty trimmed string, or null. */
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

/** A string, or the given fallback (never null). */
function strOr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

/** A finite number, or null. Never coerces null/'' into 0. */
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** A finite number, or the given fallback. */
function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** A boolean when the value is really a boolean, else undefined (preserves "unset"). */
function optBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/** A string when set, else undefined (for optional string fields). */
function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

// ---------------------------------------------------------------------------
// Homepage sections + blocks -> useHomepageSections()
// ---------------------------------------------------------------------------

interface RawSectionsResponse {
  ok: true;
  sections?: Array<Record<string, unknown>>;
  blocks?: Array<Record<string, unknown>>;
}

function mapGame(raw: Record<string, unknown>): HomeSectionGame {
  const source: GameSource = raw.source === 'native' ? 'native' : 'external';
  const fit: ImageFitMode | undefined =
    raw.imageFitMode === 'contain' ? 'contain' : raw.imageFitMode === 'cover' ? 'cover' : undefined;
  return {
    key: strOr(raw.key, ''),
    source,
    providerKey: str(raw.providerKey),
    providerName: str(raw.providerName),
    gameUid: str(raw.gameUid),
    gameCode: str(raw.gameCode),
    displayName: strOr(raw.displayName, ''),
    category: str(raw.category),
    imageUrl: absoluteMediaUrl(raw.imageUrl as string | null),
    brandName: str(raw.brandName),
    isHot: raw.isHot === true,
    isJackpot: raw.isJackpot === true,
    minBet: numOrNull(raw.minBet),
    href: str(raw.href),
    showProviderLabel: optBool(raw.showProviderLabel),
    showGameName: optBool(raw.showGameName),
    showHotBadge: optBool(raw.showHotBadge),
    showPlayButton: optBool(raw.showPlayButton),
    imageOnlyMode: optBool(raw.imageOnlyMode),
    imageFitMode: fit,
    hotBadgeText: optStr(raw.hotBadgeText),
  };
}

function mapGames(raw: unknown): HomeSectionGame[] {
  return Array.isArray(raw) ? raw.map((g) => mapGame(g as Record<string, unknown>)) : [];
}

function mapSection(raw: Record<string, unknown>): HomeSection {
  return {
    id: strOr(raw.id, ''),
    key: strOr(raw.key, ''),
    group: strOr(raw.group, 'homepage'),
    titleEn: strOr(raw.titleEn, ''),
    titleBn: str(raw.titleBn),
    subtitleEn: str(raw.subtitleEn),
    subtitleBn: str(raw.subtitleBn),
    position: numOr(raw.position, 0),
    isVisible: raw.isVisible !== false,
    layout: str(raw.layout),
    iconKey: strOr(raw.iconKey, 'sparkles'),
    iconImageUrl: absoluteMediaUrl(raw.iconImageUrl as string | null),
    href: strOr(raw.href, '/games'),
    games: mapGames(raw.games),
  };
}

function mapBlock(raw: Record<string, unknown>): HomeBlock {
  const allowed: BlockSourceType[] = ['manual', 'category', 'brand', 'jackpot', 'featured'];
  const sourceType: BlockSourceType = allowed.includes(raw.sourceType as BlockSourceType)
    ? (raw.sourceType as BlockSourceType)
    : 'manual';
  return {
    id: strOr(raw.id, ''),
    key: strOr(raw.key, ''),
    titleEn: strOr(raw.titleEn, ''),
    titleBn: str(raw.titleBn),
    subtitleEn: str(raw.subtitleEn),
    subtitleBn: str(raw.subtitleBn),
    sourceType,
    category: str(raw.category),
    brandKey: str(raw.brandKey),
    brandName: str(raw.brandName),
    layout: strOr(raw.layout, 'grid'),
    position: numOr(raw.position, 0),
    href: strOr(raw.href, '/games/provider'),
    games: mapGames(raw.games),
  };
}

/** GET /api/content/homepage-sections. Public read. Returns the ordered strips + custom blocks. */
export async function getHomepageSections(): Promise<HomeSectionsBundle> {
  const res = await api.get<RawSectionsResponse>('/api/content/homepage-sections', { auth: false });
  return {
    sections: Array.isArray(res.sections) ? res.sections.map(mapSection) : [],
    blocks: Array.isArray(res.blocks) ? res.blocks.map(mapBlock) : [],
  };
}

/**
 * The live homepage strips + custom blocks. Public (no auth) so they render on
 * a guest shell; cached ~60s since they only change on an admin edit.
 */
export function useHomepageSections() {
  return useQuery<HomeSectionsBundle>({
    queryKey: homepageSectionsQueryKey,
    queryFn: getHomepageSections,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Category shortcut icon overrides -> useHomepageShortcuts()
// ---------------------------------------------------------------------------

/** Admin-uploaded icon override URL per shortcut key (missing keys omitted). */
export type HomepageShortcutIcons = Record<string, string>;

interface RawShortcutsResponse {
  ok: true;
  icons?: Record<string, unknown>;
}

/** GET /api/content/homepage-shortcuts. Public read. Returns absolute icon URLs keyed by shortcut. */
export async function getHomepageShortcuts(): Promise<HomepageShortcutIcons> {
  const res = await api.get<RawShortcutsResponse>('/api/content/homepage-shortcuts', { auth: false });
  const raw = res.icons && typeof res.icons === 'object' ? res.icons : {};
  const out: HomepageShortcutIcons = {};
  for (const [key, value] of Object.entries(raw)) {
    const url = absoluteMediaUrl(value as string | null);
    if (url) out[key] = url;
  }
  return out;
}

/** The live category-shortcut icon overrides. Public read, cached ~60s. */
export function useHomepageShortcuts() {
  return useQuery<HomepageShortcutIcons>({
    queryKey: homepageShortcutsQueryKey,
    queryFn: getHomepageShortcuts,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Promo marquee text -> usePromoText()
// ---------------------------------------------------------------------------

/** One active promo marquee line. */
export interface PromoTextItem {
  id: string;
  message: string;
  position: number;
  status: string;
}

interface RawPromoTextResponse {
  ok: true;
  items?: Array<Record<string, unknown>>;
}

/** GET /api/content/promo-text. Public read. Active promo lines in display order. */
export async function getPromoText(): Promise<PromoTextItem[]> {
  const res = await api.get<RawPromoTextResponse>('/api/content/promo-text', { auth: false });
  const rows = Array.isArray(res.items) ? res.items : [];
  return rows
    .filter((r) => str(r.id) !== null && str(r.message) !== null)
    .map((r) => ({
      id: String(r.id),
      message: strOr(r.message, ''),
      position: numOr(r.position, 0),
      status: strOr(r.status, 'active'),
    }));
}

/** The live promo marquee feed. Public read, cached ~60s. Empty list renders nothing. */
export function usePromoText() {
  return useQuery<PromoTextItem[]>({
    queryKey: promoTextQueryKey,
    queryFn: getPromoText,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Homepage videos -> useHomepageVideos()
// ---------------------------------------------------------------------------

/** One homepage video card. `sourceType` picks the player: hosted YouTube or an uploaded file. */
export interface HomepageVideo {
  id: string;
  titleEn: string | null;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  sourceType: 'youtube' | 'upload';
  youtubeVideoId: string | null;
  /** Absolute upload URL, or null for a YouTube source. */
  videoUrl: string | null;
  /** Absolute thumbnail/poster URL, or null. */
  thumbnailUrl: string | null;
  /** Optional "learn more" target; a link, not media, so left as stored. */
  ctaUrl: string | null;
  sortOrder: number;
}

interface RawVideosResponse {
  ok: true;
  videos?: Array<Record<string, unknown>>;
}

/** GET /api/content/homepage-videos. Public read. Video deck in carousel order. */
export async function getHomepageVideos(): Promise<HomepageVideo[]> {
  const res = await api.get<RawVideosResponse>('/api/content/homepage-videos', { auth: false });
  const rows = Array.isArray(res.videos) ? res.videos : [];
  return rows
    .filter((r) => str(r.id) !== null)
    .map((r) => ({
      id: String(r.id),
      titleEn: str(r.titleEn),
      titleBn: str(r.titleBn),
      subtitleEn: str(r.subtitleEn),
      subtitleBn: str(r.subtitleBn),
      sourceType: r.sourceType === 'upload' ? 'upload' : 'youtube',
      youtubeVideoId: str(r.youtubeVideoId),
      videoUrl: absoluteMediaUrl(r.videoUrl as string | null),
      thumbnailUrl: absoluteMediaUrl(r.thumbnailUrl as string | null),
      ctaUrl: str(r.ctaUrl),
      sortOrder: numOr(r.sortOrder, 0),
    }));
}

/** The live homepage video deck. Public read, cached ~60s. Empty list falls back to the ambassador card. */
export function useHomepageVideos() {
  return useQuery<HomepageVideo[]>({
    queryKey: homepageVideosQueryKey,
    queryFn: getHomepageVideos,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Ambassador + promo video -> useAmbassador()
// ---------------------------------------------------------------------------

export interface AmbassadorPerson {
  name: string | null;
  caption: string | null;
  /** Absolute portrait URL, or null. */
  imageUrl: string | null;
}

export interface AmbassadorVideo {
  title: string | null;
  caption: string | null;
  /** Watch link (often an external YouTube URL); a link, not media, so left as stored. */
  url: string | null;
  /** Absolute poster URL, or null. */
  posterUrl: string | null;
}

export interface Ambassador {
  active: boolean;
  ambassador: AmbassadorPerson;
  video: AmbassadorVideo;
}

interface RawAmbassadorResponse {
  ok: true;
  active?: boolean;
  ambassador?: Record<string, unknown>;
  video?: Record<string, unknown>;
}

/** GET /api/content/ambassador. Public read. Brand ambassador + promo video content. */
export async function getAmbassador(): Promise<Ambassador> {
  const res = await api.get<RawAmbassadorResponse>('/api/content/ambassador', { auth: false });
  const a = (res.ambassador ?? {}) as Record<string, unknown>;
  const v = (res.video ?? {}) as Record<string, unknown>;
  return {
    active: res.active !== false,
    ambassador: {
      name: str(a.name),
      caption: str(a.caption),
      imageUrl: absoluteMediaUrl(a.imageUrl as string | null),
    },
    video: {
      title: str(v.title),
      caption: str(v.caption),
      url: str(v.url),
      posterUrl: absoluteMediaUrl(v.posterUrl as string | null),
    },
  };
}

/** The live ambassador/promo-video content. Public read, cached ~60s. */
export function useAmbassador() {
  return useQuery<Ambassador>({
    queryKey: ambassadorQueryKey,
    queryFn: getAmbassador,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Promo pair (Refer & Earn / Betting Pass) -> usePromoPair()
// ---------------------------------------------------------------------------

/** One promo-pair marketing card. Bilingual copy; any field may be null. */
export interface PromoPairSlot {
  kicker: string | null;
  kickerBn: string | null;
  title: string | null;
  titleBn: string | null;
  body: string | null;
  bodyBn: string | null;
  cta: string | null;
  ctaBn: string | null;
  /** Tap target (may be an absolute site URL); a link, not media, so left as stored. */
  href: string | null;
  /** Absolute background/art URL, or null. */
  imageUrl: string | null;
  imageOnly: boolean;
  overlayEnabled: boolean;
}

export interface PromoPair {
  refer: PromoPairSlot;
  pass: PromoPairSlot;
}

interface RawPromoPairResponse {
  ok: true;
  refer?: Record<string, unknown>;
  pass?: Record<string, unknown>;
}

function mapPromoSlot(raw: unknown): PromoPairSlot {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    kicker: str(r.kicker),
    kickerBn: str(r.kickerBn),
    title: str(r.title),
    titleBn: str(r.titleBn),
    body: str(r.body),
    bodyBn: str(r.bodyBn),
    cta: str(r.cta),
    ctaBn: str(r.ctaBn),
    href: str(r.href),
    imageUrl: absoluteMediaUrl(r.imageUrl as string | null),
    imageOnly: r.imageOnly === true,
    overlayEnabled: r.overlayEnabled !== false,
  };
}

/** GET /api/content/homepage-promo-pair. Public read. The two marketing cards. */
export async function getPromoPair(): Promise<PromoPair> {
  const res = await api.get<RawPromoPairResponse>('/api/content/homepage-promo-pair', { auth: false });
  return {
    refer: mapPromoSlot(res.refer),
    pass: mapPromoSlot(res.pass),
  };
}

/** The live promo-pair cards. Public read, cached ~60s. */
export function usePromoPair() {
  return useQuery<PromoPair>({
    queryKey: promoPairQueryKey,
    queryFn: getPromoPair,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Game categories -> useCategories()
// ---------------------------------------------------------------------------

/** One active game category, in admin display order. */
export interface GameCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string | null;
  iconKey: string | null;
  /** Absolute admin-uploaded icon URL, or null (fall back to the iconKey glyph). */
  iconImageUrl: string | null;
  position: number;
}

interface RawCategoriesResponse {
  ok: true;
  categories?: Array<Record<string, unknown>>;
}

/** GET /api/content/categories. Public read. Active categories in display order. */
export async function getCategories(): Promise<GameCategory[]> {
  const res = await api.get<RawCategoriesResponse>('/api/content/categories', { auth: false });
  const rows = Array.isArray(res.categories) ? res.categories : [];
  return rows
    .filter((r) => str(r.id) !== null)
    .map((r) => ({
      id: String(r.id),
      slug: strOr(r.slug, ''),
      nameEn: strOr(r.nameEn, ''),
      nameBn: str(r.nameBn),
      iconKey: str(r.iconKey),
      iconImageUrl: absoluteMediaUrl(r.iconImageUrl as string | null),
      position: numOr(r.position, 0),
    }));
}

/** The live game categories. Public read, cached ~60s. */
export function useCategories() {
  return useQuery<GameCategory[]>({
    queryKey: categoriesQueryKey,
    queryFn: getCategories,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// APK download -> useApk()
// ---------------------------------------------------------------------------

/** The Android APK download info. `url` is null until an admin sets it. */
export interface Apk {
  /** Absolute download URL, or null when no build is published. */
  url: string | null;
  version: string | null;
}

interface RawApkResponse {
  ok: true;
  url?: string | null;
  version?: string | null;
}

/** GET /api/content/apk. Public read. The published Android build, if any. */
export async function getApk(): Promise<Apk> {
  const res = await api.get<RawApkResponse>('/api/content/apk', { auth: false });
  return {
    url: absoluteMediaUrl(res.url ?? null),
    version: str(res.version),
  };
}

/** The live APK download info. Public read, cached ~60s. */
export function useApk() {
  return useQuery<Apk>({
    queryKey: apkQueryKey,
    queryFn: getApk,
    staleTime: 60_000,
  });
}
