// Built by Anointed Coder.
//
// One-time notification permission prompt that fires automatically
// after a successful login or signup. The browser only ever shows
// its native permission dialog when we explicitly call
// Notification.requestPermission(); we trigger that call once per
// device for each authenticated visitor, then mark a localStorage
// flag so subsequent visits and logins are silent. If the visitor
// changes their mind, the bell drawer still has the manual
// Enable / Disable button.
//
// The prompt only fires when:
//   - the user is authenticated (probed via /api/auth/me)
//   - the browser supports the Notification API
//   - permission is still 'default' (user has not chosen yet)
//   - the local flag has not been set
//   - VAPID is configured server-side (so a subscription can
//     actually succeed; prompting without VAPID would surface a
//     confusing error)
//
// We listen to the pasha9:wallet-refresh window event the AuthModal
// already fires on successful auth, so the prompt appears within
// ~500ms of login completing, matching the client product spec
// ("automatically appear only once and ask the user to allow
// notifications").

'use client';

import { useEffect, useRef } from 'react';
import { enableDevicePush, getNotificationPermission, checkPushSupport } from '@/lib/push/client';

const STORAGE_KEY = 'pasha9:notif_prompted';

function hasPromptedBefore(): boolean {
  if (typeof window === 'undefined') return true;
  try { return window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { return true; }
}

function markPrompted() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch { /* swallow */ }
}

async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data?.user);
  } catch { return false; }
}

async function isPushConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/content/push-config', { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data?.configured);
  } catch { return false; }
}

export function NotificationAutoPrompt() {
  const promptingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tryPrompt = async () => {
      if (promptingRef.current) return;
      if (hasPromptedBefore()) return;
      if (checkPushSupport() !== 'supported') return;
      if (getNotificationPermission() !== 'default') {
        // User already chose before. Persist the flag so we never
        // try again on this device.
        markPrompted();
        return;
      }
      const [authed, configured] = await Promise.all([isAuthenticated(), isPushConfigured()]);
      if (!authed) return;
      if (!configured) return;

      promptingRef.current = true;
      try {
        // enableDevicePush triggers Notification.requestPermission()
        // internally and, on grant, also subscribes the device with
        // the VAPID key. Errors are swallowed so a silent denial
        // does not surface UI noise on the homepage.
        await enableDevicePush();
      } catch { /* swallow */ }
      finally {
        markPrompted();
        promptingRef.current = false;
      }
    };

    // Probe once on mount (covers the case where the visitor is
    // already authenticated from a prior session).
    const id = window.setTimeout(() => { void tryPrompt(); }, 1200);

    // And probe again whenever the auth state likely changed. The
    // AuthModal dispatches this event on every login / signup
    // success and the Header listens for it to refresh the wallet
    // chip. We piggyback on the same signal.
    const handler = () => {
      // Reset the cached promptingRef so the new auth gets a
      // fresh probe. Do NOT clear the storage flag - a single
      // device only ever gets one prompt per browser profile.
      void tryPrompt();
    };
    window.addEventListener('pasha9:wallet-refresh', handler);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pasha9:wallet-refresh', handler);
    };
  }, []);

  return null;
}
