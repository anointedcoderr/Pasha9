// Built by Anointed Coder.
//
// Digital countdown for the WinGo round card, plus the last-10-seconds
// full-screen takeover that visibly locks betting. The takeover is a
// fixed overlay with four flip-style digit cells; when the phase is
// `locked` it shows a bold "Betting closed" banner so the player can
// see the lock without reading the number. Transform/opacity only,
// reduced-motion safe (the pulse simply stops).

'use client';

import { useEffect, useRef } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useSoundContext } from '@/lib/sounds/client';
import { getToneContext, playTone } from '@/lib/sounds/tone';
import type { WingoPhase } from './useWingoState';
import { WingoBall } from './WingoBall';

function two(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

// Split a millisecond remainder into mm:ss digit characters.
function digits(ms: number): [string, string, string, string] {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  const m = two(mm);
  const s = two(ss);
  return [m[0], m[1], s[0], s[1]];
}

// Inline digital timer used inside the round card header. In the open
// phase's final ten seconds it reads as urgent (rose tint + a soft haloed
// pulse) without ever claiming to be locked, so it never contradicts the
// board, which still accepts bets until the server closes the round.
export function WingoTimer({ ms, locked }: { ms: number; locked: boolean }) {
  const [d0, d1, d2, d3] = digits(ms);
  const urgent = !locked && ms <= 10_000;

  // Final-seconds countdown beep. This is the one cue that should be
  // audible out of the box, so it deliberately does NOT ride the shared
  // canPlay gate (that stays muted until a gesture and needs the admin
  // sound-map enabled). The tone pipeline in lib/sounds/tone.ts is
  // independent of the HTMLAudio sound map, so it plays without
  // map.enabled. We gate only on reduced-motion and an explicit user
  // mute (default ON): the header SoundToggle writes
  // pasha9:sounds_muted = "1" when the player turns sound off, which is
  // the exact key we read here. The AudioContext is still primed on the
  // first user gesture below so autoplay policy is satisfied.
  const soundCtx = useSoundContext();
  const reduced = soundCtx?.reduced === true;
  const explicitlyMuted =
    typeof window !== 'undefined' &&
    window.localStorage.getItem('pasha9:sounds_muted') === '1';
  // Also respect an explicit admin master mute (site sounds turned off);
  // it defaults on, so the beep still plays by default.
  const adminOff = soundCtx?.map?.enabled === false;
  const canBeep = !reduced && !explicitlyMuted && !adminOff;
  const defaultVolume = soundCtx?.map?.defaultVolume ?? 0.7;
  const lastBeepSecRef = useRef<number | null>(null);
  const prevLockedRef = useRef<boolean>(locked);

  // Prime (create + resume) the tone AudioContext on the first user
  // gesture so the later timer-driven beep is allowed to play.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prime = () => { getToneContext(); };
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  useEffect(() => {
    const wasLocked = prevLockedRef.current;
    prevLockedRef.current = locked;
    if (!canBeep) { lastBeepSecRef.current = null; return; }
    // Distinct higher final tone the moment betting locks.
    if (!wasLocked && locked) {
      playTone({ freq: 1320, durationMs: 240, volume: 0.32 * defaultVolume, type: 'triangle' });
      lastBeepSecRef.current = null;
      return;
    }
    if (!locked) {
      const secs = Math.ceil(ms / 1000);
      if (secs >= 1 && secs <= 5) {
        // One beep per whole second; do not double-fire within a second.
        if (lastBeepSecRef.current !== secs) {
          lastBeepSecRef.current = secs;
          playTone({ freq: 880, durationMs: 90, volume: 0.24 * defaultVolume });
        }
      } else {
        lastBeepSecRef.current = null;
      }
    }
  }, [ms, locked, canBeep, defaultVolume]);

  return (
    <div
      className={'flex items-center gap-1 ' + (urgent ? 'wingo-urgent' : '')}
      role="timer"
      aria-live="off"
    >
      <Cell ch={d0} locked={locked} urgent={urgent} />
      <Cell ch={d1} locked={locked} urgent={urgent} />
      <span
        className={
          'wingo-timer-pulse px-0.5 text-lg font-black ' + (locked || urgent ? 'text-rose-300' : 'text-amber-300')
        }
      >
        :
      </span>
      <Cell ch={d2} locked={locked} urgent={urgent} />
      <Cell ch={d3} locked={locked} urgent={urgent} />
    </div>
  );
}

function Cell({ ch, locked, urgent = false }: { ch: string; locked: boolean; urgent?: boolean }) {
  const tone = locked || urgent
    ? 'border-rose-400/60 bg-gradient-to-b from-rose-900/80 to-rose-950/90 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-4px_8px_-2px_rgba(0,0,0,0.6)]'
    : 'border-amber-300/40 bg-gradient-to-b from-[#241405] to-black text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-4px_8px_-2px_rgba(0,0,0,0.6)]';
  return (
    <span
      className={'inline-flex h-8 w-6 items-center justify-center rounded-md border text-lg font-black tabular-nums ' + tone}
    >
      {ch}
    </span>
  );
}

// Full-screen takeover for the locked phase. The game renders it ONLY once
// betting is actually closed on the server (phase locked or drawing, i.e.
// now >= betCloseAt), so it never blankets a board that still accepts bets.
// It always reads as LOCKED and simply swaps its label to "Drawing" once
// the draw instant passes. Transform/opacity only, reduced-motion safe.
export function WingoTakeover({
  msToDraw,
  phase,
  periodNumber,
}: {
  msToDraw: number;
  phase: WingoPhase;
  periodNumber: string;
}) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [d0, d1, d2, d3] = digits(msToDraw);
  const drawing = phase === 'drawing';

  return (
    <div
      className="wingo-takeover fixed inset-0 z-[80] grid place-items-center bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={bn ? 'বাজি বন্ধ, ড্র চলছে' : 'Betting closed, draw in progress'}
    >
      {/* Ambient drifting balls, purely decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="wingo-drift absolute left-[8%] top-[18%] opacity-40"><WingoBall n={3} size={40} asBadge /></div>
        <div className="wingo-drift-slow absolute right-[10%] top-[30%] opacity-40"><WingoBall n={8} size={52} asBadge /></div>
        <div className="wingo-drift absolute left-[20%] bottom-[16%] opacity-30"><WingoBall n={5} size={46} asBadge /></div>
        <div className="wingo-drift-slow absolute right-[22%] bottom-[22%] opacity-30"><WingoBall n={0} size={38} asBadge /></div>
      </div>

      <div className="relative flex flex-col items-center px-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-amber-300/90">
          {bn ? 'পিরিয়ড' : 'Period'} {periodNumber}
        </p>

        <div className="mt-4 flex items-center gap-1.5">
          <BigCell ch={d0} />
          <BigCell ch={d1} />
          <span className="px-1 text-4xl font-black text-amber-300 sm:text-5xl">:</span>
          <BigCell ch={d2} />
          <BigCell ch={d3} />
        </div>

        <div className="wingo-lock-in mt-6 inline-flex items-center gap-2 rounded-full border border-rose-400/60 bg-rose-950/70 px-5 py-2.5">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400 motion-keep" />
          <span className="text-sm font-extrabold uppercase tracking-[0.22em] text-rose-100">
            {drawing ? (bn ? 'ড্র চলছে' : 'Drawing') : bn ? 'বাজি বন্ধ' : 'Betting closed'}
          </span>
        </div>

        <p className="mt-3 max-w-xs text-xs text-white/55">
          {bn
            ? 'এই রাউন্ডের বাজি লক হয়ে গেছে। ফলাফলের অপেক্ষা করুন।'
            : 'Bets for this round are locked. Waiting for the result.'}
        </p>
      </div>
    </div>
  );
}

function BigCell({ ch }: { ch: string }) {
  return (
    <span className="wingo-flip inline-flex h-16 w-12 items-center justify-center rounded-xl border border-amber-300/40 bg-gradient-to-b from-[#241405] to-black text-4xl font-black tabular-nums text-amber-100 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),0_10px_30px_-8px_rgba(0,0,0,0.7)] sm:h-20 sm:w-16 sm:text-5xl">
      {ch}
    </span>
  );
}
