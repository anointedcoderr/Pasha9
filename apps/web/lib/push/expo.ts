// Built by Anointed Coder.
//
// Player mobile-push channel. Sends Expo push notifications to every
// active PlayerPushDevice token belonging to the given player user ids.
// This is deliberately separate from the admin FCM channel
// (lib/push/fcm.ts) and the web VAPID channel (lib/push/dispatch.ts):
// it targets the player's native mobile app via Expo push tokens and
// needs no server credentials (Expo push to Expo tokens is open, with
// an optional EXPO_ACCESS_TOKEN for higher throughput).
//
// Best-effort by contract: every path is wrapped so this function can
// NEVER throw. A network failure returns a failed summary rather than
// an exception, so a transient outage can never fail the player-facing
// action that triggered the notification.

import { db } from '@/lib/db/client';

export interface ExpoPushPayload {
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  kind?: string | null;
  priority?: 'low' | 'normal' | 'high';
  notificationId?: string | null;
}

export interface ExpoDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  status: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

// Expo push tokens have one of these two prefixes. Anything else is a
// stray value we must not forward to the Expo service.
function looksLikeExpoToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string } | null;
}

export async function dispatchExpoPushToUsers(
  userIds: string[],
  payload: ExpoPushPayload,
): Promise<ExpoDispatchResult> {
  try {
    if (userIds.length === 0) {
      return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
    }

    const devices = await db.playerPushDevice.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { id: true, token: true },
    });

    const targets = devices.filter((d) => looksLikeExpoToken(d.token));
    if (targets.length === 0) {
      return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
    }

    const data = {
      linkUrl: payload.linkUrl ?? '',
      kind: payload.kind ?? '',
      notificationId: payload.notificationId ?? '',
    };
    const priority = payload.priority === 'high' ? 'high' : 'default';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    let sent = 0;
    let failed = 0;
    const now = new Date();

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      const messages = chunk.map((d) => ({
        to: d.token,
        title: payload.title,
        body: payload.body ?? undefined,
        sound: 'default',
        priority,
        channelId: 'default',
        data,
      }));

      let tickets: ExpoTicket[] = [];
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(messages),
        });
        const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
        tickets = Array.isArray(json?.data) ? json!.data : [];
      } catch {
        // Network / transport failure for the whole chunk: count every
        // token as failed and best-effort stamp the failure. Never throw.
        failed += chunk.length;
        await Promise.all(
          chunk.map((d) =>
            db.playerPushDevice
              .update({
                where: { id: d.id },
                data: { failedAt: now, failureReason: 'network_error' },
              })
              .catch(() => {}),
          ),
        );
        continue;
      }

      await Promise.all(
        chunk.map(async (device, j) => {
          const ticket = tickets[j];
          if (ticket && ticket.status === 'ok') {
            sent += 1;
            await db.playerPushDevice
              .update({
                where: { id: device.id },
                data: { lastSeenAt: now, failedAt: null, failureReason: null },
              })
              .catch(() => {});
            return;
          }

          failed += 1;
          const reason = (ticket?.details?.error ?? ticket?.message ?? 'unknown_error').slice(0, 200);
          if (ticket?.details?.error === 'DeviceNotRegistered') {
            await db.playerPushDevice
              .update({
                where: { id: device.id },
                data: { isActive: false, failedAt: now, failureReason: reason },
              })
              .catch(() => {});
          } else {
            await db.playerPushDevice
              .update({
                where: { id: device.id },
                data: { failedAt: now, failureReason: reason },
              })
              .catch(() => {});
          }
        }),
      );
    }

    const attempted = targets.length;
    let status: string;
    if (sent === attempted) status = 'sent';
    else if (sent === 0) status = 'failed';
    else status = 'partial';

    return { attempted, sent, failed, status };
  } catch (err) {
    console.error('[expo] dispatch failed', err);
    return { attempted: 0, sent: 0, failed: 0, status: 'failed' };
  }
}
