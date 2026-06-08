// Built by Anointed Coder.
//
// Client-side hook that loads the visiting admin/staff member's role
// and effective permissions from /api/auth/me. Cached in module scope
// so a single page render reuses the same data across the sidebar,
// the mobile drawer and the layout-level URL gate without parallel
// round-trips. Refresh fires when the wallet-refresh event runs
// (login/logout/role change pushes through that channel today).

'use client';

import { useEffect, useState } from 'react';

interface AdminAuth {
  loaded: boolean;
  role: string;
  permissions: string[];
}

const INITIAL: AdminAuth = { loaded: false, role: '', permissions: [] };

let cached: AdminAuth = INITIAL;
let inFlight: Promise<AdminAuth> | null = null;
const listeners = new Set<(next: AdminAuth) => void>();

async function fetchAuth(): Promise<AdminAuth> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
    if (!res.ok) {
      cached = { loaded: true, role: '', permissions: [] };
      return cached;
    }
    const data = await res.json();
    const role = String(data?.user?.role?.key ?? '');
    const permissions = Array.isArray(data?.permissions) ? (data.permissions as string[]) : [];
    cached = { loaded: true, role, permissions };
    return cached;
  } catch {
    cached = { loaded: true, role: '', permissions: [] };
    return cached;
  }
}

function notify() {
  for (const listener of listeners) listener(cached);
}

export function useAdminPermissions(): AdminAuth {
  const [state, setState] = useState<AdminAuth>(cached);

  useEffect(() => {
    listeners.add(setState);
    if (!cached.loaded) {
      if (!inFlight) {
        inFlight = fetchAuth().then((next) => {
          inFlight = null;
          notify();
          return next;
        });
      }
    }
    const onRefresh = () => {
      inFlight = fetchAuth().then((next) => {
        inFlight = null;
        notify();
        return next;
      });
    };
    window.addEventListener('pasha9:wallet-refresh', onRefresh);
    return () => {
      listeners.delete(setState);
      window.removeEventListener('pasha9:wallet-refresh', onRefresh);
    };
  }, []);

  return state;
}
