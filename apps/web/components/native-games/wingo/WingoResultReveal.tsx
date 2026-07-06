// Built by Anointed Coder.
//
// Suspense result reveal. When a new round result lands, a tumbling
// shuffle of balls settles onto the drawn ball, which pops with a
// colour burst. Shows the drawn digit, its colour identity and size.
// Purely presentational and self-dismissing; the win celebration (with
// the real payout) is a separate overlay driven by settled bets.

'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useLang } from '@/lib/i18n/context';
import { WingoBall } from './WingoBall';
import { colorOf, sizeOf, colorLabel, sizeLabel, ballSkin, sizePillSkin, colorChipSkin } from './ui';

interface Props {
  open: boolean;
  result: number | null;
  periodNumber: string | null;
  onClose: () => void;
}

export function WingoResultReveal({ open, result, periodNumber, onClose }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [settled, setSettled] = useState(false);

  // Two-beat reveal: tumble for ~900ms, then settle + burst. Auto-close
  // a moment later so the board is not blocked.
  useEffect(() => {
    if (!open || result == null) {
      setSettled(false);
      return;
    }
    setSettled(false);
    const t1 = window.setTimeout(() => setSettled(true), 900);
    const t2 = window.setTimeout(() => onClose(), 2600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, result, onClose]);

  if (result == null) return null;
  const id = colorOf(result);
  const size = sizeOf(result);
  const skin = ballSkin(result);
  // Glossy identity pills, drawn from the same shared tokens as the history
  // ladder so the reveal reads as one material with the rest of the board.
  const colorChip = colorChipSkin(id);
  const sizeChip = sizePillSkin(size);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 p-6 text-center outline-none shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)]"
          style={{ background: 'radial-gradient(120% 90% at 50% 0%, #34200f 0%, #1a0d08 55%, #0d0704 100%)' }}
        >
          {/* Soft gold hairline crown for depth. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
          <Dialog.Title className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
            {bn ? 'ফলাফল' : 'Result'} {periodNumber ? `. ${periodNumber}` : ''}
          </Dialog.Title>

          <div className="relative mx-auto mt-5 grid h-40 place-items-center">
            {/* Colour burst behind the settled ball. */}
            {settled ? (
              <span
                aria-hidden
                className="wingo-burst absolute inset-0 m-auto h-32 w-32 rounded-full"
                style={{ background: `radial-gradient(circle, ${skin.glow} 0%, transparent 70%)` }}
              />
            ) : null}

            {settled ? (
              <div className="wingo-pop relative">
                <WingoBall n={result} size={112} asBadge />
              </div>
            ) : (
              // Tumbling shuffle: three balls cycling behind a blur.
              <div className="wingo-tumble relative">
                <WingoBall n={(result + 3) % 10} size={96} asBadge />
              </div>
            )}
          </div>

          {settled ? (
            <div className="wingo-fade-in mt-4">
              <p className="text-lg font-black text-amber-100">
                {bn ? 'নম্বর' : 'Number'} {result}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span
                  className="inline-flex items-center justify-center rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wide"
                  style={{
                    background: colorChip.grad,
                    color: colorChip.ink,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 0 0 1px ${colorChip.rim}, 0 2px 8px -3px rgba(0,0,0,0.6)`,
                  }}
                >
                  {colorLabel(id, lang)}
                </span>
                <span
                  className="inline-flex items-center justify-center rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wide"
                  style={{
                    background: sizeChip.grad,
                    color: sizeChip.ink,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), inset 0 0 0 1px ${sizeChip.rim}, 0 2px 8px -3px rgba(0,0,0,0.6)`,
                  }}
                >
                  {sizeLabel(size, lang)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.25em] text-amber-200/80">
              {bn ? 'ড্র হচ্ছে...' : 'Drawing...'}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
