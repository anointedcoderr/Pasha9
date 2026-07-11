// Built by Anointed Coder.
//
// Typed API functions for the live Pasha9 WinGo colour-prediction game.
// Three read/write surfaces mapped onto the exact backend contracts:
//   - getWingoState(mode)      GET  /api/games/wingo/state?mode=  (public)
//   - placeWingoBet(input)     POST /api/games/wingo/bet          (authed)
//   - getWingoMyBets(mode)     GET  /api/games/wingo/my-bets      (authed)
//
// These are thin: they shape the request, call the shared client, and return
// typed payloads. The { ok } envelope unwrap and the 401 refresh live in
// lib/api/client.ts. Real money moves through placeWingoBet, so each bet-slip
// submission carries a stable idempotencyKey (see newIdempotencyKey): the
// server user-scoped idempotency reuses the first placement for a repeated key,
// so a retry of the same slip can never double-debit the wallet.

import { api } from './client';

// ---------------------------------------------------------------------------
// Mode identity (mirrors apps/web/lib/wingo/config.ts, read-only reference)
// ---------------------------------------------------------------------------

export type WingoMode = 'wingo_30s' | 'wingo_1m' | 'wingo_3m' | 'wingo_5m';

export const WINGO_MODES: { key: WingoMode; label: string; seconds: number }[] = [
  { key: 'wingo_30s', label: '30s', seconds: 30 },
  { key: 'wingo_1m', label: '1m', seconds: 60 },
  { key: 'wingo_3m', label: '3m', seconds: 180 },
  { key: 'wingo_5m', label: '5m', seconds: 300 },
];

// ---------------------------------------------------------------------------
// State (GET /api/games/wingo/state?mode=)
// ---------------------------------------------------------------------------

/** Per-round total-return multipliers, frozen onto the live round. */
export interface WingoPaytable {
  colorGreen: number;
  colorRed: number;
  colorViolet: number;
  colorHalf: number;
  number: number;
  big: number;
  small: number;
}

export type WingoPhase = 'open' | 'closed';

export interface WingoRound {
  roundId: string;
  periodNumber: string;
  phase: WingoPhase;
  secondsRemaining: number;
  startsAt: string;
  betCloseAt: string;
  drawsAt: string;
  serverSeedHash: string;
}

export interface WingoNextRound {
  periodNumber: string;
  startsAt: string;
  betCloseAt: string;
  drawsAt: string;
}

export interface WingoResult {
  periodNumber: string;
  result: number;
  color: string; // red | green | red_violet | green_violet
  size: string; // big | small
  drawnAt: string | null;
}

export interface WingoState {
  enabled: boolean;
  modeEnabled: boolean;
  mode: WingoMode;
  minStake: number;
  maxStake: number;
  paytable: WingoPaytable;
  serverTime: string;
  round: WingoRound | null;
  next: WingoNextRound | null;
  results: WingoResult[];
}

interface WingoStateResponse extends WingoState {
  ok: true;
}

const DEFAULT_PAYTABLE: WingoPaytable = {
  colorGreen: 2,
  colorRed: 2,
  colorViolet: 4.5,
  colorHalf: 1.5,
  number: 9,
  big: 2,
  small: 2,
};

function coercePaytable(raw: unknown): WingoPaytable {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const field = (key: keyof WingoPaytable): number => {
    const v = Number(o[key]);
    return Number.isFinite(v) && v >= 0 ? v : DEFAULT_PAYTABLE[key];
  };
  return {
    colorGreen: field('colorGreen'),
    colorRed: field('colorRed'),
    colorViolet: field('colorViolet'),
    colorHalf: field('colorHalf'),
    number: field('number'),
    big: field('big'),
    small: field('small'),
  };
}

/**
 * GET /api/games/wingo/state?mode=. Public so the countdown and history strip
 * render before the player signs in. Returns the live round window, phase,
 * seconds remaining, the frozen paytable, the enable gates and recent results.
 */
export async function getWingoState(mode: WingoMode): Promise<WingoState> {
  const res = await api.get<WingoStateResponse>(
    `/api/games/wingo/state?mode=${encodeURIComponent(mode)}`,
    { auth: false },
  );
  return {
    enabled: Boolean(res.enabled),
    modeEnabled: Boolean(res.modeEnabled),
    mode: (res.mode as WingoMode) ?? mode,
    minStake: Number(res.minStake) || 1,
    maxStake: Number(res.maxStake) || 100_000,
    paytable: coercePaytable(res.paytable),
    serverTime: typeof res.serverTime === 'string' ? res.serverTime : new Date().toISOString(),
    round: res.round ?? null,
    next: res.next ?? null,
    results: Array.isArray(res.results) ? res.results : [],
  };
}

// ---------------------------------------------------------------------------
// Place bet (POST /api/games/wingo/bet)
// ---------------------------------------------------------------------------

