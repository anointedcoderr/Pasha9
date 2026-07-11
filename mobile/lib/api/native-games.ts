// Built by Anointed Coder.
//
// Typed API functions for the live Pasha9 Native Games (dice, mines, keno,
// roulette, crash). Every function is thin: it shapes the request, calls the
// shared client, and returns a typed payload. The { ok } envelope unwrap and
// the 401 refresh live in lib/api/client.ts.
//
// Real money moves through the bet + mines-action endpoints, so:
//   - Each single-shot bet (dice/keno/roulette/crash) and each mines start
//     carries a stable idempotencyKey: the server user-scoped idempotency
//     reuses the first settlement for a repeated key, so a network-ambiguous
//     retry of the SAME action can never double-debit the wallet.
//   - Every wager runs against a provably-fair session (createNativeSession);
//     the session's nonce ticks server-side per settled round.
//
// Backend contracts (read-only reference):
//   GET  /api/native-games/[code]                 -> { enabled, game }
//   POST /api/native-games/[code]/sessions        -> { session }
//   POST /api/native-games/[code]/bet             -> per-game settle result
//   POST /api/native-games/mines/action           -> reveal | cashout result
// Per-game bet bodies:
//   dice     -> { sessionId, target, direction, betAmount, idempotencyKey? }
//   mines    -> { sessionId, mineCount, betAmount, idempotencyKey? }  (start)
//   keno     -> { sessionId, picks, betAmount, idempotencyKey? }
//   roulette -> { sessionId, betType, straightNumber?, betAmount, idempotencyKey? }
//   crash    -> { sessionId, targetMultiplier, betAmount, idempotencyKey? }
//
// NOTE on Crash: the backend Crash contract is a SINGLE-SHOT auto-cashout bet
// (the player commits a target multiplier up front and the round settles at
// once against the drawn crash point). It is NOT an interactive
// bet-then-cashout stream. The mobile screen mirrors the real contract.

import { api } from './client';

// ---------------------------------------------------------------------------
// Game identity
// ---------------------------------------------------------------------------

export type NativeGameCode = 'dice' | 'mines' | 'keno' | 'roulette' | 'crash';

// ---------------------------------------------------------------------------
// Per-game config shapes (mirror apps/web/lib/native-games/config.ts)
// ---------------------------------------------------------------------------

export interface DiceConfig {
  minTarget: number;
  maxTarget: number;
}
export interface MinesConfig {
  gridSize: number;
  minMines: number;
  maxMines: number;
}
export interface KenoConfig {
  poolSize: number;
  drawCount: number;
  minPicks: number;
  maxPicks: number;
}
export interface RouletteConfig {
  wheelSize: number;
}
export interface CrashConfig {
  minTargetMultiplier: number;
  maxTargetMultiplier: number;
  maxCrashMultiplier: number;
}

export interface NativeGame {
  gameCode: NativeGameCode;
  displayName: string;
  isActive: boolean;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  config: Record<string, unknown> | null;
}

export interface NativeGameView {
  /** Global native-games master flag (SystemSetting native_games_enabled). */
  enabled: boolean;
  game: NativeGame;
}

interface NativeGameResponse {
  ok: true;
  enabled: boolean;
  game: {
    gameCode: string;
    displayName: string;
    isActive: boolean;
    houseEdgeBps: number;
    minBet: number;
    maxBet: number;
    config: Record<string, unknown> | null;
  };
}

/**
 * GET /api/native-games/[code]. Public single-game config: the live
 * min/max/edge/config, the per-game isActive flag and the global enabled
 * flag. The screen gates the whole bet surface on `enabled && game.isActive`.
 */
