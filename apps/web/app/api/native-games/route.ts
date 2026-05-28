// Built by Anointed Coder.
//
// Public catalog of Pasha Native Games. Used by the /games lobby and
// any signed-in client to discover which games are currently playable
// and what the bet bounds + house edge are. Never returns serverSeed
// or other private state.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { isNativeGamesEnabled } from '@/lib/native-games/flag';

export async function GET() {
  const enabled = await isNativeGamesEnabled();
  const games = await db.nativeGameProvider.findMany({ orderBy: { displayName: 'asc' } });
  return jsonOk({
    enabled,
    games: games.map((g) => ({
      gameCode: g.gameCode,
      displayName: g.displayName,
      isActive: g.isActive,
      houseEdgeBps: g.houseEdgeBps,
      minBet: Number(g.minBet),
      maxBet: Number(g.maxBet),
      config: g.config ?? null,
    })),
  });
}
