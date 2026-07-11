// Built by Anointed Coder.
//
// Native push registration for the Pasha9 player app. Everything here is
// defensive: Expo Go, a simulator, denied permission, or a build without an
// EAS projectId must all no-op cleanly and never throw. The public helpers:
//   - registerDeviceToken(): fetch the Expo push token, POST it to the backend,
//     and persist it locally. Returns the token or null.
//   - unregisterDeviceToken(): best-effort DELETE of the stored token and wipe
//     the local copy. Must run while the session is still authed.
//   - mapNotificationLinkToRoute(): translate a backend WEB linkUrl into an app
//     route so a notification tap lands on the right screen.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { api } from '@/lib/api/client';
import { STORAGE_KEYS } from '@/lib/config';

// A foreground push should surface as a banner with sound. SDK 54 splits the
// old shouldShowAlert flag into shouldShowBanner + shouldShowList.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ensure the Android "default" channel exists. Required for heads-up
 * notifications on Android 8+. A no-op on other platforms. Never throws.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5B301',
    });
  } catch {
    // Ignore: a missing channel only affects heads-up styling, not delivery.
  }
}

/**
 * Resolve the EAS projectId from the two places Expo may expose it. Returns
 * undefined when the app has not been linked to an EAS project yet.
 */
function resolveProjectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEasConfig = (Constants as unknown as { easConfig?: { projectId?: string } })
    ?.easConfig?.projectId;
  return fromExtra ?? fromEasConfig ?? undefined;
}

/**
 * Fetch the Expo push token for this device, requesting permission if needed.
 * Returns null on a simulator, in Expo Go without a projectId, when permission
 * is denied, or on any error, so callers never have to guard.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return null;

    const projectId = resolveProjectId();
    if (!projectId) {
      console.info('[push] skipped: no EAS projectId (run eas init to enable push).');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Register this device with the backend: get a token, POST it, and persist it
 * locally so we can deactivate it on sign-out. Returns the token or null.
 */
export async function registerDeviceToken(): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  try {
    await api.post('/api/me/device-tokens', {
      token,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? null,
    });
    await SecureStore.setItemAsync(STORAGE_KEYS.pushToken, token);
    return token;
  } catch {
    return null;
  }
}

/**
 * Best-effort deactivation of the stored push token. MUST be called while the
 * session is still authed so the DELETE carries a valid bearer. Swallows all
 * errors and always clears the local copy when one exists.
 */
export async function unregisterDeviceToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.pushToken);
    if (!token) return;
    try {
      await api.delete('/api/me/device-tokens', { body: { token } });
    } catch {
      // Ignore: the server also deactivates dead tokens on a failed Expo send.
    }
    await SecureStore.deleteItemAsync(STORAGE_KEYS.pushToken);
  } catch {
    // Ignore: nothing to clean up or secure-store is unavailable.
  }
}

/**
 * Map a backend WEB linkUrl to an in-app route. Query strings are stripped
 * before matching. Unknown or empty links fall back to the notifications list.
 */
export function mapNotificationLinkToRoute(linkUrl?: string | null): string {
  if (!linkUrl) return '/notifications';
  const path = linkUrl.split('?')[0].replace(/\/+$/, '');

  if (path === '/dashboard/wallet') return '/wallet';
  if (path === '/support') return '/legal/support';
  if (path === '/rewards') return '/rewards';
  if (path === '/promotions') return '/promotions';
  if (path === '/referral') return '/referral';
  if (path === '/betting-pass') return '/betting-pass';
  if (path === '/vip') return '/vip';

  return '/notifications';
}
