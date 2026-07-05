// Built by Anointed Coder.
//
// Client polling hook for the Pasha WinGo play page. Owns one mode's
// live round state:
//
//   - fetches /api/games/wingo/state on a short interval so the round
//     card, results strip and next-round window stay fresh,
//   - measures the clock skew between the server and this device once
//     per fetch and ticks a local `nowMs` every 250ms so the countdown
//     is smooth without a request per second,
//   - derives the betting phase (open / locked / drawing) purely from
//     the wall clock, and NEVER treats the client as the source of
//     truth: the server re-checks bet close on every placement.
//
// The hook is intentionally read-only. Bet placement and My-history
// live in the page so this stays a thin, reusable data source.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WingoMode } from '@/lib/wingo/config';

export interface WingoResult {
  periodNumber: string;
  result: number;
  color: string;
  size: string;
  drawnAt: string | null;
}

export interface WingoRound {
  roundId: string;
  periodNumber: string;
  phase: 'open' | 'closed';
  secondsRemaining: number;
  startsAt: string;
  betCloseAt: string;
  drawsAt: string;
  serverSeedHash: string;
}

export interface WingoStatePayload {
  ok: boolean;
  enabled: boolean;
  modeEnabled: boolean;
  mode: WingoMode;
  minStake: number;
  maxStake: number;
  serverTime: string;
  round: WingoRound | null;
  next: { periodNumber: string; startsAt: string; betCloseAt: string; drawsAt: string } | null;
  results: WingoResult[];
}

// Derived, wall-clock phase. `drawing` is the brief gap after the local
// clock passes drawsAt but before the next poll returns the new round.
export type WingoPhase = 'open' | 'locked' | 'drawing' | 'idle';

export interface UseWingoState {
  data: WingoStatePayload | null;
  loading: boolean;
  loadError: string | null;
  nowMs: number; // server-aligned clock, ticks locally
  phase: WingoPhase;
  msToBetClose: number;
  msToDraw: number;
  refetch: () => void;
}

const POLL_MS = 2000;
const TICK_MS = 250;

export function useWingoState(mode: WingoMode, active: boolean): UseWingoState {
  const [data, setData] = useState<WingoStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Skew = serverTime - localTime at the moment of the last fetch. Added
  // to Date.now() so the local countdown matches the server.
  const skewRef = useRef(0);
  const aliveRef = useRef(true);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/wingo/state?mode=${encodeURIComponent(mode)}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as WingoStatePayload | null;
      if (!aliveRef.current) return;
      if (!res.ok || !json) {
        setLoadError('Could not reach the game server.');
        return;
      }
      const serverMs = Date.parse(json.serverTime);
      if (Number.isFinite(serverMs)) skewRef.current = serverMs - Date.now();
      setData(json);
      setLoadError(null);
    } catch {
      if (aliveRef.current) setLoadError('Could not reach the game server.');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [mode]);

  // Poll while this mode is active. Reset loading on mode switch so the
  // card shows a skeleton rather than the previous mode's round.
  useEffect(() => {
    aliveRef.current = true;
    if (!active) return;
    setLoading(true);
    fetchState();
    const id = window.setInterval(fetchState, POLL_MS);
    return () => {
      aliveRef.current = false;
      window.clearInterval(id);
    };
  }, [active, fetchState]);

  // Local smooth clock.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now() + skewRef.current), TICK_MS);
    setNowMs(Date.now() + skewRef.current);
    return () => window.clearInterval(id);
  }, [active]);

  // When the local clock crosses the draw, ask the server for the fresh
  // round immediately rather than waiting for the next poll tick, so the
  // reveal fires with minimal lag.
  const crossedRef = useRef<string | null>(null);
  useEffect(() => {
    const round = data?.round;
    if (!round) return;
    const drawMs = Date.parse(round.drawsAt);
    if (nowMs >= drawMs && crossedRef.current !== round.periodNumber) {
      crossedRef.current = round.periodNumber;
      fetchState();
    }
  }, [nowMs, data, fetchState]);

  // Derive phase + countdowns from the aligned clock.
  let phase: WingoPhase = 'idle';
  let msToBetClose = 0;
  let msToDraw = 0;
  const round = data?.round;
  if (round) {
    const betClose = Date.parse(round.betCloseAt);
    const draw = Date.parse(round.drawsAt);
    msToBetClose = Math.max(0, betClose - nowMs);
    msToDraw = Math.max(0, draw - nowMs);
    if (nowMs >= draw) phase = 'drawing';
    else if (nowMs >= betClose) phase = 'locked';
    else phase = 'open';
  }

  return { data, loading, loadError, nowMs, phase, msToBetClose, msToDraw, refetch: fetchState };
}
