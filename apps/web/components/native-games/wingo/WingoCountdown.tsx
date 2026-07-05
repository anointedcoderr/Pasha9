// Built by Anointed Coder.
//
// Digital countdown for the WinGo round card, plus the last-10-seconds
// full-screen takeover that visibly locks betting. The takeover is a
// fixed overlay with four flip-style digit cells; when the phase is
// `locked` it shows a bold "Betting closed" banner so the player can
// see the lock without reading the number. Transform/opacity only,
// reduced-motion safe (the pulse simply stops).

'use client';

import { useLang } from '@/lib/i18n/context';
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

// Inline digital timer used inside the round card header.
export function WingoTimer({ ms, locked }: { ms: number; locked: boolean }) {
  const [d0, d1, d2, d3] = digits(ms);
  return (
    <div className="flex items-center gap-1" role="timer" aria-live="off">
      <Cell ch={d0} locked={locked} />
      <Cell ch={d1} locked={locked} />
      <span className="px-0.5 text-lg font-black text-amber-300">:</span>
      <Cell ch={d2} locked={locked} />
      <Cell ch={d3} locked={locked} />
    </div>
  );
}

function Cell({ ch, locked }: { ch: string; locked: boolean }) {
  return (
    <span
      className={
        'inline-flex h-8 w-6 items-center justify-center rounded-md border text-lg font-black tabular-nums shadow-inner ' +
        (locked
          ? 'border-rose-400/50 bg-rose-950/70 text-rose-200'
          : 'border-amber-300/40 bg-black/60 text-amber-100')
      }
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
