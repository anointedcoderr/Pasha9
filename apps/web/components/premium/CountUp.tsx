// Built by Anointed Coder.
//
// Lightweight count-up animation. No third-party dep: requestAnimationFrame
// loop driven by a cubic easeOut. Respects prefers-reduced-motion by
// snapping to the final value immediately.

'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Final value to count toward. */
  to: number;
  /** Starting value. Defaults to 0. */
  from?: number;
  /** Duration in ms. Defaults to 1200. */
  durationMs?: number;
  /** Decimal places to render. */
  decimals?: number;
  /** Locale-aware grouping separators. */
  group?: boolean;
  /** Prefix rendered before the number. */
  prefix?: string;
  /** Suffix rendered after the number. */
  suffix?: string;
  /** Extra className passed through to the wrapping <span>. */
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function format(value: number, decimals: number, group: boolean): string {
  if (group) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toFixed(decimals);
}

export function CountUp({
  to,
  from = 0,
  durationMs = 1200,
  decimals = 0,
  group = true,
  prefix = '',
  suffix = '',
  className,
}: Props) {
  const [value, setValue] = useState<number>(from);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    if (reduced) {
      setValue(to);
      return;
    }
    startedAtRef.current = null;
    const tick = (ts: number) => {
      if (startedAtRef.current == null) startedAtRef.current = ts;
      const elapsed = ts - startedAtRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [to, from, durationMs]);

  return (
    <span className={className} aria-live="polite">
      {prefix}{format(value, decimals, group)}{suffix}
    </span>
  );
}
