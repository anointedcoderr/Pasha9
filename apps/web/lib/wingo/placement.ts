// Built by Anointed Coder.
//
// Pasha WinGo multi-line bet placement. A player may stake several bet
// lines on one round in a single request (a colour, a number and a
// size, each with its own quantity chip). This module debits the whole
// slip and writes every WingoBet line inside ONE db.$transaction, so
// the placement is all-or-nothing: either every line commits with a
// single wallet debit, or nothing does.
//
// It reuses the engine's exported deterministic scheduler
// (computeRoundWindow) and idempotent round provisioning (ensureRound)
// so it shares the exact round identity and fairness commit the cron
// uses. Money safety:
//   - Bet close is enforced by wall clock (now < betCloseAt) AND by the
//     round's DB status, server-side, inside the transaction.
//   - Every line carries a unique idempotencyKey (`${base}:${i}`), so a
//     retried or concurrent duplicate placement can never double-debit;
//     a replay returns the stored lines with the wallet untouched.
//   - The debit and each line share the same ledger path (type 'bet',
//     meta.scope 'casino') the other native games use, so turnover and
//     cashback accrue identically.

import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { WingoRound, WingoBet } from '@prisma/client';
import { db } from '@/lib/db/client';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';
import { computeRoundWindow, ensureRound, WINGO_ERRORS } from './engine';
import { WINGO_GAME_CODE, WINGO_MAX_QUANTITY, isWingoMode, type WingoMode } from './config';
import { isValidSelection } from './paytable';

// Additional errors specific to the multi-line slip. Merged with
// WINGO_ERRORS by the route error map.
export const WINGO_PLACEMENT_ERRORS = {
  NO_LINES: 'WINGO_NO_LINES',
  TOO_MANY_LINES: 'WINGO_TOO_MANY_LINES',
} as const;

// Hard cap on lines per placement request.
export const WINGO_MAX_LINES_PER_PLACEMENT = 20;

export interface WingoBetLineInput {
  betType: string; // color | number | size
  selection: string; // green|red|violet | "0".."9" | big|small
  stake: number | string; // unit stake, before the quantity chip
  quantity: number; // X1..X100
}

export interface PlaceBetsInput {
  userId: string;
  mode: WingoMode;
  lines: WingoBetLineInput[];
  // Operator-configured stake bounds (already clamped to the engine's
  // hard bounds by lib/wingo/flag.ts). minStake applies to the unit
  // stake; maxStake applies to the per-line total after the chip.
  minStake: number;
  maxStake: number;
  idempotencyKey?: string;
}

export interface PlacedLine {
  betId: string;
  betType: string;
  selection: string;
  stake: number;
  quantity: number;
  betAmount: number;
}

export interface PlaceBetsResult {
  roundId: string;
  periodNumber: string;
  mode: string;
  status: string;
  betCloseAt: string;
  drawsAt: string;
  bets: PlacedLine[];
  totalStake: number;
  newBalance: number;
  reused: boolean;
}

interface NormalisedLine {
  betType: string;
  selection: string;
  unit: Prisma.Decimal;
  quantity: number;
  betAmount: Prisma.Decimal;
}

function toPlacedLines(bets: WingoBet[]): PlacedLine[] {
  return bets.map((b) => ({
    betId: b.id,
    betType: b.betType,
    selection: b.betValue,
    stake: Number(b.unitAmount),
    quantity: b.quantity,
    betAmount: Number(b.betAmount),
  }));
}

function buildResult(round: WingoRound, bets: WingoBet[], reused: boolean, newBalance: number): PlaceBetsResult {
  const totalStake = bets.reduce((sum, b) => sum + Number(b.betAmount), 0);
  return {
    roundId: round.id,
    periodNumber: round.periodNumber,
    mode: round.mode,
    status: round.status,
    betCloseAt: round.betCloseAt.toISOString(),
    drawsAt: round.drawsAt.toISOString(),
    bets: toPlacedLines(bets),
    totalStake,
    newBalance,
    reused,
  };
}

