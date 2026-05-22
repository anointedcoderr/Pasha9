// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 30;

export async function GET() {
  const now = new Date();
  const popup = await db.popupAnnouncement.findFirst({
    where: {
      status: 'active',
      OR: [
        { AND: [{ startAt: null }, { endAt: null }] },
        { AND: [{ startAt: { lte: now } }, { OR: [{ endAt: null }, { endAt: { gte: now } }] }] },
        { AND: [{ startAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk({ popup });
}
