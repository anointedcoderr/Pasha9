// Built by Anointed Coder.
//
// Result popup for WinGo (#7 redesign). Shows after every round the player
// bet on: a winged rocket medallion on a ribbon, a heading, the lottery
// result (colour + number + Big/Small pills), a torn-receipt strip, the
// period number and a short auto-close countdown. On a WIN it is the orange
// "Congratulations" card with the credited amount counting up; on a LOSS it
// is the blue/silver "Sorry" card showing "Lose". Real result + amount come
// straight from the settled round via /api/games/wingo/my-bets.

'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Rocket } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { colorOf, sizeOf, colorLabel, sizeLabel, colorDotClass } from './ui';

export interface WingoWin {
  periodNumber: string;
  amount: number; // total credited across all winning lines (0 on a loss)
  lineCount: number;
  result: number; // the winning digit 0..9 (colour + size derive from it)
  outcome: 'win' | 'lose';
}

interface Props {
  open: boolean;
  win: WingoWin | null;
  onClose: () => void;
}

const AUTO_CLOSE_SECONDS = 3;

// Scalloped (torn-receipt) top and bottom edge, applied as a CSS mask so the
// white strip reads as a printed ticket without an image asset.
const RECEIPT_SCALLOP =
  'radial-gradient(6px at 50% 0, #0000 98%, #000) repeat-x 50% 0 / 16px 8px,' +
  'radial-gradient(6px at 50% 100%, #0000 98%, #000) repeat-x 50% 100% / 16px 8px,' +
  'linear-gradient(#000 0 0) no-repeat 50% 50% / 100% calc(100% - 16px)';

