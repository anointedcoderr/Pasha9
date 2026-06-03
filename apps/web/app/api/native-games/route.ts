// Built by Anointed Coder.
//
// Public catalog of Pasha Native Games. Used by the /games lobby,
// homepage Hot Games strip and any signed-in client to discover
// which games are currently playable. Returns sortOrder + isFeatured
// + frontHref so the UI can render directly off the API payload.
// Never returns serverSeed or other private state.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { isNativeGamesEnabled, isNativeGamesPublic } from '@/lib/native-games/flag';
import { PLAY_PAGES, isSupportedGameCode } from '@/lib/native-games/config';

export async function GET() {
  // Public visibility flag overrides the global enable flag. While
  // native_games_public_enabled is false the endpoint reports
  // enabled=false to the public so the homepage strip + /games card
  // grid + drawer entries all stay hidden, even when the admin tooling
  // at /admin/native-games is still in use.
  const [enabled, publicEnabled] = await Promise.all([isNativeGamesEnabled(), isNativeGamesPublic()]);
  const games = await db.nativeGameProvider.findMany({
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
  });
  return jsonOk({
    enabled: enabled && publicEnabled,
    games: games.map((g) => ({
      gameCode: g.gameCode,
      displayName: g.displayName,
      isActive: g.isActive,
      isFeatured: g.isFeatured,
      sortOrder: g.sortOrder,
      houseEdgeBps: g.houseEdgeBps,
      minBet: Number(g.minBet),
      maxBet: Number(g.maxBet),
      config: g.config ?? null,
      frontHref: isSupportedGameCode(g.gameCode) ? PLAY_PAGES[g.gameCode] : null,
    })),
  });
}
