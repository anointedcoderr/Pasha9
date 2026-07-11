// Built by Anointed Coder.
//
// Live Pasha9 sports surface: the typed fetch function AND its react-query
// hook for the real sports-events feed (public content read). Mirrors the
// self-contained pattern of lib/api/rewards.ts.
//
// Contract (read-only reference):
//   GET /api/content/sports-events   (public)
//     -> { ok, events: [{ id, sportType, status ("live"|"upcoming"|...),
//          leagueNameEn, leagueNameBn, startsAt (ISO),
//          teamAName, teamAShortName, teamALogoUrl,
//          teamBName, teamBShortName, teamBLogoUrl,
//          providerName, deepLinkUrl, sortOrder }] }
//
// deepLinkUrl is the real sportsbook link the player opens to place a bet.
// The team logo URLs come back as site-relative paths (/uploads/...), so we
// resolve them to absolute URLs here and hand the screen ready-to-render
// values. The { ok } envelope unwrap lives in lib/api/client.ts.

import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { API_BASE_URL } from '../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One real sports event surfaced to the mobile sportsbook screen. */
export interface SportEvent {
  id: string;
  sportType: string;
  status: string;
  leagueNameEn: string | null;
  leagueNameBn: string | null;
  startsAt: string | null;
  teamAName: string;
  teamAShortName: string | null;
  /** Absolute logo URL, or null when the event carries no crest. */
  teamALogoUrl: string | null;
  teamBName: string;
  teamBShortName: string | null;
  /** Absolute logo URL, or null when the event carries no crest. */
  teamBLogoUrl: string | null;
  providerName: string | null;
  /** Absolute sportsbook deep link the player opens to place a bet. */
  deepLinkUrl: string;
  sortOrder: number;
}

interface SportsEventsResponse {
  ok: true;
  events?: Array<{
    id?: string;
    sportType?: string | null;
    status?: string | null;
    leagueNameEn?: string | null;
    leagueNameBn?: string | null;
    startsAt?: string | null;
    teamAName?: string | null;
    teamAShortName?: string | null;
    teamALogoUrl?: string | null;
    teamBName?: string | null;
    teamBShortName?: string | null;
    teamBLogoUrl?: string | null;
    providerName?: string | null;
    deepLinkUrl?: string | null;
    sortOrder?: number | null;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a possibly-relative asset path to an absolute URL against the API
 * origin. Returns null for empty/missing values so the screen can fall back
 * to a placeholder rather than render a broken image.
 */
function absoluteUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${API_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

/**
 * GET /api/content/sports-events. Public read: the sportsbook screen renders
 * the real fixture list before the player signs in (the launch itself is what
 * gates on auth). Only rows with a real id are surfaced; a row without a
 * deep link renders as a disabled "Not available yet" card in the UI.
 */
export async function getSportsEvents(): Promise<SportEvent[]> {
  const res = await api.get<SportsEventsResponse>('/api/content/sports-events', { auth: false });
  const rows = Array.isArray(res.events) ? res.events : [];
  return rows
    .filter((e) => typeof e.id === 'string' && e.id.length > 0)
    .map((e) => ({
      id: String(e.id),
      sportType: typeof e.sportType === 'string' ? e.sportType : '',
      status: typeof e.status === 'string' ? e.status : '',
      leagueNameEn: typeof e.leagueNameEn === 'string' ? e.leagueNameEn : null,
      leagueNameBn: typeof e.leagueNameBn === 'string' ? e.leagueNameBn : null,
      startsAt: typeof e.startsAt === 'string' ? e.startsAt : null,
      teamAName: typeof e.teamAName === 'string' ? e.teamAName : '',
      teamAShortName: typeof e.teamAShortName === 'string' ? e.teamAShortName : null,
      teamALogoUrl: absoluteUrl(e.teamALogoUrl),
      teamBName: typeof e.teamBName === 'string' ? e.teamBName : '',
      teamBShortName: typeof e.teamBShortName === 'string' ? e.teamBShortName : null,
      teamBLogoUrl: absoluteUrl(e.teamBLogoUrl),
      providerName: typeof e.providerName === 'string' ? e.providerName : null,
      deepLinkUrl: typeof e.deepLinkUrl === 'string' ? e.deepLinkUrl : '',
      sortOrder: Number(e.sortOrder) || 0,
    }));
}

// ---------------------------------------------------------------------------
// Query key + hook
// ---------------------------------------------------------------------------

export const sportsEventsQueryKey = ['content', 'sports-events'] as const;

/**
 * The real sports-events feed. Public (no auth gate) so fixtures render on the
 * guest shell; cached ~60s since the feed only changes when an admin updates
 * the schedule.
 */
export function useSportsEvents() {
  return useQuery<SportEvent[]>({
    queryKey: sportsEventsQueryKey,
    queryFn: getSportsEvents,
    staleTime: 60_000,
  });
}
