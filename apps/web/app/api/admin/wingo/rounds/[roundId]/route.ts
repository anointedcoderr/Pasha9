// Built by Anointed Coder.
//
// Admin round drill-in for Pasha WinGo. Returns one round plus its bet
// lines (with the placing player's username) so an operator can audit
// exactly who staked what and what was paid. Read-only, gated on
// users.read like the rest of the WinGo audit surface.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { getWingoRoundDetail } from '@/lib/wingo/admin';

export async function GET(_req: Request, { params }: { params: { roundId: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const detail = await getWingoRoundDetail(params.roundId);
    if (!detail) return jsonError(404, 'WINGO_ROUND_NOT_FOUND');
    return jsonOk(detail);
  });
}
