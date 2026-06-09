// Built by Anointed Coder.
//
// Split-flap mechanical countdown digit. Renders a stack of two
// half-tiles (top + bottom) and flips the top half when the value
// changes. Inspired by airport departure boards.
//
// Used by the Lotto countdown clock.

'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  /** Current digit / character to display. */
  value: string;
  /** Optional label rendered underneath ("HRS", "MIN", "SEC"). */
  label?: string;
  /** Tile size variant. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: { w: 'w-9', h: 'h-12', text: 'text-2xl', label: 'text-[9px]' },
  md: { w: 'w-14', h: 'h-20', text: 'text-4xl', label: 'text-[10px]' },
  lg: { w: 'w-20', h: 'h-28', text: 'text-6xl', label: 'text-[11px]' },
} as const;

export function FlipDigit({ value, label, size = 'md' }: Props) {
  const [displayed, setDisplayed] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const previousValue = useRef(value);
  const sz = SIZE[size];

  useEffect(() => {
    if (previousValue.current === value) return;
    setFlipping(true);
    const id = window.setTimeout(() => {
      setDisplayed(value);
      setFlipping(false);
      previousValue.current = value;
    }, 240);
    return () => window.clearTimeout(id);
  }, [value]);

  // The visual is two half-cards stacked with a thin gap. The top
  // card flips on change; the bottom card is the destination.
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className={cn(
          'relative inline-block rounded-md bg-[linear-gradient(180deg,#15171c_0%,#0a0a0d_100%)] shadow-[inset_0_1px_0_rgba(255,220,140,0.18),0_8px_22px_-12px_rgba(0,0,0,0.7)]',
          sz.w,
          sz.h,
        )}
        style={{ perspective: '380px' }}
        aria-label={label ? `${value} ${label}` : value}
      >
        {/* Persistent base card showing the current displayed digit. */}
        <span
          className={cn(
            'pa-display absolute inset-0 flex items-center justify-center font-black tabular-nums text-[#f0d27a]',
            sz.text,
          )}
        >
          {displayed}
        </span>

        {/* Top half: flips on change, masking the destination digit underneath. */}
        {flipping ? (
          <span
            aria-hidden
            className={cn(
              'pa-flap absolute inset-x-0 top-0 h-1/2 overflow-hidden rounded-t-md bg-[linear-gradient(180deg,#15171c_0%,#0a0a0d_100%)]',
            )}
            style={{ transformOrigin: 'center bottom', backfaceVisibility: 'hidden' }}
          >
            <span
              className={cn(
                'pa-display absolute inset-x-0 flex h-[200%] items-center justify-center font-black tabular-nums text-[#f0d27a]',
                sz.text,
              )}
            >
              {previousValue.current}
            </span>
          </span>
        ) : null}

        {/* Hairline gap dividing top and bottom halves. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-px bg-black/70" />
      </div>
      {label ? (
        <span className={cn('font-bold uppercase tracking-[0.22em] text-[#b89657]', sz.label)}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
