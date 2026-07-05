// Built by Anointed Coder.
//
// Pasha WinGo player "My history" feed. Authenticated. Returns the
// signed-in player's bets newest first, with each bet's round result
// joined in so the client can render the outcome (won / lost, payout)
// without a second call. Keyset-paginated via `before`.
//
// GET /api/games/wingo/my-bets?mode=wingo_30s&limit=20&before=<ISO>
//   mode   optional; filters to one mode
//   limit  optional; 1..50, default 20
//   before optional; createdAt ISO of the last row for the next page
//
// Response: { ok, bets: [ { id, roundId, mode, periodNumber, betType,
//   selection, stake, quantity, betAmount, status, payoutMultiplier,
//   payoutAmount, result, resultColor, resultSize, roundStatus, drawsAt,
//   createdAt, settledAt } ], nextBefore: string | null }.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { isWingoMode, type WingoMode } from '@/lib/wingo/config';
import { listUserBets } from '@/lib/wingo/read';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const auth = await requireActiveUser();

    const sp = req.nextUrl.searchParams;
    const modeParam = (sp.get('mode') ?? '').trim();
    const mode = isWingoMode(modeParam) ? (modeParam as WingoMode) : undefined;

    const limitRaw = Number(sp.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 20;

    const before = sp.get('before') ?? undefined;

    const { bets, nextBefore } = await listUserBets(auth.sub, { mode, limit, before });
    return jsonOk({ bets, nextBefore });
  });
}
