// Built by Anointed Coder.
//
// Pasha Native Games service layer. Sits between the route handlers
// and the engines + Prisma. Mirrors the M2F lotto-transfer transaction
// pattern: every wallet movement happens inside db.$transaction with
// an idempotencyKey-guarded GameRound row so a retried bet returns the
// stored result instead of double-debiting.
//
// Outcomes returned to the route handler:
//   - settleDiceBet     -> instant WIN | LOSS, balance moves both ways
//                          inside the same transaction.
//   - startMinesRound   -> debits the bet, leaves the round PENDING.
//                          Mine positions are kept server-side only.
//   - revealMinesTile   -> safe pick advances the multiplier, mine
//                          pick flips to LOSS (no further wallet move).
//   - cashoutMines      -> credits bet * currentMultiplier, flips to
//                          CASHOUT.
//   - rollbackRound     -> super-admin only; writes an adjust txn
//                          reversing the round and marks it CANCELLED.

import { Prisma } from '@prisma/client';
import type { GameRound, NativeGameProvider } from '@prisma/client';
import { db } from '@/lib/db/client';
import { decryptString, encryptString } from '@/lib/crypto/aead';
import {
  GAME_CODES,
  type DiceConfig,
  type MinesConfig,
  type KenoConfig,
  type RouletteConfig,
  type SlotsConfig,
  type CrashConfig,
  type GameCode,
} from './config';
import {
  generateClientSeed,
  generateServerSeed,
  hashServerSeed,
} from './provably-fair';
import { rollDice, type DiceDirection, type DiceResult } from './engine/dice';
import {
  computeMultiplier,
  generateMineGrid,
  revealTile,
} from './engine/mines';
import { rollKeno } from './engine/keno';
import { rollRoulette, type RouletteBetType } from './engine/roulette';
import { rollSlots } from './engine/slots';
import { rollCrash } from './engine/crash';

// ---------- Errors thrown to the route layer ----------
//
// The route handlers map these to HTTP statuses. Anything not in this
// list bubbles up as 500.
export const NATIVE_ERRORS = {
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  GAME_INACTIVE: 'GAME_INACTIVE',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_NOT_OWNED: 'SESSION_NOT_OWNED',
  SESSION_INACTIVE: 'SESSION_INACTIVE',
  SESSION_NOT_COMPLETED: 'SESSION_NOT_COMPLETED',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  BET_BELOW_MIN: 'BET_BELOW_MIN',
  BET_ABOVE_MAX: 'BET_ABOVE_MAX',
  ROUND_NOT_FOUND: 'ROUND_NOT_FOUND',
  ROUND_NOT_OWNED: 'ROUND_NOT_OWNED',
  ROUND_NOT_PENDING: 'ROUND_NOT_PENDING',
  ROUND_ALREADY_CANCELLED: 'ROUND_ALREADY_CANCELLED',
  MINES_NO_SAFE_REVEAL: 'MINES_NO_SAFE_REVEAL',
  MINES_TILE_ALREADY_REVEALED: 'MINES_TILE_ALREADY_REVEALED',
  MINES_TILE_OUT_OF_RANGE: 'MINES_TILE_OUT_OF_RANGE',
  MINES_INVALID_COUNT: 'MINES_INVALID_COUNT',
} as const;

// ---------- Helpers ----------

