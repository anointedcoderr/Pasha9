// Built by Anointed Coder.
//
// POST   /api/me/device-tokens    register a player mobile push token
// DELETE /api/me/device-tokens    unregister by token
//
// The token is an Expo push token issued by the player's native mobile
// app. We store it on PlayerPushDevice (keyed by the unique token) so
// the Expo dispatcher in lib/push/expo.ts can reuse it when sending
// player push. This channel is deliberately separate from the admin
// FCM devices and the web VAPID subscriptions. Multiple devices per
// user are allowed (token is the unique key, not the userId).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const registerSchema = z.object({
  token: z
    .string()
    .min(1)
    .max(200)
    .refine(
      (t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['),
      'invalid Expo push token',
    ),
  // Native FCM registration token, sent by app builds new enough to report
  // it. Its presence switches this device to notification-message delivery
  // (lib/push/player-fcm.ts), which Android displays without waking the app
  // and therefore survives OEM battery managers. Optional so older builds
  // keep registering and fall back to Expo.
  fcmToken: z.string().min(1).max(400).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().max(50).optional(),
});

const unregisterSchema = z.object({
  token: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const limit = rateLimit(`me-device-tokens:${session.sub}`, 30, 10 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const row = await db.playerPushDevice.upsert({
      where: { token: data.token },
      create: {
        userId: session.sub,
        token: data.token,
        fcmToken: data.fcmToken ?? null,
        platform: data.platform ?? null,
        appVersion: data.appVersion ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: session.sub,
        // Only overwrite when the app actually reported one, so a build that
        // cannot supply it never wipes a good token off an existing device.
        ...(data.fcmToken ? { fcmToken: data.fcmToken } : {}),
        platform: data.platform ?? null,
        appVersion: data.appVersion ?? null,
        isActive: true,
        lastSeenAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PLAYER_PUSH_SUBSCRIBE',
      target: row.id,
      meta: { platform: data.platform ?? null, appVersion: data.appVersion ?? null },
    });

    return jsonOk({ ok: true, deviceId: row.id });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const limit = rateLimit(`me-device-tokens:${session.sub}`, 30, 10 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = unregisterSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const row = await db.playerPushDevice.findUnique({ where: { token: parsed.data.token } });
    if (!row || row.userId !== session.sub) return jsonOk({ ok: true });

    await db.playerPushDevice.update({
      where: { token: parsed.data.token },
      data: { isActive: false },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PLAYER_PUSH_UNSUBSCRIBE',
      target: row.id,
    });

    return jsonOk({ ok: true });
  });
}
