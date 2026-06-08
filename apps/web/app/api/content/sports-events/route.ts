// Built by Anointed Coder.
//
// GET /api/content/sports-events
// Returns up to 40 active fixtures ordered with live first, then the
// soonest upcoming, then admin sortOrder. The public homepage
// SportsbookFixturesCarousel polls this endpoint every 60 seconds so
// live status changes appear without a page reload.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const rows = await db.sportsEvent.findMany({
    where: { isActive: true, status: { in: ['upcoming', 'live'] } },
    orderBy: [{ status: 'asc' }, { startsAt: 'asc' }, { sortOrder: 'asc' }],
    take: 40,
    select: {
      id: true,
      sportType: true,
      status: true,
      leagueNameEn: true,
      leagueNameBn: true,
      startsAt: true,
      teamAName: true,
      teamAShortName: true,
      teamALogoUrl: true,
      teamBName: true,
      teamBShortName: true,
      teamBLogoUrl: true,
      providerName: true,
      deepLinkUrl: true,
      sortOrder: true,
    },
  });
  return jsonOk({ events: rows });
}
