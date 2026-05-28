// Built by Anointed Coder.
//
// Pasha Native Games bet endpoint.
//
// POST /api/native-games/dice/bet
//   Body: { sessionId, target, direction, betAmount, idempotencyKey? }
//   Instant settle. Returns the result + new wallet balance.
//
// POST /api/native-games/mines/bet
//   Body: { sessionId, mineCount, betAmount, idempotencyKey? }
//   Returns the new pending round. Mine positions stay server-side.
//
// The wallet movement is server-side, atomic and idempotency-key-
// protected (see lib/native-games/service.ts). The bet amount feeds
// the M2D bonus turnover engine after the transaction commits so a
// bonus failure cannot rollback the bet itself.

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
import { settleDiceBet, startMinesRound, NATIVE_ERRORS } from '@/lib/native-games/service';
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

    if (params.gameCode === GAME_CODES.dice) {
      const parsed = diceSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

      try {
        const result = await settleDiceBet({
          userId: session.sub,
          sessionId: parsed.data.sessionId,
          target: parsed.data.target,
          direction: parsed.data.direction,
          betAmount: parsed.data.betAmount,
          idempotencyKey: parsed.data.idempotencyKey,
        });

        if (!result.reused) {
          // Fail-safe: turnover progress is best-effort and never blocks
          // the bet. Bonus engine handles missing grants silently.
          addTurnover({ userId: session.sub, amount: parsed.data.betAmount, kind: 'native_game', reference: result.roundId, meta: { gameCode: GAME_CODES.dice } })
            .catch((err) => console.error('[native-games] addTurnover failed', err));

          await recordActivity({
            actorId: session.sub,
            actorRole: session.role,
            action: result.win ? 'NATIVE_WIN' : 'NATIVE_LOSS',
            target: result.roundId,
            meta: {
              gameCode: GAME_CODES.dice,
              sessionId: parsed.data.sessionId,
              betAmount: parsed.data.betAmount,
              payout: result.payout,
              multiplier: result.multiplier,
            },
          });
        }

        return jsonOk(result, 201);
      } catch (err) {
        return mapError(err instanceof Error ? err.message : String(err));
      }
    }

    if (params.gameCode === GAME_CODES.mines) {
      const parsed = minesSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

      try {
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
            meta: {
              gameCode: GAME_CODES.mines,
              sessionId: parsed.data.sessionId,
              betAmount: parsed.data.betAmount,
              mineCount: parsed.data.mineCount,
            },
          });
        }

        return jsonOk(result, 201);
      } catch (err) {
        return mapError(err instanceof Error ? err.message : String(err));
      }
    }

    return jsonError(404, 'GAME_NOT_FOUND');
  });
}
