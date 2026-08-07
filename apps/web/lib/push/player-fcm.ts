// Built by Anointed Coder.
//
// Player mobile push over FCM, sent as a NOTIFICATION message.
//
// This exists because of a real delivery failure, not as an alternative
// for its own sake. Expo push delivers Android a DATA message: it carries
// no visible content, so the app process must wake up and construct the
// notification itself. Samsung, Xiaomi, Oppo and Vivo all freeze
// background apps aggressively, and a frozen app never wakes, so the
// message reaches the handset and is silently dropped. Testing reproduced
// exactly that: notifications appeared while the app was open, and nothing
// at all once it was closed, until battery optimisation was disabled by
// hand. That is not something thousands of players can be asked to do.
//
// A notification message is rendered by Android's own system tray with no
// app code running, so it survives those battery policies.
//
// Deliberately separate from lib/push/fcm.ts (admin devices, data-only by
// design so the service worker controls presentation) and from
// lib/push/dispatch.ts (browser web push). Same Firebase credentials,
// different audience and different message shape.
//
// Best-effort by contract: every path is wrapped so this can NEVER throw.
// A push failure must not fail the deposit or withdrawal that raised it.

import { db } from '@/lib/db/client';
import { isPlayerFcmConfigured, getPlayerFcmMessaging } from '@/lib/firebase/admin';
import {
  type FcmDispatchResult,
  classifyFcmSendError,
  summarizeFcmResult,
} from '@/lib/push/fcm-status';

export interface PlayerFcmPayload {
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  kind?: string | null;
  priority?: 'low' | 'normal' | 'high';
  notificationId?: string | null;
}

// FCM caps a multicast send at 500 tokens per call.
const CHUNK_SIZE = 500;

/**
 * Send to every active player device that has reported a native FCM token.
 *
 * Devices WITHOUT an fcmToken are intentionally skipped here and picked up
 * by the Expo dispatcher instead, so a device is never sent to twice and
 * players on older app builds keep working during the rollout.
 */
export async function dispatchPlayerFcmToUsers(
  userIds: string[],
  payload: PlayerFcmPayload,
): Promise<FcmDispatchResult> {
  try {
    if (userIds.length === 0) {
      return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
    }
    // Must be the MOBILE APP's Firebase project, not the auth/admin one.
    // FCM refuses cross-project sends with messaging/mismatched-credential.
    if (!isPlayerFcmConfigured()) {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        status: 'provider_setup_required',
        details: 'firebase_player_not_configured',
      };
    }

    const devices = await db.playerPushDevice.findMany({
      where: { userId: { in: userIds }, isActive: true, fcmToken: { not: null } },
      select: { id: true, fcmToken: true },
    });

    const targets = devices.filter((d): d is { id: string; fcmToken: string } => !!d.fcmToken);
    if (targets.length === 0) {
      return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
    }

    const messaging = getPlayerFcmMessaging();
    const now = new Date();

    // data rides alongside the notification block so a tap can still be
    // routed to the right page. All FCM data values must be strings.
    const data: Record<string, string> = {
      linkUrl: payload.linkUrl ?? '',
      kind: payload.kind ?? '',
      notificationId: payload.notificationId ?? '',
    };

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);

      let responses: { success: boolean; error?: { code?: string } }[] = [];
      try {
        const res = await messaging.sendEachForMulticast({
          tokens: chunk.map((d) => d.fcmToken),
          // The notification block is the whole point: Android draws this
          // itself, so a frozen or never-opened app still shows it.
          notification: {
            title: payload.title,
            body: payload.body ?? undefined,
          },
          data,
          android: {
            priority: 'high',
            notification: {
              // Must match the channel the app creates (lib/push/register.ts).
              channelId: 'default',
              sound: 'default',
              defaultSound: true,
              defaultVibrateTimings: true,
            },
          },
        });
        responses = res.responses as typeof responses;
      } catch (err) {
        // Whole-chunk transport failure. Count every token as failed and
        // stamp the reason, but never throw.
        failed += chunk.length;
        const reason = err instanceof Error ? err.message.slice(0, 200) : 'fcm_send_failed';
        await Promise.all(
          chunk.map((d) =>
            db.playerPushDevice
              .update({ where: { id: d.id }, data: { failedAt: now, failureReason: reason } })
              .catch(() => {}),
          ),
        );
        continue;
      }

      await Promise.all(
        chunk.map(async (device, j) => {
          const r = responses[j];
          if (r?.success) {
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
          const code = r?.error?.code;
          const reason = (code ?? 'fcm_unknown_error').slice(0, 200);
          // A permanently dead token is cleared rather than deactivating the
          // row: the device may still be reachable over Expo, and the app
          // will report a fresh FCM token next time it runs.
          if (classifyFcmSendError(code) === 'expired') {
            await db.playerPushDevice
              .update({
                where: { id: device.id },
                data: { fcmToken: null, failedAt: now, failureReason: reason },
              })
              .catch(() => {});
          } else {
            await db.playerPushDevice
              .update({ where: { id: device.id }, data: { failedAt: now, failureReason: reason } })
              .catch(() => {});
          }
        }),
      );
    }

    const attempted = targets.length;
    return { attempted, sent, failed, status: summarizeFcmResult(attempted, sent, failed) };
  } catch (err) {
    console.error('[player-fcm] dispatch failed', err);
    return { attempted: 0, sent: 0, failed: 0, status: 'failed', details: 'dispatch_threw' };
  }
}
