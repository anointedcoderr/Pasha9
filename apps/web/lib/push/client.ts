// Built by Anointed Coder.
//
// Client-side helpers for Web Push subscription. Keeps the browser
// API gymnastics off the React components. Use enableDevicePush()
// when the visitor taps the Enable button in the notification drawer
// or settings; the helper checks support, registers the service
// worker, prompts for permission, subscribes through PushManager and
// posts the subscription to /api/me/push-subscriptions.

'use client';

export type PushSupport =
  | 'supported'
  | 'no_window'
  | 'no_service_worker'
  | 'no_push_manager'
  | 'no_notification';

export type EnableResult =
  | { ok: true; status: 'subscribed'; endpoint: string }
  | { ok: true; status: 'already_subscribed'; endpoint: string }
  | { ok: false; code: 'unsupported' | 'permission_denied' | 'no_public_key' | 'subscribe_failed' | 'registration_failed' | 'post_failed'; message: string };

export function checkPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'no_window';
  if (!('serviceWorker' in navigator)) return 'no_service_worker';
  if (!('PushManager' in window)) return 'no_push_manager';
  if (!('Notification' in window)) return 'no_notification';
  return 'supported';
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) buffer[i] = raw.charCodeAt(i);
  return buffer;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function enableDevicePush(): Promise<EnableResult> {
  const support = checkPushSupport();
  if (support !== 'supported') {
    return { ok: false, code: 'unsupported', message: `Push is not available: ${support}` };
  }

  let configRes: Response;
  try {
    configRes = await fetch('/api/content/push-config', { cache: 'no-store' });
  } catch (err) {
    return { ok: false, code: 'no_public_key', message: 'Could not load push config.' };
  }
  const config = await configRes.json().catch(() => null);
  if (!config?.configured || !config?.publicKey) {
    const missing = Array.isArray(config?.missing) ? (config!.missing as string[]) : [];
    const suffix = missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : '';
    return {
      ok: false,
      code: 'no_public_key',
      message: `Browser push is not configured by the operator.${suffix}`,
    };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await registerServiceWorker();
  } catch (err) {
    return { ok: false, code: 'registration_failed', message: err instanceof Error ? err.message : 'Service worker registration failed.' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, code: 'permission_denied', message: 'Notification permission was not granted.' };
  }

  let subscription: PushSubscription;
  const existing = await registration.pushManager.getSubscription();
  const alreadySubscribed = Boolean(existing);
  if (existing) {
    subscription = existing;
  } else {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey).buffer as ArrayBuffer,
      });
    } catch (err) {
      return { ok: false, code: 'subscribe_failed', message: err instanceof Error ? err.message : 'PushManager.subscribe failed.' };
    }
  }

  const sub = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, code: 'subscribe_failed', message: 'Subscription is missing keys.' };
  }

  const postRes = await fetch('/api/me/push-subscriptions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: sub.keys,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }),
  });
  if (!postRes.ok) {
    return { ok: false, code: 'post_failed', message: 'Could not register the subscription with the server.' };
  }

  return { ok: true, status: alreadySubscribed ? 'already_subscribed' : 'subscribed', endpoint: sub.endpoint };
}

export async function disableDevicePush(): Promise<{ ok: boolean }> {
  if (checkPushSupport() !== 'supported') return { ok: false };
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return { ok: true };
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: true };
  try {
    await fetch('/api/me/push-subscriptions', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch { /* swallow */ }
  try { await subscription.unsubscribe(); } catch { /* swallow */ }
  return { ok: true };
}
