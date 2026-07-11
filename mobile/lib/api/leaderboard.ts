// Built by Anointed Coder.
//
// Typed API functions + react-query hooks for the live Pasha9 community
// surface: the daily winnings leaderboard, the recent winners feed, the public
// contact channels, and support-ticket creation. Every function is thin: shape
// the request, call the shared client, return a typed payload. The { ok }
// envelope unwrap and the 401 refresh live in lib/api/client.ts.
//
// Backend contracts (read-only reference):
//   GET  /api/leaderboard/daily
//        -> { ok, enabled, rows:[{ rank, handle, winnings, wins }], windowHours }
//        Public read. Rows carry an already-masked handle and no avatar / userId.
//        enabled=false is an off state: render a calm empty board.
//   GET  /api/winners/recent
//        -> { ok, enabled, winners:[{ id, handle, kind, mode, rank, amount, at }] }
//        Public read. enabled=false hides the feed.
//   GET  /api/content/contacts
//        -> { ok, siteName, telegram, whatsapp, email, phone }  (any may be null)
//   POST /api/support/tickets  { subject, message, name?, email?, phone? }
//        -> 201 { ok, ticket:{ id, status, createdAt } }. A logged-in player has
//        their account attached server-side; a guest must supply an email or a
//        phone or the server returns 400 VALIDATION. Throttled with 429 RATE_LIMITED.

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from './client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const leaderboardQueryKey = ['leaderboard', 'daily'] as const;
export const recentWinnersQueryKey = ['winners', 'recent'] as const;
export const contactsQueryKey = ['content', 'contacts'] as const;

// ---------------------------------------------------------------------------
// Small defensive coercers (mirrors the shape used elsewhere in lib/api)
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Leaderboard (24h winnings)
// ---------------------------------------------------------------------------

/** One ranked row on the daily winnings board. Handle is pre-masked. */
export interface LeaderboardRow {
  rank: number;
  handle: string;
  winnings: number;
  wins: number;
}

/** The daily leaderboard payload. `enabled=false` is an off state. */
export interface LeaderboardData {
  enabled: boolean;
  rows: LeaderboardRow[];
  windowHours: number;
}

interface LeaderboardResponse {
  ok: true;
  enabled?: boolean;
  rows?: Array<Record<string, unknown>>;
  windowHours?: number;
}

function mapLeaderboardRow(r: Record<string, unknown>): LeaderboardRow {
  return {
    rank: num(r.rank),
    handle: str(r.handle) ?? '',
    winnings: num(r.winnings),
    wins: num(r.wins),
  };
}

/** GET /api/leaderboard/daily. Public read. */
export async function getLeaderboard(): Promise<LeaderboardData> {
  const res = await api.get<LeaderboardResponse>('/api/leaderboard/daily', { auth: false });
  const rows = Array.isArray(res.rows) ? res.rows.map(mapLeaderboardRow) : [];
  return {
    enabled: res.enabled !== false,
    rows,
    windowHours: typeof res.windowHours === 'number' ? res.windowHours : 24,
  };
}

/**
 * The live 24h winnings board. Public (no auth) so it renders on a guest shell,
 * and polled every 45s so the ranking stays fresh without a manual refresh.
 */
