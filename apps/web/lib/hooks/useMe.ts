// Built by Anointed Coder.
//
// Tiny shared hook for any user-facing page that needs the live
// /api/auth/me identity + wallet snapshot. Listens for the same
// pasha9:wallet-refresh event the Header and WalletStrip use so it
// flips immediately on login / logout / balance change in the same
// tab.

'use client';

import { useCallback, useEffect, useState } from 'react';

export interface MeUser {
  id: string;
  username: string;
  phone: string;
  email?: string | null;
  referralCode: string;
  referredById?: string | null;
  status: 'active' | 'blocked' | 'pending';
  blockedReason?: string | null;
  blockedAt?: string | null;
  language: 'bn' | 'en';
  country: string;
  lastLoginAt?: string | null;
  phoneVerifiedAt?: string | null;
  role: { key: string; label: string };
  wallet?: {
    balance: number | string;
    bonusBalance?: number | string;
    lockedBalance?: number | string;
    lottoBalance?: number | string;
    currency?: string;
  };
}

export interface UseMeResult {
  me: MeUser | null;
  loading: boolean;
  refresh: () => void;
}

export function useMe(): UseMeResult {
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setMe((data?.user as MeUser | undefined) ?? null);
      })
      .catch(() => {
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    if (typeof window !== 'undefined') {
      window.addEventListener('pasha9:wallet-refresh', handler);
      return () => window.removeEventListener('pasha9:wallet-refresh', handler);
    }
    return undefined;
  }, [load]);

  return { me, loading, refresh: load };
}

/** Number-safe access to the main wallet balance. */
export function walletBalance(me: MeUser | null): number {
  return Number(me?.wallet?.balance ?? 0);
}
export function walletBonus(me: MeUser | null): number {
  return Number(me?.wallet?.bonusBalance ?? 0);
}
export function walletLocked(me: MeUser | null): number {
  return Number(me?.wallet?.lockedBalance ?? 0);
}
export function walletLotto(me: MeUser | null): number {
  return Number(me?.wallet?.lottoBalance ?? 0);
}

/** Emit the shared wallet-refresh event so the Header / WalletStrip / useMe hook all re-fetch. */
export function triggerWalletRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pasha9:wallet-refresh'));
  }
}
