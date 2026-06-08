// Built by Anointed Coder.
//
// Web Push dispatcher. Lazy-loads the optional `web-push` dependency
// so the build does not break when the package is unavailable; the
// sender returns `provider_setup_required` in that case and the
// caller stays on the in-app notification path. Errors that come back
// from the push service with 404 / 410 mark the subscription
// inactive so the next dispatch skips it.

import { db } from '@/lib/db/client';
import { isVapidConfigured } from './vapid-provider';

export interface PushPayload {
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  iconUrl?: string | null;
  linkUrl?: string | null;
  notificationId?: string | null;
  recipientId?: string | null;
  soundUrl?: string | null;
}

export interface PushDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  status: 'sent' | 'partial' | 'failed' | 'provider_setup_required' | 'skipped_no_subscriptions';
  details?: string | null;
}

interface WebPushModule {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' },
  ) => Promise<{ statusCode: number; body: string }>;
}

let webPushPromise: Promise<WebPushModule | null> | null = null;
let webPushConfigured = false;

async function loadWebPush(): Promise<WebPushModule | null> {
  if (webPushPromise) return webPushPromise;
  webPushPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('web-push');
      const real = (mod.default ?? mod) as WebPushModule;
      if (!webPushConfigured) {
        try {
          real.setVapidDetails(
            (process.env.VAPID_SUBJECT ?? 'mailto:info@anointedcoder.com').trim(),
            (process.env.VAPID_PUBLIC_KEY ?? '').trim(),
            (process.env.VAPID_PRIVATE_KEY ?? '').trim(),
          );
          webPushConfigured = true;
        } catch (err) {
          console.error('[push] setVapidDetails failed', err);
          return null;
        }
      }
      return real;
    } catch (err) {
      console.error('[push] web-push module not available', err);
      return null;
    }
  })();
  return webPushPromise;
}

export async function dispatchPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushDispatchResult> {
  if (!isVapidConfigured()) {
    return { attempted: 0, sent: 0, failed: 0, status: 'provider_setup_required', details: 'VAPID keys missing' };
  }
  if (userIds.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
  }

  const webPush = await loadWebPush();
  if (!webPush) {
    return { attempted: 0, sent: 0, failed: 0, status: 'provider_setup_required', details: 'web-push not installed' };
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? '',
    imageUrl: payload.imageUrl ?? null,
    iconUrl: payload.iconUrl ?? null,
    linkUrl: payload.linkUrl ?? null,
    notificationId: payload.notificationId ?? null,
    recipientId: payload.recipientId ?? null,
    soundUrl: payload.soundUrl ?? null,
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60, urgency: 'normal' },
        );
        sent += 1;
        await db.pushSubscription.update({
          where: { id: sub.id },
          data: { lastSeenAt: new Date(), failedAt: null, failureReason: null },
        });
      } catch (err) {
        const status = typeof err === 'object' && err && 'statusCode' in err ? Number((err as { statusCode: number }).statusCode) : 0;
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        if (status === 404 || status === 410) {
          await db.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false, failedAt: new Date(), failureReason: `expired_${status}` },
          });
        } else {
          await db.pushSubscription.update({
            where: { id: sub.id },
            data: { failedAt: new Date(), failureReason: message.slice(0, 200) },
          });
        }
      }
    }),
  );

  const totalAttempted = subscriptions.length;
  const status: PushDispatchResult['status'] =
    sent === totalAttempted ? 'sent' : sent === 0 ? 'failed' : 'partial';

  return { attempted: totalAttempted, sent, failed, status };
}
