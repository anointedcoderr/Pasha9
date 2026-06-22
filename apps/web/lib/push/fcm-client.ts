// Built by Anointed Coder.
//
// Client-side FCM helpers for the admin "Enable phone alerts" control.
// Registers the dedicated firebase-messaging-sw.js (passing the public
// firebase config via the query string), requests Notification
// permission, fetches the FCM token, and posts it to
// /api/admin/push-devices. Mirrors the player lib/push/client.ts shape.

'use client';

import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { getFirebaseClientApp } from '@/lib/firebase/client';

export type AdminPushState = {
  supported: boolean;
  permission: NotificationPermission;
  enabled: boolean;
};

export type EnableAdminPushResult =
  | { ok: true }
  | { ok: false; code: 'unsupported' | 'no_config' | 'not_configured' | 'permission_denied' | 'token_failed' | 'post_failed'; message: string };

const SW_URL_BASE = '/firebase-messaging-sw.js';
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

function publicConfigQuery(): string | null {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(cfg).some((v) => !v)) return null;
  return new URLSearchParams(cfg as Record<string, string>).toString();
}

async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  const query = publicConfigQuery();
  if (!query) return null;
  const url = `${SW_URL_BASE}?${query}`;
  return navigator.serviceWorker.register(url, { scope: SW_SCOPE });
}

export async function getAdminPushState(): Promise<AdminPushState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'default', enabled: false };
  }
  const supported = await isSupported().catch(() => false);
  const permission = Notification.permission;
  let enabled = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    enabled = permission === 'granted' && Boolean(sub);
  } catch {
    enabled = false;
  }
  return { supported, permission, enabled };
}

export async function enableAdminPush(): Promise<EnableAdminPushResult> {
  if (typeof window === 'undefined') return { ok: false, code: 'unsupported', message: 'No window.' };
  if (!(await isSupported().catch(() => false))) {
    return { ok: false, code: 'unsupported', message: 'This browser does not support push. On iPhone, add the site to your Home Screen first.' };
  }

  // Confirm the operator finished server-side setup (creds + VAPID key).
  let vapidKey = '';
  try {
    const res = await fetch('/api/admin/push-config', { cache: 'no-store', credentials: 'include' });
    const j = await res.json();
    if (!j?.configured || !j?.vapidKey) {
      return { ok: false, code: 'not_configured', message: 'Phone alerts are not configured on the server yet.' };
    }
    vapidKey = j.vapidKey as string;
  } catch {
    return { ok: false, code: 'not_configured', message: 'Could not load push configuration.' };
  }

  const app = getFirebaseClientApp();
  if (!app) return { ok: false, code: 'no_config', message: 'Firebase web config is missing.' };

  const registration = await registerSw();
  if (!registration) return { ok: false, code: 'no_config', message: 'Firebase web config is missing.' };

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, code: 'permission_denied', message: 'Notification permission was not granted.' };
  }

  let token = '';
  try {
    const messaging = getMessaging(app);
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch (err) {
    return { ok: false, code: 'token_failed', message: err instanceof Error ? err.message : 'Could not obtain a device token.' };
  }
  if (!token) return { ok: false, code: 'token_failed', message: 'Empty device token.' };

  try {
    const res = await fetch('/api/admin/push-devices', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, userAgent: navigator.userAgent }),
    });
    if (!res.ok) return { ok: false, code: 'post_failed', message: 'Could not register the device with the server.' };
  } catch {
    return { ok: false, code: 'post_failed', message: 'Could not reach the server.' };
  }

  return { ok: true };
}

export async function disableAdminPush(): Promise<{ ok: boolean }> {
  try {
    const app = getFirebaseClientApp();
    if (app) {
      const messaging = getMessaging(app);
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      // Read the token before deleting so we can deactivate the server row.
      let token = '';
      try {
        const vapidKey = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();
        if (reg && vapidKey) token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
      } catch { /* ignore */ }
      if (token) {
        await fetch('/api/admin/push-devices', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        }).catch(() => {});
      }
      await deleteToken(messaging).catch(() => {});
    }
  } catch { /* swallow */ }
  return { ok: true };
}
