// Built by Anointed Coder.
//
// Live home-screen content: the public banner slider and the jackpot strip.
// Every function is thin: shape the request, call the shared client, return a
// typed payload. The { ok } envelope unwrap and the 401 refresh live in
// lib/api/client.ts. Both reads are PUBLIC (auth:false) so the home screen
// renders on a signed-out shell, and lightly cached (~60s) since content only
// changes when an admin edits it.
//
// Honesty first: nothing here invents a value. An artwork-only banner simply
// carries empty title/subtitle, and a jackpot tier with no real number is left
// numberless rather than filled with a placeholder.
//
// Backend contracts (read-only reference):
//   GET /api/content/banners
//     -> { ok, banners: [{ id, title, subtitle, titleEn, subtitleEn, mediaType,
//          imageUrl, videoUrl, posterUrl, link, ctaLabel, accent, position,
//          status }] }
//        Bilingual; any field may be empty and the list may be empty. Uploaded
//        media comes back as a site-relative path ("/uploads/...").
//   GET /api/content/jackpot
//     -> { ok, enabled, title, subtitle, backgroundUrl,
//          mini|grand|major: { title, iconUrl, value } }
//        In production title/subtitle are empty and every .value is null, so
//        there is no real pool number to show.

import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { API_BASE_URL } from '../config';
import type { BannerAccent, HeroBanner } from '@/lib/mock/banners';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const bannersQueryKey = ['content', 'banners'] as const;
export const jackpotQueryKey = ['content', 'jackpot'] as const;

// ---------------------------------------------------------------------------
// Small defensive coercers (mirrors the shape used elsewhere in lib/api)
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

/** A finite number, or null. Never coerces null/'' into 0 (that would fabricate a value). */
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Resolve a stored media path into an absolute URL the image loader can fetch.
 * Uploaded content comes back site-relative ("/uploads/..."), which expo-image
 * cannot load on native, so we prefix the API origin. Absolute http(s) URLs and
 * empty values are returned unchanged / as null.
 */
