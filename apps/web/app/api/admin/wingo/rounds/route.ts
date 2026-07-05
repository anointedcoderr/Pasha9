// Built by Anointed Coder.
//
// Admin recent-rounds audit list for Pasha WinGo. Powers the Rounds tab
// inside /admin/wingo. Accepts mode, status and limit filters. Read-only,
// gated on users.read like the native-games rounds list.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listRecentWingoRounds } from '@/lib/wingo/admin';
import { isWingoMode, type WingoMode } from '@/lib/wingo/config';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('users.read');

    const url = new URL(req.url);
    const modeParam = url.searchParams.get('mode')?.trim();
    const statusParam = url.searchParams.get('status')?.trim()?.toLowerCase();
    const limitParam = Number(url.searchParams.get('limit') ?? 50);

    const mode = modeParam && isWingoMode(modeParam) ? (modeParam as WingoMode) : undefined;
    const status = statusParam && ['open', 'closed', 'drawn', 'settled'].includes(statusParam) ? statusParam : undefined;

    const rounds = await listRecentWingoRounds({
      mode,
      status,
      limit: Number.isFinite(limitParam) ? limitParam : 50,
    });

    return jsonOk({ rounds });
  });
}
