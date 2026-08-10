// Built by Anointed Coder.
//
// Public popup list. Filtered by the viewer's SIGNED-IN STATE, because a
// first-time visitor was being shown reward popups stacked over the
// registration screen, which is the one thing that screen must not compete
// with.
//
//   guest    - only before registration / login
//   authed   - only after
//   both     - either
//   disabled - never, without deleting the row
//
// The filter runs on the server rather than in the browser so a guest is never
// sent the content of a members-only popup at all.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { getCurrentSession } from '@/lib/auth/rbac';

// Revalidation is off: the response now differs per viewer, so a shared cached
// copy would serve one audience's popups to the other.
export const revalidate = 0;

export async function GET() {
  const now = new Date();

  // Never throws: an unreadable or absent session simply means "guest", which
  // is the safe reading. Failing closed here would hide every popup.
  let signedIn = false;
  try {
    signedIn = Boolean(await getCurrentSession());
  } catch {
    signedIn = false;
  }

  const popups = await db.popupAnnouncement.findMany({
    where: {
      status: 'active',
      // 'disabled' is excluded by never appearing in this list.
      audience: signedIn ? { in: ['authed', 'both'] } : { in: ['guest', 'both'] },
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
      audience: true,
      imageUrl: true,
      audioUrl: true,
    },
  });

  // `popups` is the targeting-aware list; `popup` stays for any older
  // client that expected the single most-recent entry.
  return jsonOk({ popups, popup: popups[0] ?? null, signedIn });
}
