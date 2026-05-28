// Built by Anointed Coder.
//
// Pasha Native Games bet endpoint. Dispatches by gameCode to the
// matching service settler. Wallet movement is server-side, atomic
// and idempotency-key-protected (see lib/native-games/service.ts).
// The bet amount is fed into the M2D bonus turnover engine AFTER the
// transaction commits so a bonus failure cannot rollback the bet.
//
// Per-game request bodies:
//   dice     -> { sessionId, target, direction, betAmount, idempotencyKey? }
//   mines    -> { sessionId, mineCount, betAmount, idempotencyKey? }
//   keno     -> { sessionId, picks: number[], betAmount, idempotencyKey? }
//   roulette -> { sessionId, betType, straightNumber?, betAmount, idempotencyKey? }
//   slots    -> { sessionId, betAmount, idempotencyKey? }
//   crash    -> { sessionId, targetMultiplier, betAmount, idempotencyKey? }

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { isNativeGamesEnabled } from '@/lib/native-games/flag';
import {
  GAME_CODES,
  NATIVE_GAMES_RATE_MAX,
  NATIVE_GAMES_RATE_WINDOW_MS,
  isSupportedGameCode,
} from '@/lib/native-games/config';
import {
  settleDiceBet,
  startMinesRound,
  settleKenoBet,
  settleRouletteBet,
  settleSlotsBet,
  settleCrashBet,
  NATIVE_ERRORS,
} from '@/lib/native-games/service';
import { addTurnover } from '@/lib/bonuses/engine';

const diceSchema = z.object({
  sessionId: z.string().trim().min(1),
  target: z.coerce.number().int().min(2).max(98),
  direction: z.enum(['over', 'under']),
  betAmount: z.coerce.number().positive().max(10_000_000),
  idempotencyKey: z.string().trim().max(128).optional(),
});

const minesSchema = z.object({
  sessionId: z.string().trim().min(1),
  mineCount: z.coerce.number().int().min(1).max(24),
  betAmount: z.coerce.number().positive().max(10_000_000),
  idempotencyKey: z.string().trim().max(128).optional(),
});

const kenoSchema = z.object({
  sessionId: z.string().trim().min(1),
  picks: z.array(z.coerce.number().int().min(1).max(999)).min(1).max(20),
  betAmount: z.coerce.number().positive().max(10_000_000),
  idempotencyKey: z.string().trim().max(128).optional(),
});

const rouletteSchema = z.object({
  sessionId: z.string().trim().min(1),
  betType: z.enum(['red', 'black', 'odd', 'even', 'high', 'low', 'straight']),
  straightNumber: z.coerce.number().int().min(0).max(36).optional(),
  betAmount: z.coerce.number().positive().max(10_000_000),
  idempotencyKey: z.string().trim().max(128).optional(),
});

const slotsSchema = z.object({
  sessionId: z.string().trim().min(1),
  betAmount: z.coerce.number().positive().max(10_000_000),
  idempotencyKey: z.string().trim().max(128).optional(),
});

const crashSchema = z.object({
  sessionId: z.string().trim().min(1),
  targetMultiplier: z.coerce.number().min(1.01).max(100),
  betAmount: z.coerce.number().positive().max(10_000_000),
  idempotencyKey: z.string().trim().max(128).optional(),
});

