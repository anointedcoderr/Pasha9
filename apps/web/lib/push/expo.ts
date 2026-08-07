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

/**
 * POST one batch to the Expo push service.
 *
 * Returns the tickets when Expo accepts the request, or apiError when it
 * rejects the request as a whole. That distinction matters: a rejected
 * request returns NO tickets, so without capturing the reason here every
 * token in the batch ends up recorded as a meaningless 'unknown_error'
 * with the real cause discarded - which is exactly what hid a whole-batch
 * rejection during testing. The error body is logged, not swallowed.
 */
async function postToExpo(
  messages: unknown[],
  headers: Record<string, string>,
): Promise<{ tickets: ExpoTicket[]; apiError: string | null }> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  const raw = await res.text().catch(() => '');
  let json: { data?: ExpoTicket[]; errors?: { code?: string; message?: string }[] } | null = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  if (Array.isArray(json?.data)) {
    return { tickets: json!.data, apiError: null };
  }

  const apiError =
    json?.errors?.[0]?.code ??
    json?.errors?.[0]?.message ??
    `http_${res.status}`;
  console.error(`[expo] push request rejected: status=${res.status} body=${raw.slice(0, 400)}`);
  return { tickets: [], apiError };
}

export async function dispatchExpoPushToUsers(
  userIds: string[],
  payload: ExpoPushPayload,
): Promise<ExpoDispatchResult> {
  try {
    if (userIds.length === 0) {
      return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
    }

    // Only devices WITHOUT a native FCM token. Anything with one is sent by
    // lib/push/player-fcm.ts instead, which uses a notification message that
    // Android renders without waking the app - the Expo route sends a data
    // message, which OEM battery managers silently drop for frozen apps.
    // Partitioning here (rather than sending both) is what stops a device
    // receiving the same notification twice.
    const devices = await db.playerPushDevice.findMany({
      where: { userId: { in: userIds }, isActive: true, fcmToken: null },
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
        const batch = await postToExpo(messages, headers);
        tickets = batch.tickets;

        // Request-level rejection: Expo refused the whole batch and returned
        // no tickets, so every token in it looks like a nameless failure.
        // The usual cause is a batch mixing tokens issued by DIFFERENT Expo
        // projects (PUSH_TOO_MANY_EXPERIENCE_IDS) - one stale token left over
        // from an older build is enough to block the notification for every
        // other player in the same batch. Retry one message at a time so the
        // valid tokens still get through and each bad token records its own
        // real reason instead of a shared 'unknown_error'.
        if (batch.apiError && messages.length > 1) {
          console.error(
            `[expo] batch rejected (${batch.apiError}); retrying ${messages.length} tokens individually`,
          );
          const singles = await Promise.all(
            messages.map((m) => postToExpo([m], headers)),
          );
          tickets = singles.map(
            (s) =>
              s.tickets[0] ?? {
                status: 'error',
                message: s.apiError ?? 'no_ticket_returned',
                details: null,
              },
          );
        } else if (batch.apiError) {
          tickets = [
            { status: 'error', message: batch.apiError, details: null },
          ];
        }
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
