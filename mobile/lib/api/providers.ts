// Built by Anointed Coder.
//
// Typed API functions for the live Pasha9 provider (aggregator) catalog and
// game launch. Every function is thin: it shapes the request, calls the shared
// client, and returns a typed payload. The { ok } envelope unwrap and the 401
// refresh live in lib/api/client.ts.
//
// Backend contracts (read-only reference):
//   GET  /api/providers
//        -> { providers: [{ providerKey, name, adapterKey, launchMinBalance, ... }] }
//   GET  /api/providers/[providerKey]/games?q=&category=&brand=&featured=1&jackpot=1&offset=&limit=
//        -> { provider: { providerKey, name, launchMinBalance },
//             counts: { total, returned, offset, byCategory, byBrand[] },
//             games: [{ gameUid, displayName, category, imageUrl, brandKey,
//                       brandName, isFeatured, isJackpot }] }
//   POST /api/providers/[providerKey]/launch  body { gameUid }
//        -> { launchUrl, mode }
//
// The games list is a PUBLIC read (no auth) so the lobby can render before the
// player signs in. The launch is authed and money-gated: the server checks the
// wallet balance against the per-provider launchMinBalance and refuses under it
// with 402 INSUFFICIENT_FUNDS { balance, minBalance }.

import { api } from './client';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/** One active external (aggregator) provider surfaced to the lobby. */
export interface Provider {
  providerKey: string;
  name: string;
  adapterKey: string;
  launchMinBalance: number;
  lastHealthCheckOk: boolean | null;
}

interface ProvidersResponse {
  ok: true;
  providers: Array<{
    providerKey?: string;
    name?: string;
    adapterKey?: string;
    launchMinBalance?: number;
    lastHealthCheckOk?: boolean | null;
  }>;
}

/**
 * GET /api/providers. The public list of Live providers. Used by the lobby to
 * pick the main provider (its featured strip + brand pills) and by the grid
 * screens to resolve which providerKey to query.
 */
export async function getProviders(): Promise<Provider[]> {
  const res = await api.get<ProvidersResponse>('/api/providers', { auth: false });
  const rows = Array.isArray(res.providers) ? res.providers : [];
  return rows
    .filter((r) => typeof r.providerKey === 'string' && r.providerKey.length > 0)
    .map((r) => ({
      providerKey: String(r.providerKey),
      name: typeof r.name === 'string' ? r.name : String(r.providerKey),
      adapterKey: typeof r.adapterKey === 'string' ? r.adapterKey : '',
      launchMinBalance: Number(r.launchMinBalance) || 0,
      lastHealthCheckOk: typeof r.lastHealthCheckOk === 'boolean' ? r.lastHealthCheckOk : null,
    }));
}

// ---------------------------------------------------------------------------
// Provider games
// ---------------------------------------------------------------------------

/** One external game row from a provider's catalog. */
export interface ProviderGame {
  gameUid: string;
  displayName: string;
  category: string | null;
  imageUrl: string | null;
  brandKey: string | null;
  brandName: string | null;
  isFeatured: boolean;
  isJackpot: boolean;
}

/** Per-brand active game count, used to build the brand filter chips. */
export interface ProviderBrandCount {
  brandKey: string;
  brandName: string;
  count: number;
}

export interface ProviderGamesParams {
  providerKey: string;
  q?: string;
  category?: string;
  brand?: string;
  featured?: boolean;
  jackpot?: boolean;
  offset?: number;
  limit?: number;
}

export interface ProviderGamesResult {
  provider: { providerKey: string; name: string; launchMinBalance: number };
  counts: {
    total: number;
    returned: number;
    offset: number;
    byCategory: Record<string, number>;
    byBrand: ProviderBrandCount[];
  };
  games: ProviderGame[];
}

interface ProviderGamesResponse {
  ok: true;
  provider?: { providerKey?: string; name?: string; launchMinBalance?: number };
  counts?: {
    total?: number;
    returned?: number;
    offset?: number;
    byCategory?: Record<string, number>;
    byBrand?: Array<{ brandKey?: string; brandName?: string; count?: number }>;
  };
  games?: Array<{
    gameUid?: string;
    displayName?: string;
    category?: string | null;
    imageUrl?: string | null;
    brandKey?: string | null;
    brandName?: string | null;
    isFeatured?: boolean;
    isJackpot?: boolean;
  }>;
}