export function WingoWinCelebration({ open, win, onClose }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const playedRef = useRef(false);
  const [shown, setShown] = useState(0);
  const [secs, setSecs] = useState(AUTO_CLOSE_SECONDS);
  const isWin = win?.outcome !== 'lose';

  // Haptic on open (a soft double-tap on a win, a single tap on a loss).
  useEffect(() => {
    if (!open || !win) {
      playedRef.current = false;
      return;
    }
    if (playedRef.current) return;
    playedRef.current = true;
    if (typeof window !== 'undefined' && typeof window.navigator?.vibrate === 'function') {
      window.navigator.vibrate?.(win.outcome === 'lose' ? [40] : [60, 50, 90]);
    }
  }, [open, win]);

  // Count the credited amount up (win only).
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

  // Win = warm orange/gold; Lose = cool blue/silver. Text ink flips so it
  // stays legible on each card (white on the orange win card, slate on the
  // light blue-grey lose card).
  const theme = isWin
    ? {
        cardBg: 'linear-gradient(180deg,#ff9a52 0%,#f56a3a 58%,#ef5b4f 100%)',
        cardShadow: '0 40px 90px -28px rgba(240,90,40,0.8)',
        ribbon: '#d94f10',
        ribbonBand: '#ef6a1e',
        badgeBg: 'radial-gradient(circle at 40% 34%, #ffe1a1 0%, #ffab3d 52%, #f2790f 100%)',
        badgeShadow: '0 8px 20px -6px rgba(191,90,10,0.85), inset 0 0 0 3px rgba(255,255,255,0.9), inset 0 -6px 12px -4px rgba(150,60,0,0.5)',
        headStyle: { textShadow: '0 2px 10px rgba(150,40,10,0.4)' },
        heading: bn ? 'অভিনন্দন' : 'Congratulations',
        headingClass: 'text-white',
        labelClass: 'text-white/90',
        autoClass: 'text-white',
        autoBorder: 'border-white/60',
        closeClass: 'border-white/40 bg-white/15 text-white hover:bg-white/25 focus-visible:ring-white/70',
      }
    : {
        cardBg: 'linear-gradient(180deg,#cdd6e6 0%,#aab8d0 58%,#98a7c1 100%)',
        cardShadow: '0 40px 90px -28px rgba(90,110,150,0.7)',
        ribbon: '#7c8aa4',
        ribbonBand: '#98a6be',
        badgeBg: 'radial-gradient(circle at 40% 34%, #eef2f8 0%, #b9c6da 52%, #8fa0bb 100%)',
        badgeShadow: '0 8px 20px -6px rgba(80,100,140,0.6), inset 0 0 0 3px rgba(255,255,255,0.9), inset 0 -6px 12px -4px rgba(90,110,150,0.45)',
        headStyle: { textShadow: '0 2px 8px rgba(70,90,120,0.25)' },
        heading: bn ? 'দুঃখিত' : 'Sorry',
        headingClass: 'text-slate-700',
        labelClass: 'text-slate-600',
        autoClass: 'text-slate-600',
        autoBorder: 'border-slate-400/70',
        closeClass: 'border-slate-400/50 bg-white/50 text-slate-600 hover:bg-white/70 focus-visible:ring-slate-400/70',
      };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-1.5rem)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 outline-none"
          style={{ animation: 'wingoPopIn .28s cubic-bezier(.2,.9,.2,1)' }}
        >
          <style>{'@keyframes wingoPopIn{from{opacity:0;transform:translate(-50%,-46%) scale(.92)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}'}</style>
          <Dialog.Title className="sr-only">{theme.heading}</Dialog.Title>

          {/* Result card with the medallion overlapping its top. */}
          <div
            className="relative rounded-[28px] px-6 pb-6 pt-[68px] text-center"
            style={{ background: theme.cardBg, boxShadow: theme.cardShadow }}
          >
            {/* Winged rocket medallion on a ribbon. */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
              <div className="relative h-[104px] w-[230px]">
                <svg viewBox="0 0 230 120" className="absolute inset-0 h-full w-full" fill="none">
                  {/* Ribbon tails behind the medallion. */}
                  <path d="M96 62 L116 62 L116 104 L106 95 L96 104 Z" fill={theme.ribbon} />
                  <path d="M134 62 L114 62 L114 104 L124 95 L134 104 Z" fill={theme.ribbon} />
                  <rect x="94" y="54" width="42" height="20" rx="4" fill={theme.ribbonBand} />
                  {/* Wings: layered white feathers, right side then mirrored left. */}
                  {[
                    { r: -4, rx: 32, ry: 10, o: 1 },
                    { r: -18, rx: 27, ry: 9, o: 0.96 },
                    { r: -32, rx: 22, ry: 8, o: 0.92 },
                    { r: -46, rx: 17, ry: 7, o: 0.88 },
                  ].map((f, i) => (
                    <g key={`r${i}`}>
                      <ellipse cx="170" cy="60" rx={f.rx} ry={f.ry} fill="#ffffff" opacity={f.o} transform={`rotate(${f.r} 148 61)`} />
                      <ellipse cx="170" cy="60" rx={f.rx} ry={f.ry} fill="#ffffff" opacity={f.o} transform={`translate(230 0) scale(-1 1) rotate(${f.r} 148 61)`} />
                    </g>
                  ))}
                </svg>
                <div
                  className="absolute left-1/2 top-[16px] flex h-[66px] w-[66px] -translate-x-1/2 items-center justify-center rounded-full"
                  style={{ background: theme.badgeBg, boxShadow: theme.badgeShadow }}
                >
                  <Rocket className="h-7 w-7 text-white" strokeWidth={2.4} />
                </div>
              </div>
            </div>

            {/* Headline */}
            <h2 className={`text-2xl font-black tracking-tight sm:text-3xl ${theme.headingClass}`} style={theme.headStyle}>
              {theme.heading}
            </h2>

            {/* Lottery result: colour + number + size pills (same on win + loss). */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className={`text-sm font-semibold ${theme.labelClass}`}>
                {bn ? 'লটারি ফলাফল' : 'Lottery results'}
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                style={{ background: 'rgba(198,58,48,0.92)' }}
              >
                <span className={`h-2 w-2 rounded-full ${colorDotClass(cid)}`} />
                {colorLabel(cid, lang)}
              </span>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                style={{ background: 'rgba(198,58,48,0.92)' }}
              >
                {win.result}
              </span>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                style={{ background: 'rgba(198,58,48,0.92)' }}
              >
                {sizeLabel(sid, lang)}
              </span>
            </div>

            {/* Torn-receipt strip: amount counting up on a win, "Lose" on a loss. */}
            <div
              className="mx-auto mt-5 w-full max-w-[300px] bg-white px-5 py-4"
              style={{ WebkitMask: RECEIPT_SCALLOP, mask: RECEIPT_SCALLOP }}
            >
              {isWin ? (
                <>
                  <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: '#c8341f' }}>
                    {bn ? 'বোনাস' : 'Bonus'}
                  </p>
                  <p className="mt-0.5 text-3xl font-black tabular-nums" style={{ color: '#d8452f' }}>
                    {formatBDT(shown)}
                  </p>
                </>
              ) : (
                <p className="text-3xl font-black" style={{ color: '#5b6b86' }}>
                  {bn ? 'হেরেছেন' : 'Lose'}
                </p>
              )}
              <p className="mt-1 text-[11px] text-neutral-500">
                {bn ? 'পিরিয়ড' : 'Period'}: {win.periodNumber}
                {isWin && win.lineCount > 1 ? ` · ${win.lineCount} ${bn ? 'লাইন' : 'lines'}` : ''}
              </p>
            </div>

            {/* Auto-close indicator */}
            <div className={`mt-4 flex items-center justify-center gap-2 text-[12px] font-semibold ${theme.autoClass}`}>
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums ${theme.autoBorder}`}>
                {secs}
              </span>
              {bn ? `${secs} সেকেন্ডে অটো ক্লোজ` : `${secs} second${secs === 1 ? '' : 's'} auto close`}
            </div>
          </div>

          {/* Close button below the card */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 ${theme.closeClass}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
