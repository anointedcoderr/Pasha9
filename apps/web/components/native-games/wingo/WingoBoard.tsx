// Built by Anointed Coder.
//
// The WinGo betting board: the Green / Violet / Red colour buttons, the
// glossy 0..9 balls, a Random pick plus X1..X100 multiplier chips, and
// the Big / Small bar. Tapping any selection opens the bet sheet with
// the chosen quantity pre-filled. When the round is locked every control
// is disabled so the board visibly reflects the server's bet close.

'use client';

import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLang } from '@/lib/i18n/context';
import { getToneContext } from '@/lib/sounds/tone';
import { COLOR_BUTTON, QUANTITY_CHIPS, pillShadow, type WingoColorSel } from './ui';
import { WingoBall } from './WingoBall';
import type { WingoSelection } from './WingoBetSheet';

interface Props {
  locked: boolean;
  disabled: boolean; // no session / not signed in
  onPick: (selection: WingoSelection, quantity: number) => void;
}

export function WingoBoard({ locked, disabled, onPick }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [qty, setQty] = useState<number>(1);

  const off = locked || disabled;
  const pick = (selection: WingoSelection) => {
    if (off) return;
    // Prime (create + resume + iOS silent-unlock) the shared tone context
    // synchronously inside this guaranteed board tap, so a bettor unlocks
    // the countdown beep for the rest of the round even if they arrived
    // straight on the WinGo page without an earlier gesture. Best effort;
    // getToneContext never throws.
    getToneContext();
    onPick(selection, qty);
  };

  return (
    <div className={cn('space-y-4 transition-opacity', locked && 'pointer-events-none opacity-50')}>
      {/* Colour buttons */}
      <div className="grid grid-cols-3 gap-2.5">
        {(['green', 'violet', 'red'] as WingoColorSel[]).map((c) => (
          <button
            key={c}
            type="button"
            disabled={off}
            onClick={() => pick({ betType: 'color', selection: c })}
            className="wingo-pressable group relative h-14 overflow-hidden rounded-2xl text-base font-black uppercase tracking-wider text-white transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 disabled:cursor-not-allowed"
            style={{ background: COLOR_BUTTON[c].grad, boxShadow: pillShadow(COLOR_BUTTON[c].glow) }}
          >
            {/* Glossy top catch-light on the upper half. */}
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[52%] rounded-t-2xl bg-gradient-to-b from-white/35 to-white/0" />
            {/* Hover sheen sweep, transform-only. */}
            <span aria-hidden className="wingo-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 group-hover:opacity-100" />
            <span className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">{bn ? COLOR_BUTTON[c].label.bn : COLOR_BUTTON[c].label.en}</span>
          </button>
        ))}
      </div>

      {/* Glossy 0..9 balls */}
      <div className="relative grid grid-cols-5 justify-items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_40px_-20px_rgba(255,213,84,0.25)]">
        <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />
        {Array.from({ length: 10 }, (_, n) => (
          <WingoBall
            key={n}
            n={n}
            size={54}
            onClick={() => pick({ betType: 'number', selection: String(n) })}
            ariaLabel={`${bn ? 'নম্বর' : 'Number'} ${n}`}
          />
        ))}
      </div>

      {/* Random + quantity chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={off}
          onClick={() => pick({ betType: 'number', selection: String(Math.floor(Math.random() * 10)) })}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3.5 text-xs font-extrabold uppercase tracking-wider text-amber-100 transition hover:bg-amber-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 disabled:opacity-40"
        >
          <Shuffle className="h-3.5 w-3.5" />
          {bn ? 'র‍্যান্ডম' : 'Random'}
        </button>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {QUANTITY_CHIPS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQty(q)}
              aria-pressed={qty === q}
              className={cn(
                'h-11 min-w-[44px] rounded-xl border px-2 text-xs font-bold tabular-nums transition-transform duration-150 ease-out active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50',
                qty === q
                  ? 'border-amber-300/80 bg-gradient-to-b from-amber-300/30 to-amber-500/15 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_-6px_rgba(245,180,0,0.6)]'
                  : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10',
              )}
            >
              X{q}
            </button>
          ))}
        </div>
      </div>

      {/* Big / Small bar */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={off}
          onClick={() => pick({ betType: 'size', selection: 'big' })}
          className="wingo-pressable group relative h-14 overflow-hidden rounded-2xl text-base font-black uppercase tracking-wider text-[#3a1f00] transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(180deg,#ffe08a 0%,#f5b400 46%,#a15c0a 100%)', boxShadow: pillShadow('rgba(245,180,0,0.5)') }}
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[52%] rounded-t-2xl bg-gradient-to-b from-white/45 to-white/0" />
          <span aria-hidden className="wingo-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100" />
          <span className="relative">{bn ? 'বড় 5-9' : 'Big 5-9'}</span>
        </button>
        <button
          type="button"
          disabled={off}
          onClick={() => pick({ betType: 'size', selection: 'small' })}
          className="wingo-pressable group relative h-14 overflow-hidden rounded-2xl text-base font-black uppercase tracking-wider text-white transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(180deg,#7cc9ff 0%,#2f8fe0 46%,#0a4a8f 100%)', boxShadow: pillShadow('rgba(56,150,230,0.5)') }}
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[52%] rounded-t-2xl bg-gradient-to-b from-white/35 to-white/0" />
          <span aria-hidden className="wingo-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100" />
          <span className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">{bn ? 'ছোট 0-4' : 'Small 0-4'}</span>
        </button>
      </div>
    </div>
  );
}