export type WingoBetType = 'color' | 'number' | 'size';

/** One staked line. Field names match the backend line schema exactly. */
export interface WingoBetLine {
  betType: WingoBetType;
  /** green|red|violet for color, "0".."9" for number, big|small for size. */
  selection: string;
  /** Unit stake (>= minStake). */
  stake: number;
  /** Quantity / multiplier chip, 1..100. stake * quantity <= maxStake. */
  quantity: number;
}

export interface PlaceWingoBetInput {
  mode: WingoMode;
  lines: WingoBetLine[];
  /** Stable per-slip key. REUSE it on a retry so a repeat never double-debits. */
  idempotencyKey: string;
}

export interface PlacedWingoBet {
  betId: string;
  betType: string;
  selection: string;
  stake: number;
  quantity: number;
  betAmount: number;
}

export interface PlaceWingoBetResult {
  balance: number;
  roundId: string;
  periodNumber: string;
  mode: WingoMode;
  betCloseAt: string;
  drawsAt: string;
  totalStake: number;
  /** True when the server matched this key to an earlier placement. */
  reused: boolean;
  bets: PlacedWingoBet[];
}

interface PlaceWingoBetResponse extends PlaceWingoBetResult {
  ok: true;
}

/**
 * POST /api/games/wingo/bet. Stakes every line of the slip on the current
 * round of the mode in one request; the whole slip debits the wallet once.
 * Bet close is enforced server-side, so a stale UI can never sneak a wager in.
 */
export async function placeWingoBet(input: PlaceWingoBetInput): Promise<PlaceWingoBetResult> {
  const res = await api.post<PlaceWingoBetResponse>('/api/games/wingo/bet', {
    mode: input.mode,
    bets: input.lines.map((l) => ({
      betType: l.betType,
      selection: l.selection,
      stake: l.stake,
      quantity: l.quantity,
    })),
    idempotencyKey: input.idempotencyKey,
  });
  return {
    balance: Number(res.balance) || 0,
    roundId: res.roundId,
    periodNumber: res.periodNumber,
    mode: (res.mode as WingoMode) ?? input.mode,
    betCloseAt: res.betCloseAt,
    drawsAt: res.drawsAt,
    totalStake: Number(res.totalStake) || 0,
    reused: Boolean(res.reused),
    bets: Array.isArray(res.bets) ? res.bets : [],
  };
}

/**
 * A stable idempotency key for one bet-slip submission. Generated once when the
 * slip is first submitted and REUSED verbatim on any retry of the same slip, so
 * a network-ambiguous retry maps to the same server-side placement instead of a
 * second debit. Prefers a real UUID where the runtime exposes one; otherwise
 * falls back to a timestamp + random composite (uniqueness, not secrecy, is all
 * that is needed here).
 */
export function newIdempotencyKey(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') {
    return `wingo-${g.crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `wingo-${Date.now().toString(36)}-${rand}`;
}

// ---------------------------------------------------------------------------
// My history (GET /api/games/wingo/my-bets)
// ---------------------------------------------------------------------------

export type WingoBetStatus = 'PENDING' | 'WON' | 'LOST' | 'REFUNDED' | string;

export interface WingoMyBet {
  id: string;
  roundId: string;
  mode: string;
  periodNumber: string;
  betType: string;
  selection: string;
  stake: number;
  quantity: number;
  betAmount: number;
  status: WingoBetStatus;
  payoutMultiplier: number;
  payoutAmount: number;
  result: number | null;
  resultColor: string | null;
  resultSize: string | null;
  roundStatus: string;
  drawsAt: string;
  createdAt: string;
  settledAt: string | null;
}

export interface WingoMyBetsPage {
  bets: WingoMyBet[];
  nextBefore: string | null;
}

interface WingoMyBetsResponse {
  ok: true;
  bets: WingoMyBet[];
  nextBefore: string | null;
}

export interface WingoMyBetsQuery {
  mode?: WingoMode;
  limit?: number;
  before?: string;
}

/**
 * GET /api/games/wingo/my-bets. The signed-in player's bets newest first, each
 * with the round's drawn result joined in so a row can render won/lost + payout
 * without a second call. Keyset-paginated via `before` (createdAt ISO).
 */
export async function getWingoMyBets(query: WingoMyBetsQuery = {}): Promise<WingoMyBetsPage> {
  const params = new URLSearchParams();
  if (query.mode) params.set('mode', query.mode);
  params.set('limit', String(query.limit ?? 20));
  if (query.before) params.set('before', query.before);
  const res = await api.get<WingoMyBetsResponse>(`/api/games/wingo/my-bets?${params.toString()}`);
  return {
    bets: Array.isArray(res.bets) ? res.bets : [],
    nextBefore: typeof res.nextBefore === 'string' ? res.nextBefore : null,
  };
}
