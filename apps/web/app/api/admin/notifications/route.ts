// Built by Anointed Coder.
//
// GET  /api/admin/notifications        list recent notifications + recipient count
// POST /api/admin/notifications        send a notification to selected audience

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { dispatchPushToUsers } from '@/lib/push/dispatch';
import { dispatchExpoPushToUsers } from '@/lib/push/expo';

const AUDIENCE = ['all', 'active', 'depositors', 'selected'] as const;

const sendSchema = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleBn: z.string().trim().max(200).optional().nullable(),
  bodyEn: z.string().trim().max(2000).optional().nullable(),
  bodyBn: z.string().trim().max(2000).optional().nullable(),
  linkUrl: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  soundUrl: z.string().trim().max(500).optional().nullable(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  audience: z.enum(AUDIENCE).default('all'),
  userIds: z.array(z.string().min(1).max(60)).max(2000).optional(),
});

async function resolveUserIds(audience: (typeof AUDIENCE)[number], selectedIds: string[] | undefined): Promise<string[]> {
  if (audience === 'selected') {
    if (!selectedIds || selectedIds.length === 0) return [];
    const rows = await db.user.findMany({ where: { id: { in: selectedIds } }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  if (audience === 'depositors') {
    const rows = await db.deposit.findMany({
      where: { status: 'approved' },
      distinct: ['userId'],
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }
  if (audience === 'active') {
    const rows = await db.user.findMany({ where: { status: 'active' }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  // all
  const rows = await db.user.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const rows = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { recipients: true } } },
    });
    return jsonOk({
      notifications: rows.map((n) => ({
        id: n.id,
        titleEn: n.titleEn,
        titleBn: n.titleBn,
        bodyEn: n.bodyEn,
        bodyBn: n.bodyBn,
        linkUrl: n.linkUrl,
        imageUrl: n.imageUrl,
        soundUrl: n.soundUrl,
        priority: n.priority,
        status: n.status,
        audience: n.audience,
        createdAt: n.createdAt,
        recipientCount: n._count.recipients,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const userIds = await resolveUserIds(data.audience, data.userIds);
    if (userIds.length === 0) {
      return jsonError(409, 'EMPTY_AUDIENCE', 'No users matched the selected audience.');
    }

    // Phase 1: create the Notification + every NotificationRecipient
    // with deliveredAt=null. We commit the in-app payload now so the
    // /api/me/notifications endpoint can already return the rows,
    // but we DO NOT claim delivery yet because the web-push channel
    // (the only channel that actually wakes a user's device) has not
    // been attempted.
    //
    // Before this split the route wrote deliveredAt=new Date() inside
    // the transaction. /admin/notifications then showed "delivered to
    // 1000 / 1000" regardless of whether a single push left the
    // server. Operators interpreted that as "the broadcast went out"
    // and players never got a push. Splitting the write means
    // deliveredAt is only stamped once the push dispatch returned
    // with a non-error status, so the admin view reflects actual
    // delivery and a 0-of-1000-pushed broadcast is visible as such.
    const notification = await db.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          titleEn: data.titleEn,
          titleBn: data.titleBn ?? null,
          bodyEn: data.bodyEn ?? null,
          bodyBn: data.bodyBn ?? null,
          linkUrl: data.linkUrl ?? null,
          imageUrl: data.imageUrl ?? null,
          soundUrl: data.soundUrl ?? null,
          priority: data.priority,
          status: 'sent',
          audience: data.audience,
          createdById: session.sub,
        },
      });

      // Bulk-create recipient rows. Chunk to keep the IN-clause SQL
      // size predictable on Postgres.
      const CHUNK = 500;
      for (let i = 0; i < userIds.length; i += CHUNK) {
        const slice = userIds.slice(i, i + CHUNK);
        await tx.notificationRecipient.createMany({
          data: slice.map((uid) => ({
            notificationId: created.id,
            userId: uid,
            deliveredAt: null,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    // Phase 2: attempt push on BOTH player channels. Best-effort; in-app
    // rows already exist and are query-visible to the recipients even if
    // push is not configured. Failures never block the in-app delivery.
    //
    // Two separate channels, and both are required: web VAPID reaches
    // browsers, Expo reaches the native mobile app. This route used to
    // dispatch web only, so an operator broadcast reached Chrome but never
    // the installed app - the player's phone had a registered Expo token
    // that nothing ever sent to. notifyUser() (deposits, withdrawals, and
    // the rest) always dispatched both; only this manual/broadcast path
    // was missing the mobile half.
    //
    // Run in parallel so adding the second channel costs no extra latency
    // on a large broadcast.
    const [pushResult, expoResult] = await Promise.all([
      dispatchPushToUsers(userIds, {
        title: data.titleEn,
        body: data.bodyEn ?? null,
        imageUrl: data.imageUrl ?? null,
        linkUrl: data.linkUrl ?? null,
        notificationId: notification.id,
        soundUrl: data.soundUrl ?? null,
      }).catch((err) => {
        console.error('[notifications] push dispatch failed', err);
        return { attempted: 0, sent: 0, failed: 0, status: 'failed' as const, details: 'dispatch_threw' };
      }),
      dispatchExpoPushToUsers(userIds, {
        title: data.titleEn,
        body: data.bodyEn ?? null,
        linkUrl: data.linkUrl ?? null,
        kind: 'system',
        priority: data.priority === 'high' ? 'high' : 'normal',
        notificationId: notification.id,
      }).catch((err) => {
        console.error('[notifications] expo push dispatch failed', err);
        return { attempted: 0, sent: 0, failed: 0, status: 'failed' };
      }),
    ]);

    // Logged explicitly: without this there is no way to tell a broadcast
    // that reached zero phones from one that reached every phone, which is
    // exactly the blind spot that hid the missing mobile channel.
    console.log(
      `[notifications] expo push: attempted=${expoResult.attempted} sent=${expoResult.sent} failed=${expoResult.failed} status=${expoResult.status}`,
    );

    // Phase 3: stamp deliveredAt now that we know whether the push
    // landed. Policy:
    //   - pushResult.attempted === 0 -> push was not attempted at all
    //     (no VAPID config, no eligible subscriptions). Treat the
    //     in-app row as the canonical delivery channel and stamp
    //     deliveredAt=now() so the admin view reads as delivered.
    //   - pushResult.sent > 0 -> at least one push left the server.
    //     The dispatcher does not return per-user success today, so
    //     mark all recipients delivered (we already have aggregate
    //     pushAttempted/pushFailed in the ActivityLog meta for the
    //     operator to drill into).
    //   - pushResult.sent === 0 && pushResult.attempted > 0 -> push
    //     was attempted and every attempt failed (provider down,
    //     network error, expired subscriptions). Leave deliveredAt
    //     null so the admin view shows the broadcast as undelivered.
    //     The in-app row still exists so the user will see it on
    //     their next /me/notifications fetch, but the operator now
    //     has a clear signal that the push channel failed.
    // Either channel landing counts as delivered - a player on mobile only
    // is just as reached as one on web only.
    const pushSucceeded =
      (pushResult.attempted === 0 && expoResult.attempted === 0) ||
      pushResult.sent > 0 ||
      expoResult.sent > 0;
    if (pushSucceeded) {
      try {
        await db.notificationRecipient.updateMany({
          where: { notificationId: notification.id, deliveredAt: null },
          data: { deliveredAt: new Date() },
        });
      } catch (err) {
        console.error('[notifications] deliveredAt stamp failed', err);
      }
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'NOTIFICATION_SEND',
      target: notification.id,
      detail: notification.titleEn,
      meta: {
        audience: data.audience,
        recipientCount: userIds.length,
        pushStatus: pushResult.status,
        pushAttempted: pushResult.attempted,
        pushSent: pushResult.sent,
        pushFailed: pushResult.failed,
        expoStatus: expoResult.status,
        expoAttempted: expoResult.attempted,
        expoSent: expoResult.sent,
        expoFailed: expoResult.failed,
      } as Prisma.JsonObject,
    });

    return jsonOk({
      ok: true,
      notificationId: notification.id,
      recipientCount: userIds.length,
      push: pushResult,
      expoPush: expoResult,
    });
  });
}
