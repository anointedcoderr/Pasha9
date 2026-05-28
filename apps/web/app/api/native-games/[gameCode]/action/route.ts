// Built by Anointed Coder.
//
// Pasha Mines action endpoint. Used for two operations on a PENDING
// Mines round:
//
//   POST /api/native-games/mines/action
//     Body: { roundId, action: 'reveal', tile }   -> reveals one tile.
//                                                    Returns hitMine,
//                                                    new multiplier,
//                                                    safeCount, balance.
//     Body: { roundId, action: 'cashout' }        -> finalizes the round
//                                                    for a win at the
//                                                    current multiplier.
//
// Dice is instant-settle so this endpoint is Mines-only. Routing it
// under the [gameCode] segment keeps the URL grammar consistent with
// /bet and /sessions and leaves room for future stateful games.

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
import { cashoutMines, revealMinesTile, NATIVE_ERRORS } from '@/lib/native-games/service';

const revealSchema = z.object({
  action: z.literal('reveal'),
  roundId: z.string().trim().min(1),
  tile: z.coerce.number().int().min(0).max(255),
});

const cashoutSchema = z.object({
  action: z.literal('cashout'),
  roundId: z.string().trim().min(1),
});

const ERR_MAP: Record<string, { status: number; message: string }> = {
  [NATIVE_ERRORS.GAME_NOT_FOUND]: { status: 404, message: 'Game not found.' },
  [NATIVE_ERRORS.GAME_INACTIVE]: { status: 503, message: 'Game is temporarily unavailable.' },
  [NATIVE_ERRORS.ROUND_NOT_FOUND]: { status: 404, message: 'Round not found.' },
  [NATIVE_ERRORS.ROUND_NOT_OWNED]: { status: 403, message: 'Round belongs to another user.' },
  [NATIVE_ERRORS.ROUND_NOT_PENDING]: { status: 400, message: 'Round is no longer in play.' },
  [NATIVE_ERRORS.MINES_NO_SAFE_REVEAL]: { status: 400, message: 'Reveal at least one safe tile before cashing out.' },
  [NATIVE_ERRORS.MINES_TILE_ALREADY_REVEALED]: { status: 400, message: 'Tile already revealed.' },
  [NATIVE_ERRORS.MINES_TILE_OUT_OF_RANGE]: { status: 400, message: 'Tile is outside the grid.' },
};

function mapError(msg: string) {
  const known = ERR_MAP[msg];
  if (known) return jsonError(known.status, msg, known.message);
  console.error('[native-games] unexpected action error', msg);
  return jsonError(500, 'SERVER_ERROR');
}

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  return withAuth(async () => {
    if (!isSupportedGameCode(params.gameCode)) return jsonError(404, 'GAME_NOT_FOUND');
    if (params.gameCode !== GAME_CODES.mines) return jsonError(400, 'GAME_HAS_NO_ACTIONS', 'This game does not support post-bet actions.');
    if (!(await isNativeGamesEnabled())) return jsonError(503, 'NATIVE_GAMES_DISABLED');

    const session = await requireActiveUser();
    const limit = rateLimit(`native-action:${session.sub}:${params.gameCode}`, NATIVE_GAMES_RATE_MAX * 2, NATIVE_GAMES_RATE_WINDOW_MS);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const kind = typeof body?.action === 'string' ? body.action : '';

    if (kind === 'reveal') {
      const parsed = revealSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

      try {
        const result = await revealMinesTile({
          userId: session.sub,
          roundId: parsed.data.roundId,
          tile: parsed.data.tile,
        });
        await recordActivity({
          actorId: session.sub,
          actorRole: session.role,
          action: result.hitMine ? 'NATIVE_LOSS' : 'NATIVE_REVEAL',
          target: result.roundId,
          meta: {
            gameCode: GAME_CODES.mines,
            tile: parsed.data.tile,
            safeCount: result.safeCount,
            currentMultiplier: result.currentMultiplier,
            hitMine: result.hitMine,
          },
        });
        return jsonOk(result);
      } catch (err) {
        return mapError(err instanceof Error ? err.message : String(err));
      }
    }

    if (kind === 'cashout') {
      const parsed = cashoutSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

      try {
        const result = await cashoutMines({
          userId: session.sub,
          roundId: parsed.data.roundId,
        });
        await recordActivity({
          actorId: session.sub,
          actorRole: session.role,
          action: 'NATIVE_WIN',
          target: result.roundId,
          meta: {
            gameCode: GAME_CODES.mines,
            payout: result.payout,
            multiplier: result.multiplier,
          },
        });
        return jsonOk(result);
      } catch (err) {
        return mapError(err instanceof Error ? err.message : String(err));
      }
    }

    return jsonError(400, 'UNKNOWN_ACTION', 'Action must be "reveal" or "cashout".');
  });
}
