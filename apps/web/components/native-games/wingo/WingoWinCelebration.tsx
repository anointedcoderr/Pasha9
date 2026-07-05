// Built by Anointed Coder.
//
// Win celebration for WinGo. Mirrors the Lotto / Spin win popups
// (mahogany backdrop, gold ribbon, large prize tally, Continue button)
// but takes the settled WinGo payout for the round the player just won.
// Opens when the page detects a newly settled winning bet and feeds the
// real credited amount straight from /api/games/wingo/my-bets.

'use client';

import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trophy } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';

export interface WingoWin {
  periodNumber: string;
  amount: number; // total credited across all winning lines
  lineCount: number;
}

interface Props {
  open: boolean;
  win: WingoWin | null;
  onClose: () => void;
}

export function WingoWinCelebration({ open, win, onClose }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const playedRef = useRef(false);

  useEffect(() => {
    if (!open || !win) {
      playedRef.current = false;
      return;
    }
    if (playedRef.current) return;
    playedRef.current = true;
    if (typeof window !== 'undefined' && typeof window.navigator?.vibrate === 'function') {
      window.navigator.vibrate?.([60, 50, 90]);
    }
  }, [open, win]);

  if (!win) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-1.5rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 shadow-[0_40px_100px_-30px_rgba(245,180,0,0.85)] outline-none"
          style={{ background: 'linear-gradient(180deg,#5a3a1d 0%,#2a1a10 100%)' }}
        >
          <Dialog.Title className="sr-only">{bn ? 'অভিনন্দন' : 'Congratulations'}</Dialog.Title>

          {/* Falling gold sparks, decorative. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {[12, 28, 44, 60, 76, 88].map((left, i) => (
              <span
                key={left}
                className="wingo-spark absolute top-0 h-2 w-2 rounded-full bg-amber-300"
                style={{ left: `${left}%`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <div className="relative px-6 pb-6 pt-8 text-center">
            <button
              type="button"
              onClick={onClose}
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/30 bg-black/30 text-amber-200 hover:bg-black/50"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200">
              <Trophy className="h-3 w-3" />
              {bn ? 'আপনি জিতেছেন' : 'You won'}
            </span>

            <div className="wingo-pop mt-5">
              <p className="text-4xl font-black tabular-nums text-amber-200 drop-shadow-[0_2px_10px_rgba(245,180,0,0.4)]">
                {formatBDT(win.amount)}
              </p>
            </div>

            <p className="mt-3 text-xs text-amber-100/75">
              {bn ? 'পিরিয়ড' : 'Period'} {win.periodNumber}
              {win.lineCount > 1 ? ` . ${win.lineCount} ${bn ? 'লাইন' : 'lines'}` : ''}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-sm font-extrabold uppercase tracking-wider text-[#3a1f00] shadow-[0_8px_24px_-6px_rgba(245,180,0,0.5)] hover:brightness-105 active:brightness-95"
            >
              {bn ? 'দারুণ, চালিয়ে যান' : 'Awesome - Continue'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