export function useLeaderboard() {
  return useQuery<LeaderboardData>({
    queryKey: leaderboardQueryKey,
    queryFn: getLeaderboard,
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
}

// ---------------------------------------------------------------------------
// Recent winners feed
// ---------------------------------------------------------------------------

export type RecentWinnerKind = 'wingo' | 'tournament';

/** One fresh win in the recent-winners feed. Handle is pre-masked. */
export interface RecentWinner {
  id: string;
  handle: string;
  kind: RecentWinnerKind;
  mode: string | null;
  rank: number | null;
  amount: number;
  at: string;
}

/** The recent-winners payload. `enabled=false` hides the feed. */
export interface RecentWinnersData {
  enabled: boolean;
  winners: RecentWinner[];
}

interface RecentWinnersResponse {
  ok: true;
  enabled?: boolean;
  winners?: Array<Record<string, unknown>>;
}

function mapRecentWinner(w: Record<string, unknown>): RecentWinner {
  const kind: RecentWinnerKind = w.kind === 'tournament' ? 'tournament' : 'wingo';
  return {
    id: str(w.id) ?? '',
    handle: str(w.handle) ?? '',
    kind,
    mode: str(w.mode),
    rank: numOrNull(w.rank),
    amount: num(w.amount),
    at: str(w.at) ?? '',
  };
}

/** GET /api/winners/recent. Public read. */
export async function getRecentWinners(): Promise<RecentWinnersData> {
  const res = await api.get<RecentWinnersResponse>('/api/winners/recent', { auth: false });
  const winners = Array.isArray(res.winners)
    ? res.winners.filter((w) => typeof w.id === 'string' && w.id.length > 0).map(mapRecentWinner)
    : [];
  return {
    enabled: res.enabled !== false,
    winners,
  };
}

/**
 * The live recent-winners feed. Public (no auth) so it renders on a guest shell,
 * and polled every 30s so new wins scroll in without a manual refresh.
 */
export function useRecentWinners() {
  return useQuery<RecentWinnersData>({
    queryKey: recentWinnersQueryKey,
    queryFn: getRecentWinners,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Contact channels
// ---------------------------------------------------------------------------

/** Live support contact handles. Any field may be null when unset. */
export interface ContactsData {
  siteName: string;
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
}

interface ContactsResponse {
  ok: true;
  siteName?: string;
  telegram?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  phone?: string | null;
}

/** GET /api/content/contacts. Public read. */
export async function getContacts(): Promise<ContactsData> {
  const res = await api.get<ContactsResponse>('/api/content/contacts', { auth: false });
  return {
    siteName: str(res.siteName) ?? 'Pasha9',
    telegram: str(res.telegram),
    whatsapp: str(res.whatsapp),
    email: str(res.email),
    phone: str(res.phone),
  };
}

/** The public contact channels, cached for a few minutes (they change rarely). */
export function useContacts() {
  return useQuery<ContactsData>({
    queryKey: contactsQueryKey,
    queryFn: getContacts,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export interface SupportTicketInput {
  subject: string;
  message: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface SupportTicket {
  id: string;
  status: string;
  createdAt: string;
}

/**
 * POST /api/support/tickets. A logged-in player has their account attached
 * server-side; a guest must include an email or phone. Returns the created
 * ticket, or throws the shared ApiError (400 VALIDATION, 429 RATE_LIMITED).
 */
export async function submitSupportTicket(input: SupportTicketInput): Promise<SupportTicket> {
  const body: Record<string, string> = {
    subject: input.subject.trim(),
    message: input.message.trim(),
  };
  const name = input.name?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  if (name) body.name = name;
  if (email) body.email = email;
  if (phone) body.phone = phone;

  const res = await api.post<{ ok: true; ticket?: Record<string, unknown> }>(
    '/api/support/tickets',
    body,
  );
  const t = res.ticket ?? {};
  return {
    id: str(t.id) ?? '',
    status: str(t.status) ?? 'open',
    createdAt: str(t.createdAt) ?? '',
  };
}

/** Support-ticket submission mutation. The screen guards against double-submit. */
export function useSubmitSupportTicket() {
  return useMutation<SupportTicket, unknown, SupportTicketInput>({
    mutationFn: submitSupportTicket,
  });
}

// ---------------------------------------------------------------------------
// Shared display helpers (used by the leaderboard screen and the home ticker)
// ---------------------------------------------------------------------------

/**
 * A human label for a recent win. WinGo wins format the mode as "WinGo 30s"
 * from "wingo_30s"; tournament wins read "Tournament - Rank #N".
 */
export function winnerLabel(w: Pick<RecentWinner, 'kind' | 'mode' | 'rank'>): string {
  if (w.kind === 'tournament') {
    return w.rank != null ? `Tournament - Rank #${w.rank}` : 'Tournament';
  }
  const suffix = w.mode ? w.mode.replace(/^wingo_/i, '') : '';
  return suffix ? `WinGo ${suffix}` : 'WinGo';
}

/**
 * A short relative-time phrase from an ISO string, e.g. "just now", "4m ago",
 * "3h ago", "2d ago". Empty string when the timestamp cannot be parsed.
 */
export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  if (diff < 45_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