export async function getNativeGame(code: NativeGameCode): Promise<NativeGameView> {
  const res = await api.get<NativeGameResponse>(`/api/native-games/${code}`, { auth: false });
  const g = res.game;
  return {
    enabled: Boolean(res.enabled),
    game: {
      gameCode: (g.gameCode as NativeGameCode) ?? code,
      displayName: typeof g.displayName === 'string' ? g.displayName : code,
      isActive: Boolean(g.isActive),
      houseEdgeBps: Number(g.houseEdgeBps) || 0,
      minBet: Number(g.minBet) || 0,
      maxBet: Number(g.maxBet) || 0,
      config: g.config ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Session lifecycle (POST /api/native-games/[code]/sessions)
// ---------------------------------------------------------------------------

export interface NativeSession {
  id: string;
  gameCode: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  status: string;
  createdAt: string;
}

interface CreateSessionResponse {
  ok: true;
  session: NativeSession;
}

/**
 * POST /api/native-games/[code]/sessions. Opens a fresh provably-fair session
 * for the signed-in player and returns the serverSeedHash (never the seed).
 * The same session is reused across many bets; the nonce ticks per round.
 */
export async function createNativeSession(
  code: NativeGameCode,
  clientSeed?: string,
): Promise<NativeSession> {
  const body = clientSeed && clientSeed.trim().length > 0 ? { clientSeed: clientSeed.trim() } : {};
  const res = await api.post<CreateSessionResponse>(`/api/native-games/${code}/sessions`, body);
  return res.session;
}

// ---------------------------------------------------------------------------
// Idempotency key
// ---------------------------------------------------------------------------

/**
 * A stable idempotency key for one money action. Generated once when the action
 * is first submitted and REUSED verbatim on any retry of the SAME action, so a
 * network-ambiguous retry maps to the same server-side settlement instead of a
 * second debit. Prefers a real UUID; otherwise a timestamp + random composite
 * (uniqueness, not secrecy, is all that is needed).
 */
export function newNativeIdempotencyKey(prefix: NativeGameCode | string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') {
    return `${prefix}-${g.crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

// ---------------------------------------------------------------------------
// Dice bet (POST /api/native-games/dice/bet)
// ---------------------------------------------------------------------------

export type DiceDirection = 'over' | 'under';

export interface PlaceDiceBetInput {
  sessionId: string;
  target: number;
  direction: DiceDirection;
  betAmount: number;
  idempotencyKey: string;
}

export interface DiceBetResult {
  roundId: string;
  outcome: 'WIN' | 'LOSS';
  result: number;
  multiplier: number;
  payout: number;
  win: boolean;
  winChancePct: number;
  newBalance: number;
  nonce: number;
  reused: boolean;
}

export async function placeDiceBet(input: PlaceDiceBetInput): Promise<DiceBetResult> {
  const res = await api.post<DiceBetResult & { ok: true }>('/api/native-games/dice/bet', {
    sessionId: input.sessionId,
    target: input.target,
    direction: input.direction,
    betAmount: input.betAmount,
    idempotencyKey: input.idempotencyKey,
  });
  return {
    roundId: res.roundId,
    outcome: res.outcome === 'WIN' ? 'WIN' : 'LOSS',
    result: Number(res.result) || 0,
    multiplier: Number(res.multiplier) || 0,
    payout: Number(res.payout) || 0,
    win: Boolean(res.win),
    winChancePct: Number(res.winChancePct) || 0,
    newBalance: Number(res.newBalance) || 0,
    nonce: Number(res.nonce) || 0,
    reused: Boolean(res.reused),
  };
}

// ---------------------------------------------------------------------------
// Mines: start (POST /api/native-games/mines/bet)
//        reveal + cashout (POST /api/native-games/mines/action)
// ---------------------------------------------------------------------------

export interface StartMinesInput {
  sessionId: string;
  mineCount: number;
  betAmount: number;
  idempotencyKey: string;
}

export interface MinesStartResult {
  roundId: string;
  outcome: 'PENDING';
  mineCount: number;
  totalTiles: number;
  revealedTiles: number[];
  currentMultiplier: number;
  newBalance: number;
  nonce: number;
  reused: boolean;
}

export async function startMinesRound(input: StartMinesInput): Promise<MinesStartResult> {
  const res = await api.post<MinesStartResult & { ok: true }>('/api/native-games/mines/bet', {
    sessionId: input.sessionId,
    mineCount: input.mineCount,
    betAmount: input.betAmount,
    idempotencyKey: input.idempotencyKey,
  });
  return {
    roundId: res.roundId,
    outcome: 'PENDING',
    mineCount: Number(res.mineCount) || input.mineCount,
    totalTiles: Number(res.totalTiles) || 25,
    revealedTiles: Array.isArray(res.revealedTiles) ? res.revealedTiles : [],
    currentMultiplier: Number(res.currentMultiplier) || 1,
    newBalance: Number(res.newBalance) || 0,
    nonce: Number(res.nonce) || 0,
    reused: Boolean(res.reused),
  };
}

export interface MinesRevealResult {
  roundId: string;
  outcome: 'PENDING' | 'LOSS';
  tile: number;
  hitMine: boolean;
  revealedTiles: number[];
  safeCount: number;
  currentMultiplier: number;
  newBalance: number;
  minePositions?: number[];
}

export async function revealMinesTile(roundId: string, tile: number): Promise<MinesRevealResult> {
  const res = await api.post<MinesRevealResult & { ok: true }>('/api/native-games/mines/action', {
    action: 'reveal',
    roundId,
    tile,
  });
  return {
    roundId: res.roundId,
    outcome: res.outcome === 'LOSS' ? 'LOSS' : 'PENDING',
    tile: Number(res.tile),
    hitMine: Boolean(res.hitMine),
    revealedTiles: Array.isArray(res.revealedTiles) ? res.revealedTiles : [],
    safeCount: Number(res.safeCount) || 0,
    currentMultiplier: Number(res.currentMultiplier) || 0,
    newBalance: Number(res.newBalance) || 0,
    minePositions: Array.isArray(res.minePositions) ? res.minePositions : undefined,
  };
}

export interface MinesCashoutResult {
  roundId: string;
  outcome: 'CASHOUT';
  payout: number;
  multiplier: number;
  newBalance: number;
  minePositions: number[];
  revealedTiles: number[];
}

export async function cashoutMines(roundId: string): Promise<MinesCashoutResult> {
  const res = await api.post<MinesCashoutResult & { ok: true }>('/api/native-games/mines/action', {
    action: 'cashout',
    roundId,
  });
  return {
    roundId: res.roundId,
    outcome: 'CASHOUT',
    payout: Number(res.payout) || 0,
    multiplier: Number(res.multiplier) || 0,
    newBalance: Number(res.newBalance) || 0,
    minePositions: Array.isArray(res.minePositions) ? res.minePositions : [],
    revealedTiles: Array.isArray(res.revealedTiles) ? res.revealedTiles : [],
  };
}

// ---------------------------------------------------------------------------
// Keno bet (POST /api/native-games/keno/bet)
// ---------------------------------------------------------------------------

export interface PlaceKenoBetInput {
  sessionId: string;
  picks: number[];
  betAmount: number;
  idempotencyKey: string;
}

export interface KenoBetResult {
  roundId: string;
  outcome: 'WIN' | 'LOSS';
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  nonce: number;
  reused: boolean;
  draw: number[];
  matches: number[];
  matchCount: number;
}

export async function placeKenoBet(input: PlaceKenoBetInput): Promise<KenoBetResult> {
  const res = await api.post<KenoBetResult & { ok: true }>('/api/native-games/keno/bet', {
    sessionId: input.sessionId,
    picks: input.picks,
    betAmount: input.betAmount,
    idempotencyKey: input.idempotencyKey,
  });
  return {
    roundId: res.roundId,
    outcome: res.outcome === 'WIN' ? 'WIN' : 'LOSS',
    win: Boolean(res.win),
    multiplier: Number(res.multiplier) || 0,
    payout: Number(res.payout) || 0,
    newBalance: Number(res.newBalance) || 0,
    nonce: Number(res.nonce) || 0,
    reused: Boolean(res.reused),
    draw: Array.isArray(res.draw) ? res.draw : [],
    matches: Array.isArray(res.matches) ? res.matches : [],
    matchCount: Number(res.matchCount) || 0,
  };
}

// ---------------------------------------------------------------------------
// Roulette bet (POST /api/native-games/roulette/bet)
// ---------------------------------------------------------------------------

export type RouletteBetType = 'red' | 'black' | 'odd' | 'even' | 'high' | 'low' | 'straight';

export interface PlaceRouletteBetInput {
  sessionId: string;
  betType: RouletteBetType;
  straightNumber?: number;
  betAmount: number;
  idempotencyKey: string;
}

export interface RouletteBetResult {
  roundId: string;
  outcome: 'WIN' | 'LOSS';
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  nonce: number;
  reused: boolean;
  result: number;
  resultColor: 'red' | 'black' | 'green';
}

export async function placeRouletteBet(input: PlaceRouletteBetInput): Promise<RouletteBetResult> {
  const body: Record<string, unknown> = {
    sessionId: input.sessionId,
    betType: input.betType,
    betAmount: input.betAmount,
    idempotencyKey: input.idempotencyKey,
  };
  if (input.betType === 'straight') body.straightNumber = input.straightNumber;
  const res = await api.post<RouletteBetResult & { ok: true }>('/api/native-games/roulette/bet', body);
  return {
    roundId: res.roundId,
    outcome: res.outcome === 'WIN' ? 'WIN' : 'LOSS',
    win: Boolean(res.win),
    multiplier: Number(res.multiplier) || 0,
    payout: Number(res.payout) || 0,
    newBalance: Number(res.newBalance) || 0,
    nonce: Number(res.nonce) || 0,
    reused: Boolean(res.reused),
    result: Number(res.result) || 0,
    resultColor: res.resultColor === 'red' ? 'red' : res.resultColor === 'black' ? 'black' : 'green',
  };
}

// ---------------------------------------------------------------------------
// Crash bet (POST /api/native-games/crash/bet) - single-shot auto cash out
// ---------------------------------------------------------------------------

export interface PlaceCrashBetInput {
  sessionId: string;
  targetMultiplier: number;
  betAmount: number;
  idempotencyKey: string;
}

export interface CrashBetResult {
  roundId: string;
  outcome: 'WIN' | 'LOSS';
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  nonce: number;
  reused: boolean;
  crashPoint: number;
  targetMultiplier: number;
}

export async function placeCrashBet(input: PlaceCrashBetInput): Promise<CrashBetResult> {
  const res = await api.post<CrashBetResult & { ok: true }>('/api/native-games/crash/bet', {
    sessionId: input.sessionId,
    targetMultiplier: input.targetMultiplier,
    betAmount: input.betAmount,
    idempotencyKey: input.idempotencyKey,
  });
  return {
    roundId: res.roundId,
    outcome: res.outcome === 'WIN' ? 'WIN' : 'LOSS',
    win: Boolean(res.win),
    multiplier: Number(res.multiplier) || 0,
    payout: Number(res.payout) || 0,
    newBalance: Number(res.newBalance) || 0,
    nonce: Number(res.nonce) || 0,
    reused: Boolean(res.reused),
    crashPoint: Number(res.crashPoint) || 1,
    targetMultiplier: Number(res.targetMultiplier) || input.targetMultiplier,
  };
}