function dec(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function loadGame(gameCode: string): Promise<NativeGameProvider> {
  const game = await db.nativeGameProvider.findUnique({ where: { gameCode } });
  if (!game) throw new Error(NATIVE_ERRORS.GAME_NOT_FOUND);
  return game;
}

function assertBetInRange(game: NativeGameProvider, bet: Prisma.Decimal): void {
  if (bet.lt(dec(game.minBet))) throw new Error(NATIVE_ERRORS.BET_BELOW_MIN);
  if (bet.gt(dec(game.maxBet))) throw new Error(NATIVE_ERRORS.BET_ABOVE_MAX);
}

// ---------- Session lifecycle ----------

export interface SessionView {
  id: string;
  gameCode: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  status: string;
  createdAt: Date;
}

export async function createSession(opts: {
  userId: string;
  gameCode: GameCode;
  clientSeed?: string | null;
}): Promise<SessionView> {
  const game = await loadGame(opts.gameCode);
  if (!game.isActive) throw new Error(NATIVE_ERRORS.GAME_INACTIVE);

  const serverSeed = generateServerSeed();
  const clientSeed = opts.clientSeed && opts.clientSeed.trim().length > 0
    ? opts.clientSeed.trim().slice(0, 128)
    : generateClientSeed();

  const session = await db.gameSession.create({
    data: {
      userId: opts.userId,
      gameCode: game.gameCode,
      serverSeed: encryptString(serverSeed),
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed,
      nonce: 0,
      status: 'ACTIVE',
    },
  });

  return {
    id: session.id,
    gameCode: session.gameCode,
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    nonce: session.nonce,
    status: session.status,
    createdAt: session.createdAt,
  };
}

export async function listUserSessions(userId: string, gameCode?: GameCode): Promise<SessionView[]> {
  const rows = await db.gameSession.findMany({
    where: { userId, ...(gameCode ? { gameCode } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((s) => ({
    id: s.id,
    gameCode: s.gameCode,
    serverSeedHash: s.serverSeedHash,
    clientSeed: s.clientSeed,
    nonce: s.nonce,
    status: s.status,
    createdAt: s.createdAt,
  }));
}

// Players close their own session (status flips to EXPIRED) so the
// serverSeed can be revealed for verification. The next session pulls
// a fresh seed - this is the cycle point.
export async function expireSession(userId: string, sessionId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const s = await tx.gameSession.findUnique({ where: { id: sessionId } });
    if (!s) throw new Error(NATIVE_ERRORS.SESSION_NOT_FOUND);
    if (s.userId !== userId) throw new Error(NATIVE_ERRORS.SESSION_NOT_OWNED);
    if (s.status !== 'ACTIVE') return; // idempotent
    await tx.gameSession.update({
      where: { id: sessionId },
      data: { status: 'EXPIRED' },
    });
  });
}

// ---------- Dice settle ----------

export interface DiceBetInput {
  userId: string;
  sessionId: string;
  target: number;
  direction: DiceDirection;
  betAmount: number | string;
  idempotencyKey?: string;
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

export async function settleDiceBet(input: DiceBetInput): Promise<DiceBetResult> {
  const bet = dec(input.betAmount);
  const game = await loadGame(GAME_CODES.dice);
  if (!game.isActive) throw new Error(NATIVE_ERRORS.GAME_INACTIVE);
  assertBetInRange(game, bet);

  const config = (game.config ?? {}) as Partial<DiceConfig>;
  const minTarget = Number.isFinite(config.minTarget) ? Number(config.minTarget) : 2;
  const maxTarget = Number.isFinite(config.maxTarget) ? Number(config.maxTarget) : 98;
  if (input.target < minTarget || input.target > maxTarget) {
    throw new Error('DICE_TARGET_OUT_OF_RANGE');
  }

  return await db.$transaction(async (tx) => {
    const session = await tx.gameSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new Error(NATIVE_ERRORS.SESSION_NOT_FOUND);
    if (session.userId !== input.userId) throw new Error(NATIVE_ERRORS.SESSION_NOT_OWNED);
    if (session.status !== 'ACTIVE') throw new Error(NATIVE_ERRORS.SESSION_INACTIVE);
    if (session.gameCode !== GAME_CODES.dice) throw new Error(NATIVE_ERRORS.GAME_NOT_FOUND);

    const nonce = session.nonce;
    const idempotencyKey = (input.idempotencyKey?.trim() || `${session.id}:${nonce}`).slice(0, 128);

    // Replay protection: if this exact key already settled, return the
    // stored row instead of re-debiting.
    const prior = await tx.gameRound.findUnique({ where: { idempotencyKey } });
    if (prior) {
      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
      const outcome = (prior.outcome === 'WIN' ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS';
      const data = (prior.gameData ?? {}) as Record<string, unknown>;
      return {
        roundId: prior.id,
        outcome,
        result: Number(data.result ?? 0),
        multiplier: Number(prior.payoutMultiplier),
        payout: Number(prior.payoutAmount),
        win: outcome === 'WIN',
        winChancePct: Number(data.winChancePct ?? 0),
        newBalance: Number(wallet?.balance ?? 0),
        nonce,
        reused: true,
      } satisfies DiceBetResult;
    }

    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error(NATIVE_ERRORS.WALLET_NOT_FOUND);
    if (dec(wallet.balance).lt(bet)) throw new Error(NATIVE_ERRORS.INSUFFICIENT_FUNDS);

    const serverSeed = decryptString(session.serverSeed);
    const outcome: DiceResult = rollDice({
      serverSeed,
      clientSeed: session.clientSeed,
      nonce,
      target: input.target,
      direction: input.direction,
      betAmount: bet,
      houseEdgeBps: game.houseEdgeBps,
    });

    // 1. Debit bet
    await tx.wallet.update({
      where: { userId: input.userId },
      data: { balance: { decrement: bet } },
    });

    // 2. Create round in PENDING then update so the FK guarantees
    //    transaction.reference can be set if a round-id is needed.
    const round = await tx.gameRound.create({
      data: {
        sessionId: session.id,
        userId: input.userId,
        gameCode: game.gameCode,
        nonce,
        betAmount: bet,
        payoutAmount: outcome.payout,
        payoutMultiplier: outcome.multiplier,
        outcome: outcome.win ? 'WIN' : 'LOSS',
        settledAt: new Date(),
        idempotencyKey,
        gameData: {
          target: input.target,
          direction: input.direction,
          result: outcome.result,
          winChancePct: outcome.winChancePct,
        } as Prisma.JsonObject,
      },
    });

    await tx.transaction.create({
      data: {
        userId: input.userId,
        type: 'bet',
        status: 'completed',
        amount: bet.neg(),
        reference: round.id,
        description: 'Pasha Dice bet',
        meta: { gameCode: game.gameCode, roundId: round.id, sessionId: session.id, nonce } as Prisma.JsonObject,
      },
    });

    // 3. Credit win if any
    if (outcome.win) {
      await tx.wallet.update({
        where: { userId: input.userId },
        data: { balance: { increment: outcome.payout } },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: 'win',
          status: 'completed',
          amount: outcome.payout,
          reference: round.id,
          description: 'Pasha Dice win',
          meta: { gameCode: game.gameCode, roundId: round.id, sessionId: session.id, nonce } as Prisma.JsonObject,
        },
      });
    }

    // 4. Advance the session nonce so the next bet pulls fresh bytes
    await tx.gameSession.update({
      where: { id: session.id },
      data: { nonce: { increment: 1 } },
    });

    const after = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });

    return {
      roundId: round.id,
      outcome: outcome.win ? 'WIN' : 'LOSS',
      result: outcome.result,
      multiplier: Number(outcome.multiplier),
      payout: Number(outcome.payout),
      win: outcome.win,
      winChancePct: outcome.winChancePct,
      newBalance: Number(after?.balance ?? 0),
      nonce,
      reused: false,
    } satisfies DiceBetResult;
  });
}

// ---------- Shared instant-settle path (Keno / Roulette / Slots / Crash) ----------
//
// Cuts the per-game settle method down to one engine call. The
// outcome callback runs INSIDE the transaction so the engine sees a
// fresh nonce and the wallet movement happens atomically with the
// GameRound row. settleInstant guarantees:
//   - idempotencyKey replay returns the stored row, balance unchanged
//   - wallet pre-check for sufficient funds
//   - session ownership + ACTIVE state + matching gameCode
//   - bet debit + win credit + GameRound row + Transaction rows are
//     all in one db.$transaction
//   - session.nonce advances exactly once per settle

interface InstantOutcome {
  win: boolean;
  multiplier: Prisma.Decimal;
  payout: Prisma.Decimal;
  // Gameplay-specific data persisted on GameRound.gameData. Should
  // be JSON-serializable; do NOT include secrets here while the
  // session is still ACTIVE (the verify endpoint reveals serverSeed
  // separately after the session closes).
  gameData: Prisma.JsonObject;
  // Short label written onto the bet Transaction.description.
  description: string;
}

interface InstantSettleInput<R extends InstantOutcome> {
  userId: string;
  sessionId: string;
  expectedGameCode: GameCode;
  betAmount: Prisma.Decimal;
  idempotencyKey?: string;
  produceOutcome: (ctx: { serverSeed: string; clientSeed: string; nonce: number; game: NativeGameProvider }) => R;
}

interface InstantSettleResult {
  roundId: string;
  outcome: 'WIN' | 'LOSS';
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  nonce: number;
  gameData: Prisma.JsonValue;
  reused: boolean;
}

async function settleInstant<R extends InstantOutcome>(input: InstantSettleInput<R>): Promise<InstantSettleResult> {
  const game = await loadGame(input.expectedGameCode);
  if (!game.isActive) throw new Error(NATIVE_ERRORS.GAME_INACTIVE);
  assertBetInRange(game, input.betAmount);

  return await db.$transaction(async (tx) => {
    const session = await tx.gameSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new Error(NATIVE_ERRORS.SESSION_NOT_FOUND);
    if (session.userId !== input.userId) throw new Error(NATIVE_ERRORS.SESSION_NOT_OWNED);
    if (session.status !== 'ACTIVE') throw new Error(NATIVE_ERRORS.SESSION_INACTIVE);
    if (session.gameCode !== input.expectedGameCode) throw new Error(NATIVE_ERRORS.GAME_NOT_FOUND);

    const nonce = session.nonce;
    const idempotencyKey = (input.idempotencyKey?.trim() || `${session.id}:${nonce}`).slice(0, 128);

    const prior = await tx.gameRound.findUnique({ where: { idempotencyKey } });
    if (prior) {
      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
      const outcome = (prior.outcome === 'WIN' ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS';
      return {
        roundId: prior.id,
        outcome,
        win: outcome === 'WIN',
        multiplier: Number(prior.payoutMultiplier),
        payout: Number(prior.payoutAmount),
        newBalance: Number(wallet?.balance ?? 0),
        nonce,
        gameData: prior.gameData ?? null,
        reused: true,
      };
    }

    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error(NATIVE_ERRORS.WALLET_NOT_FOUND);
    if (dec(wallet.balance).lt(input.betAmount)) throw new Error(NATIVE_ERRORS.INSUFFICIENT_FUNDS);

    const serverSeed = decryptString(session.serverSeed);
    const outcome = input.produceOutcome({ serverSeed, clientSeed: session.clientSeed, nonce, game });

    // 1. Debit bet
    await tx.wallet.update({
      where: { userId: input.userId },
      data: { balance: { decrement: input.betAmount } },
    });

    // 2. Persist GameRound + bet Transaction
    const round = await tx.gameRound.create({
      data: {
        sessionId: session.id,
        userId: input.userId,
        gameCode: game.gameCode,
        nonce,
        betAmount: input.betAmount,
        payoutAmount: outcome.payout,
        payoutMultiplier: outcome.multiplier,
        outcome: outcome.win ? 'WIN' : 'LOSS',
        settledAt: new Date(),
        idempotencyKey,
        gameData: outcome.gameData,
      },
    });

    await tx.transaction.create({
      data: {
        userId: input.userId,
        type: 'bet',
        status: 'completed',
        amount: input.betAmount.neg(),
        reference: round.id,
        description: outcome.description + ' bet',
        meta: { gameCode: game.gameCode, roundId: round.id, sessionId: session.id, nonce } as Prisma.JsonObject,
      },
    });

    // 3. Credit win
    if (outcome.win) {
      await tx.wallet.update({
        where: { userId: input.userId },
        data: { balance: { increment: outcome.payout } },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: 'win',
          status: 'completed',
          amount: outcome.payout,
          reference: round.id,
          description: outcome.description + ' win',
          meta: { gameCode: game.gameCode, roundId: round.id, sessionId: session.id, nonce } as Prisma.JsonObject,
        },
      });
    }

    // 4. Advance nonce
    await tx.gameSession.update({
      where: { id: session.id },
      data: { nonce: { increment: 1 } },
    });

    const after = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
    return {
      roundId: round.id,
      outcome: outcome.win ? 'WIN' : 'LOSS',
      win: outcome.win,
      multiplier: Number(outcome.multiplier),
      payout: Number(outcome.payout),
      newBalance: Number(after?.balance ?? 0),
      nonce,
      gameData: outcome.gameData,
      reused: false,
    };
  });
}

// ---------- Keno settle ----------

export interface KenoBetInput {
  userId: string;
  sessionId: string;
  picks: number[];
  betAmount: number | string;
  idempotencyKey?: string;
}
export interface KenoBetResult extends InstantSettleResult {
  draw: number[];
  matches: number[];
  matchCount: number;
}

export async function settleKenoBet(input: KenoBetInput): Promise<KenoBetResult> {
  const bet = dec(input.betAmount);
  const game = await loadGame(GAME_CODES.keno);
  const cfg = (game.config ?? {}) as Partial<KenoConfig>;
  const poolSize = Number.isFinite(cfg.poolSize) ? Number(cfg.poolSize) : 80;
  const drawCount = Number.isFinite(cfg.drawCount) ? Number(cfg.drawCount) : 20;
  const minPicks = Number.isFinite(cfg.minPicks) ? Number(cfg.minPicks) : 1;
  const maxPicks = Number.isFinite(cfg.maxPicks) ? Number(cfg.maxPicks) : 10;
  if (!Array.isArray(input.picks) || input.picks.length < minPicks || input.picks.length > maxPicks) {
    throw new Error('KENO_PICK_COUNT_OUT_OF_RANGE');
  }

  const base = await settleInstant({
    userId: input.userId,
    sessionId: input.sessionId,
    expectedGameCode: GAME_CODES.keno,
    betAmount: bet,
    idempotencyKey: input.idempotencyKey,
    produceOutcome: ({ serverSeed, clientSeed, nonce, game: g }) => {
      const r = rollKeno({
        serverSeed,
        clientSeed,
        nonce,
        picks: input.picks,
        poolSize,
        drawCount,
        betAmount: bet,
        houseEdgeBps: g.houseEdgeBps,
      });
      return {
        win: r.win,
        multiplier: r.multiplier,
        payout: r.payout,
        gameData: {
          picks: input.picks,
          draw: r.draw,
          matches: r.matches,
          matchCount: r.matchCount,
          fairMultiplier: r.fairMultiplier,
        } as Prisma.JsonObject,
        description: 'Pasha Keno',
      };
    },
  });

  const data = (base.gameData ?? {}) as { draw?: number[]; matches?: number[]; matchCount?: number };
  return {
    ...base,
    draw: Array.isArray(data.draw) ? data.draw : [],
    matches: Array.isArray(data.matches) ? data.matches : [],
    matchCount: Number(data.matchCount ?? 0),
  };
}

// ---------- Roulette settle ----------

export interface RouletteBetInput {
  userId: string;
  sessionId: string;
  betType: RouletteBetType;
  straightNumber?: number;
  betAmount: number | string;
  idempotencyKey?: string;
}
export interface RouletteBetResult extends InstantSettleResult {
  result: number;
  resultColor: 'red' | 'black' | 'green';
}

export async function settleRouletteBet(input: RouletteBetInput): Promise<RouletteBetResult> {
  const bet = dec(input.betAmount);
  const game = await loadGame(GAME_CODES.roulette);
  const cfg = (game.config ?? {}) as Partial<RouletteConfig>;
  const wheelSize = Number.isFinite(cfg.wheelSize) ? Number(cfg.wheelSize) : 37;

  const base = await settleInstant({
    userId: input.userId,
    sessionId: input.sessionId,
    expectedGameCode: GAME_CODES.roulette,
    betAmount: bet,
    idempotencyKey: input.idempotencyKey,
    produceOutcome: ({ serverSeed, clientSeed, nonce }) => {
      const r = rollRoulette({
        serverSeed,
        clientSeed,
        nonce,
        wheelSize,
        betType: input.betType,
        straightNumber: input.straightNumber,
        betAmount: bet,
      });
      return {
        win: r.win,
        multiplier: r.multiplier,
        payout: r.payout,
        gameData: {
          betType: input.betType,
          straightNumber: input.straightNumber ?? null,
          result: r.result,
          resultColor: r.resultColor,
        } as Prisma.JsonObject,
        description: 'Pasha Roulette',
      };
    },
  });

  const data = (base.gameData ?? {}) as { result?: number; resultColor?: 'red' | 'black' | 'green' };
  return {
    ...base,
    result: Number(data.result ?? 0),
    resultColor: data.resultColor ?? 'green',
  };
}

// ---------- Slots settle ----------

export interface SlotsBetInput {
  userId: string;
  sessionId: string;
  betAmount: number | string;
  idempotencyKey?: string;
}
export interface SlotsBetResult extends InstantSettleResult {
  reelSymbols: string[];
  matchedSymbol: string | null;
}

export async function settleSlotsBet(input: SlotsBetInput): Promise<SlotsBetResult> {
  const bet = dec(input.betAmount);
  const game = await loadGame(GAME_CODES.slots);
  const cfg = (game.config ?? {}) as Partial<SlotsConfig>;
  const reels = Number.isFinite(cfg.reels) ? Number(cfg.reels) : 3;
  const symbols = Array.isArray(cfg.symbols) && cfg.symbols.length > 1 ? (cfg.symbols as string[]) : ['CHERRY', 'LEMON', 'CLOVER', 'STAR', 'DIAMOND', 'CROWN', 'SEVEN', 'NINE'];
  const paytable = cfg.paytable && typeof cfg.paytable === 'object' ? (cfg.paytable as Record<string, Record<string, number>>) : {};

  const base = await settleInstant({
    userId: input.userId,
    sessionId: input.sessionId,
    expectedGameCode: GAME_CODES.slots,
    betAmount: bet,
    idempotencyKey: input.idempotencyKey,
    produceOutcome: ({ serverSeed, clientSeed, nonce, game: g }) => {
      const r = rollSlots({
        serverSeed,
        clientSeed,
        nonce,
        reels,
        symbols,
        paytable,
        betAmount: bet,
        houseEdgeBps: g.houseEdgeBps,
      });
      return {
        win: r.win,
        multiplier: r.multiplier,
        payout: r.payout,
        gameData: {
          reelStops: r.reelStops,
          reelSymbols: r.reelSymbols,
          matchedSymbol: r.matchedSymbol,
          matchedCount: r.matchedCount,
          fairMultiplier: r.fairMultiplier,
        } as Prisma.JsonObject,
        description: 'Pasha Slots',
      };
    },
  });

  const data = (base.gameData ?? {}) as { reelSymbols?: string[]; matchedSymbol?: string | null };
  return {
    ...base,
    reelSymbols: Array.isArray(data.reelSymbols) ? data.reelSymbols : [],
    matchedSymbol: data.matchedSymbol ?? null,
  };
}

// ---------- Crash settle ----------

export interface CrashBetInput {
  userId: string;
  sessionId: string;
  targetMultiplier: number;
  betAmount: number | string;
  idempotencyKey?: string;
}
export interface CrashBetResult extends InstantSettleResult {
  crashPoint: number;
  targetMultiplier: number;
}

export async function settleCrashBet(input: CrashBetInput): Promise<CrashBetResult> {
  const bet = dec(input.betAmount);
  const game = await loadGame(GAME_CODES.crash);
  const cfg = (game.config ?? {}) as Partial<CrashConfig>;
  const minTarget = Number.isFinite(cfg.minTargetMultiplier) ? Number(cfg.minTargetMultiplier) : 1.01;
  const maxTarget = Number.isFinite(cfg.maxTargetMultiplier) ? Number(cfg.maxTargetMultiplier) : 100;
  const maxCrash = Number.isFinite(cfg.maxCrashMultiplier) ? Number(cfg.maxCrashMultiplier) : 1000;

  if (!Number.isFinite(input.targetMultiplier) || input.targetMultiplier < minTarget || input.targetMultiplier > maxTarget) {
    throw new Error('CRASH_TARGET_OUT_OF_RANGE');
  }

  const base = await settleInstant({
    userId: input.userId,
    sessionId: input.sessionId,
    expectedGameCode: GAME_CODES.crash,
    betAmount: bet,
    idempotencyKey: input.idempotencyKey,
    produceOutcome: ({ serverSeed, clientSeed, nonce, game: g }) => {
      const r = rollCrash({
        serverSeed,
        clientSeed,
        nonce,
        targetMultiplier: input.targetMultiplier,
        betAmount: bet,
        houseEdgeBps: g.houseEdgeBps,
        maxCrashMultiplier: maxCrash,
        minTargetMultiplier: minTarget,
        maxTargetMultiplier: maxTarget,
      });
      return {
        win: r.win,
        multiplier: r.multiplier,
        payout: r.payout,
        gameData: {
          crashPoint: r.crashPoint,
          targetMultiplier: r.targetMultiplier,
        } as Prisma.JsonObject,
        description: 'Pasha Crash',
      };
    },
  });

  const data = (base.gameData ?? {}) as { crashPoint?: number; targetMultiplier?: number };
  return {
    ...base,
    crashPoint: Number(data.crashPoint ?? 1),
    targetMultiplier: Number(data.targetMultiplier ?? input.targetMultiplier),
  };
}

// ---------- Mines start ----------

export interface MinesStartInput {
  userId: string;
  sessionId: string;
  mineCount: number;
  betAmount: number | string;
  idempotencyKey?: string;
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

interface MinesGameData {
  mineCount: number;
  totalTiles: number;
  minePositions: number[];      // server-only until settle
  revealedTiles: number[];
  currentMultiplier: string;    // Decimal serialized
}

export async function startMinesRound(input: MinesStartInput): Promise<MinesStartResult> {
  const bet = dec(input.betAmount);
  const game = await loadGame(GAME_CODES.mines);
  if (!game.isActive) throw new Error(NATIVE_ERRORS.GAME_INACTIVE);
  assertBetInRange(game, bet);

  const config = (game.config ?? {}) as Partial<MinesConfig>;
  const totalTiles = Number.isFinite(config.gridSize) ? Number(config.gridSize) : 25;
  const minMines = Number.isFinite(config.minMines) ? Number(config.minMines) : 1;
  const maxMines = Number.isFinite(config.maxMines) ? Number(config.maxMines) : 24;
  if (
    !Number.isInteger(input.mineCount)
    || input.mineCount < minMines
    || input.mineCount > maxMines
    || input.mineCount >= totalTiles
  ) {
    throw new Error(NATIVE_ERRORS.MINES_INVALID_COUNT);
  }

  return await db.$transaction(async (tx) => {
    const session = await tx.gameSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new Error(NATIVE_ERRORS.SESSION_NOT_FOUND);
    if (session.userId !== input.userId) throw new Error(NATIVE_ERRORS.SESSION_NOT_OWNED);
    if (session.status !== 'ACTIVE') throw new Error(NATIVE_ERRORS.SESSION_INACTIVE);
    if (session.gameCode !== GAME_CODES.mines) throw new Error(NATIVE_ERRORS.GAME_NOT_FOUND);

    const nonce = session.nonce;
    const idempotencyKey = (input.idempotencyKey?.trim() || `${session.id}:${nonce}`).slice(0, 128);

    const prior = await tx.gameRound.findUnique({ where: { idempotencyKey } });
    if (prior) {
      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
      const data = (prior.gameData ?? {}) as Partial<MinesGameData>;
      return {
        roundId: prior.id,
        outcome: 'PENDING' as const,
        mineCount: Number(data.mineCount ?? input.mineCount),
        totalTiles: Number(data.totalTiles ?? totalTiles),
        revealedTiles: Array.isArray(data.revealedTiles) ? (data.revealedTiles as number[]) : [],
        currentMultiplier: Number(data.currentMultiplier ?? 1),
        newBalance: Number(wallet?.balance ?? 0),
        nonce,
        reused: true,
      };
    }

    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error(NATIVE_ERRORS.WALLET_NOT_FOUND);
    if (dec(wallet.balance).lt(bet)) throw new Error(NATIVE_ERRORS.INSUFFICIENT_FUNDS);

    const serverSeed = decryptString(session.serverSeed);
    const minePositions = generateMineGrid({
      serverSeed,
      clientSeed: session.clientSeed,
      nonce,
      totalTiles,
      mineCount: input.mineCount,
    });

    await tx.wallet.update({
      where: { userId: input.userId },
      data: { balance: { decrement: bet } },
    });

    const gameData: MinesGameData = {
      mineCount: input.mineCount,
      totalTiles,
      minePositions,
      revealedTiles: [],
      currentMultiplier: '1.0000',
    };

    const round = await tx.gameRound.create({
      data: {
        sessionId: session.id,
        userId: input.userId,
        gameCode: game.gameCode,
        nonce,
        betAmount: bet,
        payoutAmount: dec(0),
        payoutMultiplier: dec(0),
        outcome: 'PENDING',
        idempotencyKey,
        gameData: gameData as unknown as Prisma.JsonObject,
      },
    });

    await tx.transaction.create({
      data: {
        userId: input.userId,
        type: 'bet',
        status: 'completed',
        amount: bet.neg(),
        reference: round.id,
        description: 'Pasha Mines bet',
        meta: { gameCode: game.gameCode, roundId: round.id, sessionId: session.id, nonce, mineCount: input.mineCount } as Prisma.JsonObject,
      },
    });

    // Mines does NOT advance the session nonce on start - the nonce
    // advances on the terminal action (mine hit or cashout) so the
    // whole reveal-cashout pipeline shares the same outcome seed.

    const after = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });

    return {
      roundId: round.id,
      outcome: 'PENDING' as const,
      mineCount: input.mineCount,
      totalTiles,
      revealedTiles: [],
      currentMultiplier: 1,
      newBalance: Number(after?.balance ?? 0),
      nonce,
      reused: false,
    };
  });
}

// ---------- Mines reveal ----------

export interface MinesRevealInput {
  userId: string;
  roundId: string;
  tile: number;
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
  minePositions?: number[];   // only when outcome=LOSS
}

export async function revealMinesTile(input: MinesRevealInput): Promise<MinesRevealResult> {
  return await db.$transaction(async (tx) => {
    const round = await tx.gameRound.findUnique({ where: { id: input.roundId } });
    if (!round) throw new Error(NATIVE_ERRORS.ROUND_NOT_FOUND);
    if (round.userId !== input.userId) throw new Error(NATIVE_ERRORS.ROUND_NOT_OWNED);
    if (round.outcome !== 'PENDING') throw new Error(NATIVE_ERRORS.ROUND_NOT_PENDING);
    if (round.gameCode !== GAME_CODES.mines) throw new Error(NATIVE_ERRORS.GAME_NOT_FOUND);

    const game = await loadGame(GAME_CODES.mines);
    const data = (round.gameData ?? {}) as Partial<MinesGameData>;
    const totalTiles = Number(data.totalTiles ?? 25);
    const mineCount = Number(data.mineCount ?? 0);
    const grid = Array.isArray(data.minePositions) ? (data.minePositions as number[]) : [];
    const revealedTiles = Array.isArray(data.revealedTiles) ? (data.revealedTiles as number[]) : [];

    if (!Number.isInteger(input.tile) || input.tile < 0 || input.tile >= totalTiles) {
      throw new Error(NATIVE_ERRORS.MINES_TILE_OUT_OF_RANGE);
    }
    if (revealedTiles.includes(input.tile)) {
      throw new Error(NATIVE_ERRORS.MINES_TILE_ALREADY_REVEALED);
    }

    const r = revealTile({
      grid,
      revealedTiles,
      pick: input.tile,
      totalTiles,
      mineCount,
      houseEdgeBps: game.houseEdgeBps,
    });

    if (r.hitMine) {
      // Settle as LOSS. No wallet movement (the bet was already
      // debited at startMinesRound).
      const updatedData: MinesGameData = {
        mineCount,
        totalTiles,
        minePositions: grid,
        revealedTiles,                      // do NOT add the mine tile
        currentMultiplier: '0.0000',
      };
      await tx.gameRound.update({
        where: { id: round.id },
        data: {
          outcome: 'LOSS',
          settledAt: new Date(),
          payoutAmount: dec(0),
          payoutMultiplier: dec(0),
          gameData: { ...updatedData, mineHit: input.tile } as unknown as Prisma.JsonObject,
        },
      });
      await tx.gameSession.update({
        where: { id: round.sessionId },
        data: { nonce: { increment: 1 } },
      });

      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
      return {
        roundId: round.id,
        outcome: 'LOSS' as const,
        tile: input.tile,
        hitMine: true,
        revealedTiles,
        safeCount: revealedTiles.length,
        currentMultiplier: 0,
        newBalance: Number(wallet?.balance ?? 0),
        minePositions: grid,
      };
    }

    const nextRevealed = [...revealedTiles, input.tile];
    const nextMultiplier = r.nextMultiplier;
    const updatedData: MinesGameData = {
      mineCount,
      totalTiles,
      minePositions: grid,
      revealedTiles: nextRevealed,
      currentMultiplier: nextMultiplier.toFixed(4),
    };
    await tx.gameRound.update({
      where: { id: round.id },
      data: {
        gameData: updatedData as unknown as Prisma.JsonObject,
      },
    });

    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
    return {
      roundId: round.id,
      outcome: 'PENDING' as const,
      tile: input.tile,
      hitMine: false,
      revealedTiles: nextRevealed,
      safeCount: r.safeCount,
      currentMultiplier: Number(nextMultiplier),
      newBalance: Number(wallet?.balance ?? 0),
    };
  });
}

// ---------- Mines cashout ----------

export interface MinesCashoutInput {
  userId: string;
  roundId: string;
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

export async function cashoutMines(input: MinesCashoutInput): Promise<MinesCashoutResult> {
  return await db.$transaction(async (tx) => {
    const round = await tx.gameRound.findUnique({ where: { id: input.roundId } });
    if (!round) throw new Error(NATIVE_ERRORS.ROUND_NOT_FOUND);
    if (round.userId !== input.userId) throw new Error(NATIVE_ERRORS.ROUND_NOT_OWNED);
    if (round.outcome !== 'PENDING') throw new Error(NATIVE_ERRORS.ROUND_NOT_PENDING);
    if (round.gameCode !== GAME_CODES.mines) throw new Error(NATIVE_ERRORS.GAME_NOT_FOUND);

    const game = await loadGame(GAME_CODES.mines);
    const data = (round.gameData ?? {}) as Partial<MinesGameData>;
    const totalTiles = Number(data.totalTiles ?? 25);
    const mineCount = Number(data.mineCount ?? 0);
    const grid = Array.isArray(data.minePositions) ? (data.minePositions as number[]) : [];
    const revealedTiles = Array.isArray(data.revealedTiles) ? (data.revealedTiles as number[]) : [];
    if (revealedTiles.length === 0) throw new Error(NATIVE_ERRORS.MINES_NO_SAFE_REVEAL);

    const multiplier = computeMultiplier({
      totalTiles,
      mineCount,
      safeRevealed: revealedTiles.length,
      houseEdgeBps: game.houseEdgeBps,
    });
    const payout = dec(round.betAmount).mul(multiplier).toDecimalPlaces(2);

    await tx.wallet.update({
      where: { userId: input.userId },
      data: { balance: { increment: payout } },
    });

    const updatedData: MinesGameData = {
      mineCount,
      totalTiles,
      minePositions: grid,
      revealedTiles,
      currentMultiplier: multiplier.toFixed(4),
    };
    await tx.gameRound.update({
      where: { id: round.id },
      data: {
        outcome: 'CASHOUT',
        settledAt: new Date(),
        payoutAmount: payout,
        payoutMultiplier: multiplier,
        gameData: updatedData as unknown as Prisma.JsonObject,
      },
    });

    await tx.transaction.create({
      data: {
        userId: input.userId,
        type: 'win',
        status: 'completed',
        amount: payout,
        reference: round.id,
        description: 'Pasha Mines cashout',
        meta: { gameCode: game.gameCode, roundId: round.id, sessionId: round.sessionId, multiplier: multiplier.toFixed(4) } as Prisma.JsonObject,
      },
    });

    await tx.gameSession.update({
      where: { id: round.sessionId },
      data: { nonce: { increment: 1 } },
    });

    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
    return {
      roundId: round.id,
      outcome: 'CASHOUT' as const,
      payout: Number(payout),
      multiplier: Number(multiplier),
      newBalance: Number(wallet?.balance ?? 0),
      minePositions: grid,
      revealedTiles,
    };
  });
}

// ---------- Verify (post-settlement reveal) ----------

export interface SessionVerification {
  sessionId: string;
  gameCode: string;
  status: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonceCount: number;
  rounds: Array<{
    id: string;
    nonce: number;
    outcome: string;
    betAmount: number;
    payoutAmount: number;
    payoutMultiplier: number;
    gameData: Prisma.JsonValue | null;
    settledAt: Date | null;
  }>;
}

export async function verifySession(opts: { userId: string; sessionId: string }): Promise<SessionVerification> {
  const session = await db.gameSession.findUnique({
    where: { id: opts.sessionId },
    include: { rounds: { orderBy: { nonce: 'asc' } } },
  });
  if (!session) throw new Error(NATIVE_ERRORS.SESSION_NOT_FOUND);
  if (session.userId !== opts.userId) throw new Error(NATIVE_ERRORS.SESSION_NOT_OWNED);
  if (session.status === 'ACTIVE') throw new Error(NATIVE_ERRORS.SESSION_NOT_COMPLETED);

  const plain = decryptString(session.serverSeed);
  return {
    sessionId: session.id,
    gameCode: session.gameCode,
    status: session.status,
    serverSeed: plain,
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    nonceCount: session.nonce,
    rounds: session.rounds.map((r) => ({
      id: r.id,
      nonce: r.nonce,
      outcome: r.outcome,
      betAmount: Number(r.betAmount),
      payoutAmount: Number(r.payoutAmount),
      payoutMultiplier: Number(r.payoutMultiplier),
      gameData: r.gameData,
      settledAt: r.settledAt,
    })),
  };
}

// ---------- Admin: aggregates + rollback ----------

export interface GameAggregate {
  game: NativeGameProvider;
  totals: {
    rounds: number;
    wagered: number;
    paid: number;
    houseResult: number;
    // Last 24h activity for the admin "Recent activity" indicator.
    // Counts non-cancelled rounds settled within the last 24 hours.
    rounds24h: number;
    lastRoundAt: Date | null;
  };
}

export async function listGamesWithTotals(): Promise<GameAggregate[]> {
  const games = await db.nativeGameProvider.findMany({ orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const out: GameAggregate[] = [];
  for (const g of games) {
    const [agg, rounds24h, latest] = await Promise.all([
      db.gameRound.aggregate({
        where: { gameCode: g.gameCode, outcome: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { betAmount: true, payoutAmount: true },
      }),
      db.gameRound.count({
        where: { gameCode: g.gameCode, outcome: { not: 'CANCELLED' }, createdAt: { gte: since } },
      }),
      db.gameRound.findFirst({
        where: { gameCode: g.gameCode, outcome: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    const wagered = Number(agg._sum.betAmount ?? 0);
    const paid = Number(agg._sum.payoutAmount ?? 0);
    out.push({
      game: g,
      totals: {
        rounds: agg._count._all,
        rounds24h,
        lastRoundAt: latest?.createdAt ?? null,
        wagered,
        paid,
        houseResult: wagered - paid,
      },
    });
  }
  return out;
}

export async function listRecentRounds(opts: {
  gameCode?: string;
  userId?: string;
  outcome?: string;
  limit?: number;
}): Promise<Array<GameRound & { actorUsername?: string | null }>> {
  const rows = await db.gameRound.findMany({
    where: {
      ...(opts.gameCode ? { gameCode: opts.gameCode } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.outcome ? { outcome: opts.outcome } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(opts.limit ?? 50, 1), 200),
  });
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
    : [];
  const map = new Map(users.map((u) => [u.id, u.username]));
  return rows.map((r) => ({ ...r, actorUsername: map.get(r.userId) ?? null }));
}

export interface RollbackResult {
  roundId: string;
  reversedBet: number;
  reversedWin: number;
  newBalance: number;
}

export async function rollbackRound(opts: { roundId: string; actorId: string; note?: string }): Promise<RollbackResult> {
  return await db.$transaction(async (tx) => {
    const round = await tx.gameRound.findUnique({ where: { id: opts.roundId } });
    if (!round) throw new Error(NATIVE_ERRORS.ROUND_NOT_FOUND);
    if (round.outcome === 'CANCELLED') throw new Error(NATIVE_ERRORS.ROUND_ALREADY_CANCELLED);

    const bet = dec(round.betAmount);
    const payout = dec(round.payoutAmount);
    // Net delta the player should receive back: bet refunded, win
    // reversed. For PENDING rounds (no win yet) this is just the bet.
    const delta = bet.sub(payout);

    if (!delta.eq(0)) {
      await tx.wallet.update({
        where: { userId: round.userId },
        data: { balance: { increment: delta } },
      });
    }

    await tx.transaction.create({
      data: {
        userId: round.userId,
        type: 'adjust',
        status: 'completed',
        amount: delta,
        reference: round.id,
        description: 'Native game round rollback',
        meta: {
          gameCode: round.gameCode,
          roundId: round.id,
          actorId: opts.actorId,
          note: opts.note ?? null,
          reversedBet: Number(bet),
          reversedWin: Number(payout),
        } as Prisma.JsonObject,
      },
    });

    await tx.gameRound.update({
      where: { id: round.id },
      data: {
        outcome: 'CANCELLED',
        settledAt: round.settledAt ?? new Date(),
        gameData: {
          ...((round.gameData ?? {}) as Record<string, unknown>),
          rollback: { actorId: opts.actorId, at: new Date().toISOString(), note: opts.note ?? null },
        } as Prisma.JsonObject,
      },
    });

    const wallet = await tx.wallet.findUnique({ where: { userId: round.userId }, select: { balance: true } });
    return {
      roundId: round.id,
      reversedBet: Number(bet),
      reversedWin: Number(payout),
      newBalance: Number(wallet?.balance ?? 0),
    };
  });
}

