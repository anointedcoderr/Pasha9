// Built by Anointed Coder.
//
// Win celebration for WinGo (#7 redesign). A branded congratulations popup for
// the round the player just won: a large heading, the winning result (the
// coloured number ball + colour and Big/Small chips), the exact credited amount
// counting up, the period number, an auto-close countdown, a close button and
// smooth open/close. Real result + amount come straight from the settled round
// via /api/games/wingo/my-bets. Pasha9 colours, not a third-party palette.

'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { WingoBall } from './WingoBall';
import { colorOf, sizeOf, colorLabel, sizeLabel, colorChipSkin, sizePillSkin } from './ui';

export interface WingoWin {
  periodNumber: string;
  amount: number; // total credited across all winning lines
  lineCount: number;
  result: number; // the winning digit 0..9 (colour + size derive from it)
}

interface Props {
  open: boolean;
  win: WingoWin | null;
  onClose: () => void;
}

const AUTO_CLOSE_SECONDS = 10;

export function WingoWinCelebration({ open, win, onClose }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const playedRef = useRef(false);
  const [shown, setShown] = useState(0);
  const [secs, setSecs] = useState(AUTO_CLOSE_SECONDS);

  // Haptic on open.
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

  // Count the credited amount up.
  useEffect(() => {
    if (!open || !win) {
      setShown(0);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const to = win.amount;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / 800);
      setShown(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open, win]);

  // Auto-close countdown.
  useEffect(() => {
    if (!open || !win) return;
    setSecs(AUTO_CLOSE_SECONDS);
    const id = window.setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [open, win]);
  useEffect(() => {
    if (open && win && secs === 0) onClose();
  }, [open, win, secs, onClose]);

  if (!win) return null;

  const cid = colorOf(win.result);
  const sid = sizeOf(win.result);
  const cchip = colorChipSkin(cid);
  const schip = sizePillSkin(sid);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="wingo-pop fixed left-1/2 top-1/2 z-[101] w-[calc(100%-1.5rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 shadow-[0_40px_100px_-30px_rgba(245,180,0,0.85)] outline-none"
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

          <div className="relative px-6 pb-6 pt-9 text-center">
            <button
              type="button"
              onClick={onClose}
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/30 bg-black/30 text-amber-200 hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Headline */}
            <h2 className="text-2xl font-black uppercase tracking-[0.12em] text-amber-200 [text-shadow:0_2px_14px_rgba(245,180,0,0.55)] sm:text-3xl">
              {bn ? 'অভিনন্দন!' : 'Congratulations!'}
            </h2>

            {/* Winning result: ball + colour + size */}
            <div className="mt-5 flex items-center justify-center gap-3">
              <WingoBall n={win.result} size={64} />
              <div className="flex flex-col items-start gap-1.5">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: cchip.grad, color: cchip.ink, boxShadow: `inset 0 0 0 1px ${cchip.rim}` }}
                >
                  {colorLabel(cid, lang)}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: schip.grad, color: schip.ink, boxShadow: `inset 0 0 0 1px ${schip.rim}` }}
                >
                  {sizeLabel(sid, lang)}
                </span>
              </div>
            </div>

            {/* Amount, counting up */}
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/70">
              {bn ? 'আপনি জিতেছেন' : 'You won'}
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums text-amber-200 drop-shadow-[0_2px_10px_rgba(245,180,0,0.4)]">
              {formatBDT(shown)}
            </p>

            <p className="mt-2 text-xs text-amber-100/75">
              {bn ? 'পিরিয়ড' : 'Period'} {win.periodNumber}
              {win.lineCount > 1 ? ` · ${win.lineCount} ${bn ? 'লাইন' : 'lines'}` : ''}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-sm font-extrabold uppercase tracking-wider text-[#3a1f00] shadow-[0_8px_24px_-6px_rgba(245,180,0,0.5)] hover:brightness-105 active:brightness-95"
            >
              {bn ? 'দারুণ, চালিয়ে যান' : 'Awesome - Continue'}
            </button>

            <p className="mt-3 text-[11px] text-amber-100/50">
              {bn ? `${secs} সেকেন্ডে বন্ধ হবে` : `Closing in ${secs}s`}
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
