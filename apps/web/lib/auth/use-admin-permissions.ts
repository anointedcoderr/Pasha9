// Built by Anointed Coder.
//
// Client-side hook that loads the visiting admin/staff member's role
// and effective permissions from /api/auth/me. Cached in module scope
// so a single page render reuses the same data across the sidebar,
// the mobile drawer and the layout-level URL gate without parallel
// round-trips. Refresh fires when the wallet-refresh event runs
// (login/logout/role change pushes through that channel today).
//
// Failure semantics matter here: a TRANSIENT failure (server restart
// mid-deploy, network blip) must not be cached as "no permissions" for
// the rest of the session, or the operator sees a nearly empty menu
// until a hard reload. Transient failures retry with backoff; only a
// definitive 401/403 (genuinely signed out or not staff) is final.

'use client';

import { useEffect, useState } from 'react';

interface AdminAuth {
  loaded: boolean;
  role: string;
  permissions: string[];
}

const INITIAL: AdminAuth = { loaded: false, role: '', permissions: [] };
const RETRY_DELAYS_MS = [1000, 3000, 8000];

let cached: AdminAuth = INITIAL;
let inFlight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
const listeners = new Set<(next: AdminAuth) => void>();

function notify() {
  for (const listener of listeners) listener(cached);
}

async function fetchAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
    if (res.status === 401 || res.status === 403) {
      // Definitive: not signed in / not staff. Empty permissions are
      // the truth, not an error.
      cached = { loaded: true, role: '', permissions: [] };
      attempt = 0;
      return;
    }
    if (!res.ok) throw new Error(`auth/me HTTP ${res.status}`);
    const data = await res.json();
    const role = String(data?.user?.role?.key ?? '');
    const permissions = Array.isArray(data?.permissions) ? (data.permissions as string[]) : [];
    cached = { loaded: true, role, permissions };
    attempt = 0;
  } catch {
    // Transient (restart, proxy hiccup, offline). Keep loaded=false so
    // consumers know the answer is still pending, and retry with
    // backoff instead of caching an empty permission set.
    if (attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt];
      attempt += 1;
      if (!retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          kick();
        }, delay);
      }
    } else {
      // Give up after the backoff ladder; a hard reload or the
      // wallet-refresh event starts a fresh cycle.
      cached = { loaded: true, role: '', permissions: [] };
      attempt = 0;
    }
  }
}

function kick() {
  if (inFlight) return;
  inFlight = fetchAuth().then(() => {
    inFlight = null;
    notify();
  });
}

export function useAdminPermissions(): AdminAuth {
  const [state, setState] = useState<AdminAuth>(cached);

  useEffect(() => {
    listeners.add(setState);
    // Sync in case the module cache advanced between render and effect.
    setState(cached);
    if (!cached.loaded) {
      if (!retryTimer) kick();
    } else if (cached.role === '') {
      // We are holding a definitive "no access" answer (loaded, empty
      // role). That state is legitimately produced when /api/auth/me
      // is called on the login page BEFORE the admin has signed in
      // (a pre-auth 401 caches an empty role). After a successful
      // login the app redirects with a CLIENT-SIDE navigation, so this
      // module-scoped cache survives and a real super-admin would stay
      // locked out of every permission-gated module until a hard
      // reload. Drop back to a pending state and re-verify on mount so
      // the true role loads without a false "Access Denied" flash.
      cached = INITIAL;
      setState(cached);
      if (!retryTimer && !inFlight) kick();
    }
    const onRefresh = () => {
      // Explicit refresh (login/logout/role change): reset the backoff
      // ladder and refetch even if a cached answer exists.
      attempt = 0;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (!inFlight) {
        inFlight = fetchAuth().then(() => {
          inFlight = null;
          notify();
        });
      }
    };
    window.addEventListener('pasha9:wallet-refresh', onRefresh);
    return () => {
      listeners.delete(setState);
      window.removeEventListener('pasha9:wallet-refresh', onRefresh);
    };
  }, []);

  return state;
}