export async function placeBets(input: PlaceBetsInput): Promise<PlaceBetsResult> {
  if (!isWingoMode(input.mode)) throw new Error(WINGO_ERRORS.INVALID_MODE);

  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (lines.length === 0) throw new Error(WINGO_PLACEMENT_ERRORS.NO_LINES);
  if (lines.length > WINGO_MAX_LINES_PER_PLACEMENT) throw new Error(WINGO_PLACEMENT_ERRORS.TOO_MANY_LINES);

  const minStake = new Prisma.Decimal(Number.isFinite(input.minStake) ? input.minStake : 1);
  const maxStake = new Prisma.Decimal(Number.isFinite(input.maxStake) ? input.maxStake : 100_000);

  // Validate + normalise every line BEFORE opening the transaction, so a
  // bad line never leaves a half-applied wallet move.
  const normalised: NormalisedLine[] = lines.map((line) => {
    const betType = String(line.betType);
    if (betType !== 'color' && betType !== 'number' && betType !== 'size') {
      throw new Error(WINGO_ERRORS.INVALID_BET_TYPE);
    }
    const selection = String(line.selection).trim().toLowerCase();
    if (!isValidSelection(betType, selection)) throw new Error(WINGO_ERRORS.INVALID_SELECTION);

    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > WINGO_MAX_QUANTITY) {
      throw new Error(WINGO_ERRORS.INVALID_QUANTITY);
    }

    let unit: Prisma.Decimal;
    try {
      unit = new Prisma.Decimal(line.stake);
    } catch {
      throw new Error(WINGO_ERRORS.STAKE_BELOW_MIN);
    }
    if (!unit.isFinite() || unit.lt(minStake)) throw new Error(WINGO_ERRORS.STAKE_BELOW_MIN);

    const betAmount = unit.mul(quantity).toDecimalPlaces(2);
    if (betAmount.lte(0)) throw new Error(WINGO_ERRORS.STAKE_BELOW_MIN);
    if (betAmount.gt(maxStake)) throw new Error(WINGO_ERRORS.STAKE_ABOVE_MAX);

    return { betType, selection, unit, quantity, betAmount };
  });

  const totalStake = normalised.reduce((sum, l) => sum.add(l.betAmount), new Prisma.Decimal(0)).toDecimalPlaces(2);

  // Provision the current round (idempotent) outside the transaction.
  const window = computeRoundWindow(input.mode, Date.now());
  const round = await ensureRound(window);

  // Always prefix the stored key with the userId server-side so one user
  // can never collide with (or read back) another user's bet by presenting
  // the same idempotencyKey. The client value is only a per-slip suffix.
  const suffix = (input.idempotencyKey?.trim() || `${round.id}:${randomBytes(9).toString('hex')}`).slice(0, 80);
  const base = `${input.userId}:${suffix}`;
  const keys = normalised.map((_, i) => `${base}:${i}`);

  try {
    return await db.$transaction(async (tx) => {
      const now = new Date();

      // Server-enforced bet close by TIME first: reject at/after
      // betCloseAt even if no tick has flipped the row to closed yet.
      if (now.getTime() >= round.betCloseAt.getTime()) throw new Error(WINGO_ERRORS.BET_CLOSED);

      const fresh = await tx.wingoRound.findUnique({ where: { id: round.id } });
      if (!fresh) throw new Error(WINGO_ERRORS.ROUND_NOT_FOUND);
      if (fresh.status !== 'open') throw new Error(WINGO_ERRORS.BET_CLOSED);

      // Replay: a retried placement with the same key returns the stored
      // lines, wallet untouched. Placement is atomic, so the presence of
      // any line key means all lines committed.
      const prior = await tx.wingoBet.findMany({ where: { userId: input.userId, idempotencyKey: { in: keys } }, orderBy: { createdAt: 'asc' } });
      if (prior.length > 0) {
        const w = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
        return buildResult(fresh, prior, true, Number(w?.balance ?? 0));
      }

      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
      if (!wallet) throw new Error(WINGO_ERRORS.WALLET_NOT_FOUND);
      if (new Prisma.Decimal(wallet.balance).lt(totalStake)) throw new Error(WINGO_ERRORS.INSUFFICIENT_FUNDS);

      // 1. Single wallet debit for the whole slip - one movement covering
      //    every selection, matching how the player experiences it.
      await applyWalletMovement({
        tx,
        userId: input.userId,
        amount: totalStake.neg(),
        type: LEDGER_TYPE.nativeBet,
        description: 'Pasha WinGo bet slip',
        gameUid: WINGO_GAME_CODE,
        gameName: 'Pasha WinGo',
        meta: { gameCode: WINGO_GAME_CODE, scope: 'casino' } as Prisma.JsonObject,
      });

      // 2. Create every pending line.
      const created: WingoBet[] = [];
      for (let i = 0; i < normalised.length; i += 1) {
        const l = normalised[i];
        const bet = await tx.wingoBet.create({
          data: {
            roundId: round.id,
            userId: input.userId,
            mode: input.mode,
            betType: l.betType,
            betValue: l.selection,
            unitAmount: l.unit,
            quantity: l.quantity,
            betAmount: l.betAmount,
            status: 'PENDING',
            idempotencyKey: keys[i],
          },
        });
        created.push(bet);
      }

      // 3. One aggregate bet ledger row for the slip. type 'bet' +
      //    meta.scope 'casino' is what turnover and cashback aggregate
      //    on, exactly like the other native games.
      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: 'bet',
          status: 'completed',
          amount: totalStake.neg(),
          reference: round.id,
          description: 'Pasha WinGo bet',
          meta: {
            gameCode: WINGO_GAME_CODE,
            mode: input.mode,
            roundId: round.id,
            periodNumber: round.periodNumber,
            betIds: created.map((b) => b.id),
            lineCount: created.length,
            scope: 'casino',
          } as Prisma.JsonObject,
        },
      });

      // 4. Round audit aggregates.
      await tx.wingoRound.update({
        where: { id: round.id },
        data: { betCount: { increment: created.length }, totalStake: { increment: totalStake } },
      });

      const after = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
      return buildResult(fresh, created, false, Number(after?.balance ?? 0));
    });
  } catch (err) {
    // A concurrent identical placement won the unique-key race. Treat the
    // loser as a replay: the winner already debited once and stored the
    // lines, so re-read and return them with no second debit.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const prior = await db.wingoBet.findMany({ where: { userId: input.userId, idempotencyKey: { in: keys } }, orderBy: { createdAt: 'asc' } });
      const fresh = await db.wingoRound.findUnique({ where: { id: round.id } });
      if (prior.length > 0 && fresh) {
        const w = await db.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
        return buildResult(fresh, prior, true, Number(w?.balance ?? 0));
      }
    }
    throw err;
  }
}