/**
 * GET /api/providers/[providerKey]/games. Public, filterable, paginated catalog
 * read. `featured`/`jackpot` map to the ?featured=1 / ?jackpot=1 flags; empty
 * filters are omitted so the request stays clean. counts.byBrand and
 * counts.byCategory are computed over the whole active catalog (not the filtered
 * page), so the caller can render stable brand/category chips while paging.
 */
export async function getProviderGames(params: ProviderGamesParams): Promise<ProviderGamesResult> {
  const { providerKey } = params;
  const search = new URLSearchParams();
  const q = params.q?.trim();
  if (q) search.set('q', q);
  if (params.category) search.set('category', params.category);
  if (params.brand) search.set('brand', params.brand);
  if (params.featured) search.set('featured', '1');
  if (params.jackpot) search.set('jackpot', '1');
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(Math.max(1, params.limit ?? 30), 300);
  search.set('offset', String(offset));
  search.set('limit', String(limit));

  const res = await api.get<ProviderGamesResponse>(
    `/api/providers/${encodeURIComponent(providerKey)}/games?${search.toString()}`,
    { auth: false },
  );

  const byBrand: ProviderBrandCount[] = Array.isArray(res.counts?.byBrand)
    ? res.counts!.byBrand!
        .filter((b) => typeof b.brandKey === 'string' && b.brandKey.length > 0)
        .map((b) => ({
          brandKey: String(b.brandKey),
          brandName: typeof b.brandName === 'string' ? b.brandName : String(b.brandKey),
          count: Number(b.count) || 0,
        }))
    : [];

  const games: ProviderGame[] = Array.isArray(res.games)
    ? res.games
        .filter((g) => typeof g.gameUid === 'string' && g.gameUid.length > 0)
        .map((g) => ({
          gameUid: String(g.gameUid),
          displayName: typeof g.displayName === 'string' ? g.displayName : String(g.gameUid),
          category: g.category ?? null,
          imageUrl: g.imageUrl ?? null,
          brandKey: g.brandKey ?? null,
          brandName: g.brandName ?? null,
          isFeatured: Boolean(g.isFeatured),
          isJackpot: Boolean(g.isJackpot),
        }))
    : [];

  return {
    provider: {
      providerKey: res.provider?.providerKey ?? providerKey,
      name: res.provider?.name ?? providerKey,
      launchMinBalance: Number(res.provider?.launchMinBalance) || 0,
    },
    counts: {
      total: Number(res.counts?.total) || 0,
      returned: Number(res.counts?.returned) || games.length,
      offset: Number(res.counts?.offset) || offset,
      byCategory: (res.counts?.byCategory as Record<string, number>) ?? {},
      byBrand,
    },
    games,
  };
}

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

export interface LaunchGameInput {
  providerKey: string;
  gameUid: string;
}

export interface LaunchResult {
  launchUrl: string;
  mode: string | null;
}

/**
 * POST /api/providers/[providerKey]/launch. Server-side launch: the provider
 * token + secret never touch the device; we receive only the resolved
 * launchUrl to open in an in-app browser. Throws the shared ApiError on failure
 * so the caller can branch on:
 *   401                      -> not signed in (route to login)
 *   402 INSUFFICIENT_FUNDS   -> under the provider min (meta.balance, meta.minBalance)
 *   503 PROVIDER_INACTIVE    -> provider paused
 *   ...others                -> surface ApiError.message
 */
export async function launchGame(input: LaunchGameInput): Promise<LaunchResult> {
  const res = await api.post<{ ok: true; launchUrl?: string; mode?: string | null }>(
    `/api/providers/${encodeURIComponent(input.providerKey)}/launch`,
    { gameUid: input.gameUid },
  );
  return {
    launchUrl: typeof res.launchUrl === 'string' ? res.launchUrl : '',
    mode: typeof res.mode === 'string' ? res.mode : null,
  };
}
