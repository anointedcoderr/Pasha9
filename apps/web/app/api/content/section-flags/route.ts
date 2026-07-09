// Built by Anointed Coder.
//
// GET /api/content/section-flags
//
// Cheap, public read of the two site-section on/off flags so the nav
// (Sidebar + MobileDrawer) and the display components can gate themselves
// client-side. No auth, no money movement. Never throws: on any failure
// it returns the defaults (both sections ON) so navigation never breaks.
//
// Cached briefly at the edge (a few seconds) so a burst of visitors does
// not hammer the settings table, while an admin toggle still propagates
// almost immediately.

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { loadSectionFlags, DEFAULT_SECTION_FLAGS } from '@/lib/content/section-flags';

export async function GET() {
  let flags = DEFAULT_SECTION_FLAGS;
  try {
    flags = await loadSectionFlags();
  } catch {
    flags = DEFAULT_SECTION_FLAGS;
  }
  return NextResponse.json(
    { ok: true, leaderboard: flags.leaderboard, recentWinners: flags.recentWinners },
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=5, s-maxage=10, stale-while-revalidate=30',
      },
    },
  );
}
