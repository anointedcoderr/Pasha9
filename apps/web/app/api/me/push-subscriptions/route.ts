// Built by Anointed Coder.
//
// POST   /api/me/push-subscriptions    register a browser push subscription
// DELETE /api/me/push-subscriptions    unregister by endpoint
//
// The endpoint, p256dh key and auth secret are issued by the browser
// from the PushManager.subscribe() call. We store them as-is so the
// server can reuse them later when sending real push payloads through
// the VAPID dispatch path in lib/push/dispatch.ts. Multiple devices
// per user are allowed (PushSubscription.endpoint is the unique key,
// not the userId).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
  userAgent: z.string().max(500).optional().nullable(),
  deviceLabel: z.string().max(120).optional().nullable(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const body = await req.json().catch(() => ({}));
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const row = await db.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: session.sub,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent ?? null,
        deviceLabel: data.deviceLabel ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: session.sub,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent ?? null,
        deviceLabel: data.deviceLabel ?? null,
        isActive: true,
        lastSeenAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PUSH_SUBSCRIBE',
      target: row.id,
      meta: { endpointHost: new URL(data.endpoint).host, userAgent: data.userAgent ?? null },
    });

    return jsonOk({ ok: true, subscriptionId: row.id });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const body = await req.json().catch(() => ({}));
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const row = await db.pushSubscription.findUnique({ where: { endpoint: parsed.data.endpoint } });
    if (!row || row.userId !== session.sub) return jsonOk({ ok: true });

    await db.pushSubscription.update({
      where: { endpoint: parsed.data.endpoint },
      data: { isActive: false },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PUSH_UNSUBSCRIBE',
      target: row.id,
    });

    return jsonOk({ ok: true });
  });
}
