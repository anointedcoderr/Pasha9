// Built by Anointed Coder.
//
// GET /api/admin/me/notifications
// Feed for the AdminTopbar bell. Returns the 50 most recent admin-
// targeted notifications for the staff user currently logged in, plus
// an unreadCount so the badge can render before the popover opens.
//
// "Admin-targeted" means Notification.kind starts with "admin_" so a
// staff user who also tests the player flow on their own account does
// not see player celebration popups inside the admin shell.
//
// POST /api/admin/me/notifications/read
// Marks one or many of the current admin's notification rows as read.
// Body: { recipientIds?: string[], all?: boolean }
//   - { all: true } marks every unread admin notification for this user
//   - { recipientIds: [...] } marks only those rows (still scoped to
//     the current admin so a stolen recipientId from someone else does
//     nothing)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireStaff } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const ADMIN_KIND_PREFIX = 'admin_';

export async function GET() {
  return withAuth(async () => {
    const session = await requireStaff();

    const [rows, unreadCount] = await Promise.all([
      db.notificationRecipient.findMany({
        where: {
          userId: session.sub,
          notification: { kind: { startsWith: ADMIN_KIND_PREFIX } },
        },
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
              priority: true,
              kind: true,
              createdAt: true,
            },
          },
        },
      }),
      db.notificationRecipient.count({
        where: {
          userId: session.sub,
          readAt: null,
          notification: { kind: { startsWith: ADMIN_KIND_PREFIX } },
        },
      }),
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
        priority: r.notification.priority,
        kind: r.notification.kind,
        readAt: r.readAt,
        deliveredAt: r.deliveredAt,
        createdAt: r.notification.createdAt,
      })),
    });
  });
}

interface ReadBody {
  recipientIds?: unknown;
  all?: unknown;
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireStaff();
    const body = (await req.json().catch(() => ({}))) as ReadBody;

    const now = new Date();

    if (body.all === true) {
      const result = await db.notificationRecipient.updateMany({
        where: {
          userId: session.sub,
          readAt: null,
          notification: { kind: { startsWith: ADMIN_KIND_PREFIX } },
        },
        data: { readAt: now },
      });
      return jsonOk({ marked: result.count });
    }

    const ids = Array.isArray(body.recipientIds)
      ? body.recipientIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : [];
    if (ids.length === 0) {
      return jsonError(400, 'VALIDATION', 'Provide recipientIds or { all: true }.');
    }

    // Scope strictly to the caller — a stolen recipient id from
    // another admin cannot be silently flipped to read.
    const result = await db.notificationRecipient.updateMany({
      where: {
        id: { in: ids },
        userId: session.sub,
        notification: { kind: { startsWith: ADMIN_KIND_PREFIX } },
      },
      data: { readAt: now },
    });
    return jsonOk({ marked: result.count });
  });
}
