// Built by Anointed Coder.
//
// Canonical "value + Copy button" row. Solves the flexbox min-width
// trap that was clipping the Copy button off the right edge on
// narrow viewports: the field wrapper sets min-width: 0 so flex-1
// can actually shrink below the intrinsic content width, the value
// truncates with ellipsis, and the button has flex-shrink: 0 plus
// min-width so it never collapses.
//
// CRITICAL: the value that gets copied is the `value` prop, NEVER
// the rendered text. When the displayed value truncates with an
// ellipsis the copy must still write the full string.
//
// Below 360px the row wraps and the button drops to full width on
// its own line, so the row never goes off-screen even at extreme
// font-scaling. Same component used across referral, dashboard,
// deposit/withdrawal references, lotto tickets, support, wallet
// addresses, agent dashboard.

'use client';

import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CopyRowProps {
  /** Optional label rendered above the row. */
  label?: string;
  /** The value that gets copied AND the value that renders inside the
   *  field. Must be the canonical string, not derived from DOM. */
  value: string;
  /** Optional override for the displayed text (e.g. a masked version).
   *  Defaults to value. The COPY action always copies value, not this. */
  displayValue?: string;
  /** Optional copy-button label. Defaults to "Copy". */
  copyLabel?: string;
  /** Optional copied-state label. Defaults to "Copied". */
  copiedLabel?: string;
  /** Optional className for the outer wrapper (rare). */
  className?: string;
  /** When set, the field renders as monospace + uppercase code style
   *  (default true for compatibility with the old CopyField). */
  monospace?: boolean;
  /** Small visual variant for tighter rows (e.g. inside table cells). */
  size?: 'md' | 'sm';
}

export function CopyRow({
  label,
  value,
  displayValue,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  className,
  monospace = true,
  size = 'md',
}: CopyRowProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    // Always copy the canonical `value` prop, never read from the
    // rendered DOM. If we read DOM we would pick up the ellipsis.
    if (typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older webviews that block clipboard.writeText
      // unless the call is in a user gesture. We try execCommand.
      try {
        const el = document.createElement('textarea');
        el.value = value;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      } catch {
        /* swallow - the page still works, the value is visible */
      }
    }
  }, [value]);

  const fieldH = size === 'sm' ? 'h-9' : 'h-11';
  const btnH = size === 'sm' ? 'h-9' : 'h-11';

  return (
    <div className={cn('w-full min-w-0', className)}>
      {label ? (
        <p className="mb-2 text-xs uppercase tracking-wider text-ink-lo">{label}</p>
      ) : null}
      {/*
        The flex container, the field wrapper, and the field span all
        need min-width: 0 or flex-1 will not shrink. flex-wrap kicks
        in below 360px so the button drops below the field instead of
        being clipped off the right edge.
      */}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
        <div className={cn('relative flex min-w-0 flex-1 basis-[60%] items-center overflow-hidden rounded-xl border border-neon/15 bg-base-deep/60', fieldH)}>
          <span
            className={cn(
              'block w-full truncate px-3 text-sm text-ink-hi',
              monospace && 'font-mono',
            )}
            // Hover/focus tooltip with full untruncated value so
            // power users can read what got copied without copying.
            title={value}
          >
            {displayValue ?? value}
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? copiedLabel : copyLabel}
          className={cn(
            'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neon/40 bg-neon/20 px-3 text-sm font-bold text-ink-hi transition active:translate-y-px hover:bg-neon/30 min-w-[64px]',
            btnH,
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </div>
  );
}
