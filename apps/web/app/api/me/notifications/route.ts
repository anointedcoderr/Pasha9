// Built by Anointed Coder.
//
// GET /api/me/notifications
// Returns the most recent 50 notifications for the logged-in player
// with a parallel `unreadCount` so the header bell can show its
// badge without a second roundtrip.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const [rows, unreadCount] = await Promise.all([
      db.notificationRecipient.findMany({
        where: { userId: session.sub },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          notification: {
            select: {
              id: true,
              titleEn: true,
              titleBn: true,
              bodyEn: true,
              bodyBn: true,
              linkUrl: true,
              imageUrl: true,
              soundUrl: true,
              priority: true,
              kind: true,
              createdAt: true,
            },
          },
        },
      }),
      db.notificationRecipient.count({ where: { userId: session.sub, readAt: null } }),
    ]);

    return jsonOk({
      unreadCount,
      notifications: rows.map((r) => ({
        recipientId: r.id,
        id: r.notification.id,
        titleEn: r.notification.titleEn,
        titleBn: r.notification.titleBn,
        bodyEn: r.notification.bodyEn,
        bodyBn: r.notification.bodyBn,
        linkUrl: r.notification.linkUrl,
        imageUrl: r.notification.imageUrl,
        soundUrl: r.notification.soundUrl,
        priority: r.notification.priority,
        kind: r.notification.kind,
        readAt: r.readAt,
        deliveredAt: r.deliveredAt,
        createdAt: r.notification.createdAt,
      })),
    });
  });
}
