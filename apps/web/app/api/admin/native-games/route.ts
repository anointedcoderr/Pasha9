// Built by Anointed Coder.
//
// Admin overview of Pasha Native Games. Returns each catalog row with
// aggregate totals (round count, wagered, paid, house result) computed
// from GameRound. The Games tab in /admin/native-games is driven by
// this endpoint.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listGamesWithTotals } from '@/lib/native-games/service';
import { isNativeGamesEnabled } from '@/lib/native-games/flag';

export async function GET() {
  return withAuth(async () => {
    // users.read is held by anyone who can view the back-office; the
    // dedicated game-config edits are guarded separately at PATCH.
    await ensurePermission('users.read');
    const [enabled, aggregates] = await Promise.all([
      isNativeGamesEnabled(),
      listGamesWithTotals(),
    ]);
    return jsonOk({
      enabled,
      games: aggregates.map((a) => ({
        gameCode: a.game.gameCode,
        displayName: a.game.displayName,
        isActive: a.game.isActive,
        isFeatured: a.game.isFeatured,
        sortOrder: a.game.sortOrder,
        houseEdgeBps: a.game.houseEdgeBps,
        minBet: Number(a.game.minBet),
        maxBet: Number(a.game.maxBet),
        config: a.game.config ?? null,
        totals: {
          rounds: a.totals.rounds,
          rounds24h: a.totals.rounds24h,
          lastRoundAt: a.totals.lastRoundAt,
          wagered: a.totals.wagered,
          paid: a.totals.paid,
          houseResult: a.totals.houseResult,
        },
      })),
    });
  });
}
