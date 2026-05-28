// Built by Anointed Coder.
//
// Shared client hook for Pasha Native Games play pages. Wraps the
// repetitive boilerplate that every game page needs:
//
//   - fetch the game config (min/max/edge/active)
//   - fetch the live wallet balance via /api/auth/me
//   - open a provably-fair session on mount
//   - detect 401 auth errors so the page can show a login CTA
//   - expose helpers to bump the session nonce + refresh balance
//
// Each game page keeps its own bet / outcome state on top.

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameCode } from './config';

export interface NativeGameConfig {
  gameCode: string;
  displayName: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  config: Record<string, unknown> | null;
}

export interface NativeSessionView {
  id: string;
  gameCode: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  status: string;
  createdAt: string;
}

interface MeResponse {
  user?: { wallet?: { balance?: number | string } | null } | null;
}

export interface UseNativeGameResult {
  game: NativeGameConfig | null;
  enabled: boolean;
  session: NativeSessionView | null;
  balance: number | null;
  authError: boolean;
  loadError: string | null;
  refreshBalance: () => Promise<void>;
  bumpNonce: () => void;
  newSession: () => Promise<void>;
  closeSessionAndReveal: () => Promise<void>;
}

export function useNativeGame(gameCode: GameCode): UseNativeGameResult {
  const [game, setGame] = useState<NativeGameConfig | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [session, setSession] = useState<NativeSessionView | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) return;
      const data = (await res.json()) as MeResponse;
      const v = data?.user?.wallet?.balance;
      if (v != null) setBalance(Number(v));
    } catch { /* keep stale balance */ }
  }, []);

  const openSession = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/native-games/${gameCode}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) {
        setLoadError(data?.message ?? data?.code ?? 'Could not open session');
        return;
      }
      setSession(data?.session ?? null);
    } catch {
      setLoadError('Could not open session');
    }
  }, [gameCode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/native-games/${gameCode}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (alive && data?.game) {
          setGame(data.game as NativeGameConfig);
          setEnabled(Boolean(data.enabled));
        }
      } catch { /* leave defaults */ }
    })();
    refreshBalance();
    return () => { alive = false; };
  }, [gameCode, refreshBalance]);

  useEffect(() => {
    if (!enabled || !game || !game.isActive || authError) return;
    if (session) return;
    openSession();
  }, [enabled, game, session, openSession, authError]);

  const bumpNonce = useCallback(() => {
    setSession((prev) => (prev ? { ...prev, nonce: prev.nonce + 1 } : prev));
  }, []);

  const newSession = useCallback(async () => {
    setSession(null);
    await openSession();
  }, [openSession]);

  const closeSessionAndReveal = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const res = await fetch(`/api/native-games/sessions/${session.id}/verify`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setLoadError(data?.message ?? data?.code ?? 'Could not close session');
        return;
      }
      window.location.href = `/api/native-games/sessions/${session.id}/verify`;
    } catch {
      setLoadError('Could not reach server');
    }
  }, [session]);

  return {
    game,
    enabled,
    session,
    balance,
    authError,
    loadError,
    refreshBalance,
    bumpNonce,
    newSession,
    closeSessionAndReveal,
  };
}
