// Built by Anointed Coder.
//
// Public single-game config. The play pages call this on mount to get
// the live min/max/edge/config before showing the bet form.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { isNativeGamesEnabled } from '@/lib/native-games/flag';
import { isSupportedGameCode } from '@/lib/native-games/config';

export async function GET(_req: Request, { params }: { params: { gameCode: string } }) {
  if (!isSupportedGameCode(params.gameCode)) {
    return jsonError(404, 'GAME_NOT_FOUND');
  }
  const enabled = await isNativeGamesEnabled();
  const game = await db.nativeGameProvider.findUnique({ where: { gameCode: params.gameCode } });
  if (!game) return jsonError(404, 'GAME_NOT_FOUND');
  return jsonOk({
    enabled,
    game: {
      gameCode: game.gameCode,
      displayName: game.displayName,
      isActive: game.isActive,
      houseEdgeBps: game.houseEdgeBps,
      minBet: Number(game.minBet),
      maxBet: Number(game.maxBet),
      config: game.config ?? null,
    },
  });
}