const ERR_MAP: Record<string, { status: number; message: string }> = {
  [NATIVE_ERRORS.GAME_NOT_FOUND]: { status: 404, message: 'Game not found.' },
  [NATIVE_ERRORS.GAME_INACTIVE]: { status: 503, message: 'This game is temporarily unavailable.' },
  [NATIVE_ERRORS.SESSION_NOT_FOUND]: { status: 404, message: 'Session not found.' },
  [NATIVE_ERRORS.SESSION_NOT_OWNED]: { status: 403, message: 'Session belongs to another user.' },
  [NATIVE_ERRORS.SESSION_INACTIVE]: { status: 400, message: 'Session is closed. Start a new one.' },
  [NATIVE_ERRORS.WALLET_NOT_FOUND]: { status: 404, message: 'Wallet not found.' },
  [NATIVE_ERRORS.INSUFFICIENT_FUNDS]: { status: 400, message: 'Wallet balance is lower than the bet.' },
  [NATIVE_ERRORS.BET_BELOW_MIN]: { status: 400, message: 'Bet is below the minimum.' },
  [NATIVE_ERRORS.BET_ABOVE_MAX]: { status: 400, message: 'Bet exceeds the maximum.' },
  [NATIVE_ERRORS.MINES_INVALID_COUNT]: { status: 400, message: 'Mine count is out of range.' },
  DICE_TARGET_OUT_OF_RANGE: { status: 400, message: 'Target is outside the allowed range.' },
  KENO_PICK_COUNT_OUT_OF_RANGE: { status: 400, message: 'Number of picks is outside the allowed range.' },
  KENO_PICK_OUT_OF_RANGE: { status: 400, message: 'Pick is outside the Keno pool.' },
  KENO_PICK_DUPLICATE: { status: 400, message: 'Duplicate Keno picks are not allowed.' },
  KENO_TOO_MANY_PICKS: { status: 400, message: 'Too many Keno picks.' },
  ROULETTE_WHEEL_UNSUPPORTED: { status: 500, message: 'Roulette wheel configuration unsupported.' },
  ROULETTE_STRAIGHT_NUMBER_INVALID: { status: 400, message: 'Straight bet requires a number 0-36.' },
  SLOTS_REELS_INVALID: { status: 500, message: 'Slot reel configuration invalid.' },
  SLOTS_SYMBOLS_INVALID: { status: 500, message: 'Slot symbol set invalid.' },
  CRASH_TARGET_OUT_OF_RANGE: { status: 400, message: 'Auto-cashout target out of range.' },
  CRASH_TARGET_INVALID: { status: 400, message: 'Auto-cashout target invalid.' },
  CRASH_TARGET_BELOW_MIN: { status: 400, message: 'Auto-cashout target below minimum.' },
  CRASH_TARGET_ABOVE_MAX: { status: 400, message: 'Auto-cashout target above maximum.' },
};

