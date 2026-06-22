// Built by Anointed Coder.
//
// Server-side FCM dispatcher for ADMIN phone push. Sends to every
// active AdminPushDevice token belonging to the given admin user ids.
// Data-only messages: the visible notification is constructed by
// public/firebase-messaging-sw.js so vibration / requireInteraction /
// tap-routing are fully controlled and there is no duplicate
// notification. Best-effort: every call is wrapped by the caller so a
// failure here can never fail a player-facing submit.

import { db } from '@/lib/db/client';
import { isFirebaseConfigured, getFirebaseAdminMessaging } from '@/lib/firebase/admin';
import {
  type FcmDispatchResult,
  classifyFcmSendError,
  summarizeFcmResult,
} from '@/lib/push/fcm-status';

export interface FcmPushPayload {
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  kind?: string | null;
  priority?: 'low' | 'normal' | 'high';
  notificationId?: string | null;
}

// All notification data is passed as strings (FCM data values must be
// strings) and rendered by the service worker.
function buildDataPayload(payload: FcmPushPayload): Record<string, string> {
  return {
    title: payload.title,
    body: payload.body ?? '',
    linkUrl: payload.linkUrl ?? '/admin',
    kind: payload.kind ?? '',
    priority: payload.priority ?? 'normal',
    notificationId: payload.notificationId ?? '',
  };
}

export async function dispatchFcmToUsers(
  userIds: string[],
  payload: FcmPushPayload,
): Promise<FcmDispatchResult> {
  if (!isFirebaseConfigured()) {
    return { attempted: 0, sent: 0, failed: 0, status: 'provider_setup_required', details: 'Firebase admin not configured' };
  }
  if (userIds.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
  }

  const devices = await db.adminPushDevice.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { id: true, token: true },
  });
  if (devices.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
  }

  let messaging: ReturnType<typeof getFirebaseAdminMessaging>;
  try {
    messaging = getFirebaseAdminMessaging();
  } catch (err) {
    return { attempted: 0, sent: 0, failed: 0, status: 'provider_setup_required', details: err instanceof Error ? err.message : 'messaging init failed' };
  }

  const data = buildDataPayload(payload);
  const urgency = payload.priority === 'high' ? 'high' : 'normal';

  const tokens = devices.map((d) => d.token);
  const response = await messaging.sendEachForMulticast({
    tokens,
    data,
    webpush: {
      headers: { Urgency: urgency, TTL: '3600' },
      fcmOptions: { link: payload.linkUrl ?? '/admin' },
    },
  });

  let sent = 0;
  let failed = 0;
  const now = new Date();
  await Promise.all(
    response.responses.map(async (res, i) => {
      const device = devices[i];
      if (res.success) {
        sent += 1;
        await db.adminPushDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now, failedAt: null, failureReason: null },
        }).catch(() => {});
        return;
      }
      failed += 1;
      const code = res.error?.code;
      const message = res.error?.message ?? String(res.error);
      if (classifyFcmSendError(code) === 'expired') {
        await db.adminPushDevice.update({
          where: { id: device.id },
          data: { isActive: false, failedAt: now, failureReason: (code ?? message).slice(0, 200) },
        }).catch(() => {});
      } else {
        await db.adminPushDevice.update({
          where: { id: device.id },
          data: { failedAt: now, failureReason: message.slice(0, 200) },
        }).catch(() => {});
      }
    }),
  );

  return { attempted: tokens.length, sent, failed, status: summarizeFcmResult(tokens.length, sent, failed) };
}
