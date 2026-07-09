// Built by Anointed Coder.
//
// Admin config for the two display-only site sections (24h leaderboard and
// recent-winners feed), backed by SystemSetting rows. Mirrors the Pasha
// WinGo admin contract:
//   - GET   requires users.read  (anyone who can view the back office)
//   - PATCH requires settings.write (the same perm the other toggles use)
//
// Both sections default ON in lib/content/section-flags.ts, so this
// surface is the only way to turn one off. No money logic lives here.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadSectionFlags, setLeaderboardEnabled, setRecentWinnersEnabled } from '@/lib/content/section-flags';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const flags = await loadSectionFlags();
    return jsonOk({ flags });
  });
}

const patchSchema = z.object({
  leaderboard: z.boolean().optional(),
  recentWinners: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const before = await loadSectionFlags();

    if (parsed.data.leaderboard !== undefined) {
      await setLeaderboardEnabled(parsed.data.leaderboard);
    }
    if (parsed.data.recentWinners !== undefined) {
      await setRecentWinnersEnabled(parsed.data.recentWinners);
    }

    const after = await loadSectionFlags();

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'SECTION_FLAGS_UPDATE',
      target: 'section-flags',
      meta: { before, after },
    });

    return jsonOk({ flags: after });
  });
}