function mapError(msg: string) {
  const known = ERR_MAP[msg];
  if (known) return jsonError(known.status, msg, known.message);
  console.error('[native-games] unexpected bet error', msg);
  return jsonError(500, 'SERVER_ERROR');
}

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  return withAuth(async () => {
    if (!isSupportedGameCode(params.gameCode)) return jsonError(404, 'GAME_NOT_FOUND');
    if (!(await isNativeGamesEnabled())) return jsonError(503, 'NATIVE_GAMES_DISABLED');

    const session = await requireActiveUser();
    const limit = rateLimit(`native-bet:${session.sub}:${params.gameCode}`, NATIVE_GAMES_RATE_MAX, NATIVE_GAMES_RATE_WINDOW_MS);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));

    try {
      switch (params.gameCode) {
        case GAME_CODES.dice: {
          const parsed = diceSchema.safeParse(body);
          if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
          const result = await settleDiceBet({
            userId: session.sub,
            sessionId: parsed.data.sessionId,
            target: parsed.data.target,
            direction: parsed.data.direction,
            betAmount: parsed.data.betAmount,
            idempotencyKey: parsed.data.idempotencyKey,
          });
          if (!result.reused) {
            addTurnover({ userId: session.sub, amount: parsed.data.betAmount, kind: 'native_game', reference: result.roundId, meta: { gameCode: GAME_CODES.dice } })
              .catch((err) => console.error('[native-games] addTurnover failed', err));
            await recordActivity({
              actorId: session.sub,
              actorRole: session.role,
              action: result.win ? 'NATIVE_WIN' : 'NATIVE_LOSS',
              target: result.roundId,
              meta: { gameCode: GAME_CODES.dice, sessionId: parsed.data.sessionId, betAmount: parsed.data.betAmount, payout: result.payout, multiplier: result.multiplier },
            });
          }
          return jsonOk(result, 201);
        }

        case GAME_CODES.mines: {
          const parsed = minesSchema.safeParse(body);
          if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
          const result = await startMinesRound({
            userId: session.sub,
            sessionId: parsed.data.sessionId,
            mineCount: parsed.data.mineCount,
            betAmount: parsed.data.betAmount,
            idempotencyKey: parsed.data.idempotencyKey,
          });
          if (!result.reused) {
            addTurnover({ userId: session.sub, amount: parsed.data.betAmount, kind: 'native_game', reference: result.roundId, meta: { gameCode: GAME_CODES.mines } })
              .catch((err) => console.error('[native-games] addTurnover failed', err));
            await recordActivity({
              actorId: session.sub,
              actorRole: session.role,
              action: 'NATIVE_BET',
              target: result.roundId,
              meta: { gameCode: GAME_CODES.mines, sessionId: parsed.data.sessionId, betAmount: parsed.data.betAmount, mineCount: parsed.data.mineCount },
            });
          }
          return jsonOk(result, 201);
        }

        case GAME_CODES.keno: {
          const parsed = kenoSchema.safeParse(body);
          if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
          const result = await settleKenoBet({
            userId: session.sub,
            sessionId: parsed.data.sessionId,
            picks: parsed.data.picks,
            betAmount: parsed.data.betAmount,
            idempotencyKey: parsed.data.idempotencyKey,
          });
          if (!result.reused) {
            addTurnover({ userId: session.sub, amount: parsed.data.betAmount, kind: 'native_game', reference: result.roundId, meta: { gameCode: GAME_CODES.keno } })
              .catch((err) => console.error('[native-games] addTurnover failed', err));
            await recordActivity({
              actorId: session.sub,
              actorRole: session.role,
              action: result.win ? 'NATIVE_WIN' : 'NATIVE_LOSS',
              target: result.roundId,
              meta: { gameCode: GAME_CODES.keno, sessionId: parsed.data.sessionId, betAmount: parsed.data.betAmount, payout: result.payout, matches: result.matchCount },
            });
          }
          return jsonOk(result, 201);
        }

        case GAME_CODES.roulette: {
          const parsed = rouletteSchema.safeParse(body);
          if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
          if (parsed.data.betType === 'straight' && parsed.data.straightNumber === undefined) {
            return jsonError(400, 'ROULETTE_STRAIGHT_NUMBER_INVALID', 'Straight bet requires a number 0-36.');
          }
          const result = await settleRouletteBet({
            userId: session.sub,
            sessionId: parsed.data.sessionId,
            betType: parsed.data.betType,
            straightNumber: parsed.data.straightNumber,
            betAmount: parsed.data.betAmount,
            idempotencyKey: parsed.data.idempotencyKey,
          });
          if (!result.reused) {
            addTurnover({ userId: session.sub, amount: parsed.data.betAmount, kind: 'native_game', reference: result.roundId, meta: { gameCode: GAME_CODES.roulette } })
              .catch((err) => console.error('[native-games] addTurnover failed', err));
            await recordActivity({
              actorId: session.sub,
              actorRole: session.role,
              action: result.win ? 'NATIVE_WIN' : 'NATIVE_LOSS',
              target: result.roundId,
              meta: { gameCode: GAME_CODES.roulette, sessionId: parsed.data.sessionId, betAmount: parsed.data.betAmount, payout: result.payout, result: result.result },
            });
          }
          return jsonOk(result, 201);
        }

        case GAME_CODES.slots: {
          const parsed = slotsSchema.safeParse(body);
          if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
          const result = await settleSlotsBet({
            userId: session.sub,
            sessionId: parsed.data.sessionId,
            betAmount: parsed.data.betAmount,
            idempotencyKey: parsed.data.idempotencyKey,
          });
          if (!result.reused) {
            addTurnover({ userId: session.sub, amount: parsed.data.betAmount, kind: 'native_game', reference: result.roundId, meta: { gameCode: GAME_CODES.slots } })
              .catch((err) => console.error('[native-games] addTurnover failed', err));
            await recordActivity({
              actorId: session.sub,
              actorRole: session.role,
              action: result.win ? 'NATIVE_WIN' : 'NATIVE_LOSS',
              target: result.roundId,
              meta: { gameCode: GAME_CODES.slots, sessionId: parsed.data.sessionId, betAmount: parsed.data.betAmount, payout: result.payout, matched: result.matchedSymbol },
            });
          }
          return jsonOk(result, 201);
        }

        case GAME_CODES.crash: {
          const parsed = crashSchema.safeParse(body);
          if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
          const result = await settleCrashBet({
            userId: session.sub,
            sessionId: parsed.data.sessionId,
            targetMultiplier: parsed.data.targetMultiplier,
            betAmount: parsed.data.betAmount,
            idempotencyKey: parsed.data.idempotencyKey,
          });
          if (!result.reused) {
            addTurnover({ userId: session.sub, amount: parsed.data.betAmount, kind: 'native_game', reference: result.roundId, meta: { gameCode: GAME_CODES.crash } })
              .catch((err) => console.error('[native-games] addTurnover failed', err));
            await recordActivity({
              actorId: session.sub,
              actorRole: session.role,
              action: result.win ? 'NATIVE_WIN' : 'NATIVE_LOSS',
              target: result.roundId,
              meta: { gameCode: GAME_CODES.crash, sessionId: parsed.data.sessionId, betAmount: parsed.data.betAmount, target: parsed.data.targetMultiplier, crashPoint: result.crashPoint, payout: result.payout },
            });
          }
          return jsonOk(result, 201);
        }

        default:
          return jsonError(404, 'GAME_NOT_FOUND');
      }
    } catch (err) {
      return mapError(err instanceof Error ? err.message : String(err));
    }
  });
}
