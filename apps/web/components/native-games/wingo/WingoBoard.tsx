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
import { COLOR_BUTTON, QUANTITY_CHIPS, type WingoColorSel } from './ui';
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
            className="relative h-14 overflow-hidden rounded-2xl text-base font-black uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_24px_-12px_rgba(0,0,0,0.7)] transition active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:cursor-not-allowed"
            style={{ background: COLOR_BUTTON[c].grad }}
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
            <span className="relative">{bn ? COLOR_BUTTON[c].label.bn : COLOR_BUTTON[c].label.en}</span>
          </button>
        ))}
      </div>

      {/* Glossy 0..9 balls */}
      <div className="grid grid-cols-5 justify-items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
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
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3.5 text-xs font-extrabold uppercase tracking-wider text-amber-100 transition hover:bg-amber-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 disabled:opacity-40"
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
              className={cn(
                'h-10 min-w-[44px] rounded-xl border px-2 text-xs font-bold tabular-nums transition',
                qty === q
                  ? 'border-amber-300 bg-amber-400/20 text-amber-100'
                  : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10',
              )}
            >
              X{q}
            </button>
          ))}
        </div>
      </div>

      {/* Big / Small bar */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10">
        <button
          type="button"
          disabled={off}
          onClick={() => pick({ betType: 'size', selection: 'big' })}
          className="h-14 bg-gradient-to-b from-amber-400 to-amber-600 text-base font-black uppercase tracking-wider text-[#3a1f00] transition active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed"
        >
          {bn ? 'বড় 5-9' : 'Big 5-9'}
        </button>
        <button
          type="button"
          disabled={off}
          onClick={() => pick({ betType: 'size', selection: 'small' })}
          className="h-14 bg-gradient-to-b from-sky-400 to-sky-700 text-base font-black uppercase tracking-wider text-white transition active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed"
        >
          {bn ? 'ছোট 0-4' : 'Small 0-4'}
        </button>
      </div>
    </div>
  );
}
