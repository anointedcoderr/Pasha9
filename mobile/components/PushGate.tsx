// Built by Anointed Coder.
//
// PushGate: a headless provider that ties native push into the session. It
// renders nothing. While a player is authed it registers the device token
// once per session and listens for notification taps, routing each tap to the
// screen its linkUrl points at. Everything is guarded so a platform without
// notifications (Expo Go, simulator, denied permission) never throws.

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { registerDeviceToken, mapNotificationLinkToRoute } from '@/lib/push/register';

export function PushGate(): null {
  const { status, user } = useAuth();
  const router = useRouter();
  // Guards a single registration per authed session, keyed by user id.
  const registeredFor = useRef<string | null>(null);

  // Register once when the session becomes authed.
  useEffect(() => {
    if (status !== 'authed') {
      // A sign-out resets the guard so the next login registers again.
      registeredFor.current = null;
      return;
    }
    const key = user?.id ?? 'authed';
    if (registeredFor.current === key) return;
    registeredFor.current = key;
    void registerDeviceToken();
  }, [status, user?.id]);

  // Notification listeners live for the whole authed lifetime of the app.
  useEffect(() => {
    let responseSub: Notifications.Subscription | undefined;
    let receivedSub: Notifications.Subscription | undefined;
    try {
      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = response.notification.request.content.data as
            | { linkUrl?: string | null }
            | undefined;
          router.push(mapNotificationLinkToRoute(data?.linkUrl));
        } catch {
          // Ignore: a malformed payload should never crash the app.
        }
      });
      receivedSub = Notifications.addNotificationReceivedListener(() => {
        // Foreground receipt is handled by the notification handler; no-op here.
      });
    } catch {
      // Ignore: notifications module unavailable on this platform.
    }
    return () => {
      try {
        responseSub?.remove();
        receivedSub?.remove();
      } catch {
        // Ignore: nothing to tear down.
      }
    };
  }, [router]);

  return null;
}