export function absoluteMediaUrl(path: string | null | undefined): string | null {
  const p = typeof path === 'string' ? path.trim() : '';
  if (!p) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${API_BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`;
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

const ACCENTS: BannerAccent[] = ['gold', 'blue', 'hot', 'neon', 'royal'];

function normalizeAccent(v: unknown): BannerAccent {
  return typeof v === 'string' && (ACCENTS as string[]).includes(v) ? (v as BannerAccent) : 'gold';
}

/** One live hero banner. `title`/`subtitle` are the native (bn) copy; the *En fields are the English copy. */
export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  titleEn: string | null;
  subtitleEn: string | null;
  mediaType: string;
  /** Absolute image URL, or null (e.g. a video banner has none). */
  imageUrl: string | null;
  /** Absolute poster still, used as the image for a video banner. */
  posterUrl: string | null;
  /** Absolute video URL for a video banner, or null. Opened externally on tap. */
  videoUrl: string | null;
  /** Tap target: an internal app path, an external URL, or null. */
  link: string | null;
  ctaLabel: string | null;
  accent: BannerAccent;
  position: number;
  status: string;
}

interface BannersResponse {
  ok: true;
  banners?: Array<Record<string, unknown>>;
}

function mapBanner(r: Record<string, unknown>): Banner {
  return {
    id: String(r.id ?? ''),
    title: typeof r.title === 'string' ? r.title : '',
    subtitle: typeof r.subtitle === 'string' ? r.subtitle : '',
    titleEn: str(r.titleEn),
    subtitleEn: str(r.subtitleEn),
    mediaType: typeof r.mediaType === 'string' ? r.mediaType : 'image',
    imageUrl: absoluteMediaUrl(r.imageUrl as string | null),
    posterUrl: absoluteMediaUrl(r.posterUrl as string | null),
    videoUrl: absoluteMediaUrl(r.videoUrl as string | null),
    link: str(r.link),
    ctaLabel: str(r.ctaLabel),
    accent: normalizeAccent(r.accent),
    position: typeof r.position === 'number' ? r.position : 0,
    status: typeof r.status === 'string' ? r.status : 'active',
  };
}

/** The still image for a banner: the uploaded image, or a video banner's poster. */
export function bannerImageUrl(b: Banner): string | null {
  return b.imageUrl ?? b.posterUrl;
}

/** A banner's tap target: its stored link, else null (the caller falls back to /games). */
export function bannerLink(b: Banner): string | null {
  return b.link;
}

/**
 * Map a live banner into the HeroCarousel's HeroBanner shape. Prefers the
 * English copy, falls back to the native copy, and invents nothing: an
 * artwork-only banner keeps empty title/subtitle.
 */
export function toHeroBanner(b: Banner): HeroBanner {
  return {
    id: b.id,
    title: b.titleEn ?? (b.title || ''),
    subtitle: b.subtitleEn ?? (b.subtitle || ''),
    ctaLabel: 'View',
    accent: b.accent,
    imageUrl: bannerImageUrl(b) ?? '',
  };
}

/** GET /api/content/banners. Public read. Keeps only active banners that carry a real image. */
export async function getBanners(): Promise<Banner[]> {
  const res = await api.get<BannersResponse>('/api/content/banners', { auth: false });
  const rows = Array.isArray(res.banners) ? res.banners : [];
  return rows
    .filter((r) => typeof r.id === 'string' && r.id.length > 0)
    .map(mapBanner)
    .filter((b) => b.status === 'active' && bannerImageUrl(b) !== null);
}

/**
 * The live hero banners. Public (no auth) so they render on a guest shell, and
 * cached ~60s since they only change on an admin edit.
 */
export function useBanners() {
  return useQuery<Banner[]>({
    queryKey: bannersQueryKey,
    queryFn: getBanners,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Jackpot
// ---------------------------------------------------------------------------

/** One jackpot tier. `value` is null when the backend has no real pool number. */
export interface JackpotTier {
  title: string | null;
  iconUrl: string | null;
  value: number | null;
}

export interface Jackpot {
  enabled: boolean;
  title: string | null;
  subtitle: string | null;
  backgroundUrl: string | null;
  mini: JackpotTier;
  grand: JackpotTier;
  major: JackpotTier;
}

interface JackpotResponse {
  ok: true;
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  backgroundUrl?: string | null;
  mini?: unknown;
  grand?: unknown;
  major?: unknown;
}

function mapTier(t: unknown): JackpotTier {
  const r = (t ?? {}) as Record<string, unknown>;
  return {
    title: str(r.title),
    iconUrl: absoluteMediaUrl(r.iconUrl as string | null),
    value: numOrNull(r.value),
  };
}

/** GET /api/content/jackpot. Public read. */
export async function getJackpot(): Promise<Jackpot> {
  const res = await api.get<JackpotResponse>('/api/content/jackpot', { auth: false });
  return {
    enabled: res.enabled === true,
    title: str(res.title),
    subtitle: str(res.subtitle),
    backgroundUrl: absoluteMediaUrl(res.backgroundUrl ?? null),
    mini: mapTier(res.mini),
    grand: mapTier(res.grand),
    major: mapTier(res.major),
  };
}

/**
 * The live jackpot content. Public (no auth) so it renders on a guest shell,
 * and cached ~60s since it only changes on an admin edit.
 */
export function useJackpot() {
  return useQuery<Jackpot>({
    queryKey: jackpotQueryKey,
    queryFn: getJackpot,
    staleTime: 60_000,
  });
}

/** A tier is showable only when it carries a real, positive pool number. */
export function tierHasValue(t: JackpotTier): t is JackpotTier & { value: number } {
  return typeof t.value === 'number' && t.value > 0;
}

/**
 * Whether the jackpot payload has anything real to render: it must be enabled
 * AND carry a non-empty title, a real tier number, or a background image.
 * Otherwise the strip renders nothing (never a fabricated pool).
 */
export function jackpotHasContent(j: Jackpot): boolean {
  if (!j.enabled) return false;
  const hasValue = [j.mini, j.grand, j.major].some(tierHasValue);
  return !!j.title || hasValue || !!j.backgroundUrl;
}
