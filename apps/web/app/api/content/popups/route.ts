// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 30;

export async function GET() {
  const now = new Date();
  const popups = await db.popupAnnouncement.findMany({
    where: {
      status: 'active',
      OR: [
        { AND: [{ startAt: null }, { endAt: null }] },
        { AND: [{ startAt: { lte: now } }, { OR: [{ endAt: null }, { endAt: { gte: now } }] }] },
        { AND: [{ startAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      body: true,
      ctaLabel: true,
      ctaHref: true,
      target: true,
      targetUrl: true,
      frequency: true,
      imageUrl: true,
      audioUrl: true,
    },
  });
  // `popups` is the targeting-aware list; `popup` stays for any older
  // client that expected the single most-recent entry.
  return jsonOk({ popups, popup: popups[0] ?? null });
}
