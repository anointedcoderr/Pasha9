// Built by Anointed Coder.
//
// Admin filtered round history. Powers the Rounds tab inside
// /admin/native-games. Accepts gameCode, userId, outcome, limit.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listRecentRounds } from '@/lib/native-games/service';
import { isSupportedGameCode } from '@/lib/native-games/config';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('users.read');

    const url = new URL(req.url);
    const gameCodeParam = url.searchParams.get('gameCode')?.trim();
    const userIdParam = url.searchParams.get('userId')?.trim();
    const outcomeParam = url.searchParams.get('outcome')?.trim()?.toUpperCase();
    const limitParam = Number(url.searchParams.get('limit') ?? 50);

    const gameCode = gameCodeParam && isSupportedGameCode(gameCodeParam) ? gameCodeParam : undefined;
    const outcome = outcomeParam && ['PENDING', 'WIN', 'LOSS', 'CASHOUT', 'CANCELLED'].includes(outcomeParam) ? outcomeParam : undefined;

    const rows = await listRecentRounds({
      gameCode,
      userId: userIdParam || undefined,
      outcome,
      limit: Number.isFinite(limitParam) ? limitParam : 50,
    });

    return jsonOk({
      rounds: rows.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        userId: r.userId,
        actorUsername: r.actorUsername ?? null,
        gameCode: r.gameCode,
        nonce: r.nonce,
        betAmount: Number(r.betAmount),
        payoutAmount: Number(r.payoutAmount),
        payoutMultiplier: Number(r.payoutMultiplier),
        outcome: r.outcome,
        gameData: r.gameData ?? null,
        settledAt: r.settledAt,
        createdAt: r.createdAt,
      })),
    });
  });
}
