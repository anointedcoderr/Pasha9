// Built by Anointed Coder.
//
// Native push helpers for the Pasha9 WebView shell. Everything here is
// defensive: Expo Go, a simulator, denied permission, or a build without an
// EAS projectId must all no-op cleanly and never throw.
//
// Getting the device's Expo push token is a native-only API (expo-notifications),
// so it lives here. Actually REGISTERING that token with the backend happens
// from inside the WebView's page context instead (see app/index.tsx) - the
// page already carries the player's session cookie, so posting from there
// needs no native auth plumbing at all. This module never talks to the
// backend itself.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// A foreground push should surface as a banner with sound. SDK 54 splits the
// old shouldShowAlert flag into shouldShowBanner + shouldShowList.
//
// This runs at module-evaluation time, before App.tsx even mounts - if the
// native notifications module were ever unavailable in a given build
// variant, an unguarded call here would crash the entire app before any of
// this file's own try/catch blocks could run. Guarded for exactly that
// reason: worst case, foreground notifications fall back to the OS default
// presentation instead of taking the app down.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // See comment above: never let this take the app down.
}

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
