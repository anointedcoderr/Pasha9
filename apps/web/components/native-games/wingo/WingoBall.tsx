// Built by Anointed Coder.
//
// Glossy 3D WinGo ball. Original SVG/CSS artwork: a radial gloss over
// the digit's colour identity, a specular highlight, a hairline gold
// ring when selected, and a soft ambient glow. Split balls (0 and 5)
// render a diagonal two-colour face. Press feedback is transform-only
// so it stays at 60fps and honours reduced-motion.

'use client';

import { cn } from '@/lib/utils/cn';
import { ballSkin } from './ui';

interface Props {
  n: number;
  size?: number; // px diameter
  selected?: boolean;
  onClick?: () => void;
  // When true the ball renders as a static badge (history strip / reveal)
  // with no button semantics.
  asBadge?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function WingoBall({ n, size = 56, selected = false, onClick, asBadge = false, className, ariaLabel }: Props) {
  const skin = ballSkin(n);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: skin.background,
    boxShadow: selected
      ? `0 0 0 2px rgba(255,213,84,0.95), 0 0 18px 2px ${skin.glow}, inset 0 -6px 12px rgba(0,0,0,0.35)`
      : `0 0 0 1px ${skin.ring}, 0 6px 14px -6px ${skin.glow}, inset 0 -6px 12px rgba(0,0,0,0.35)`,
    color: skin.ink,
  };
  const digit = (
    <span
      className="relative z-10 font-black tabular-nums leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
      style={{ fontSize: Math.round(size * 0.46) }}
    >
      {n}
    </span>
  );

  if (asBadge) {
    return (
      <span
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
        className={cn('relative inline-flex select-none items-center justify-center rounded-full', className)}
        style={style}
      >
        {digit}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel ?? `Number ${n}`}
      className={cn(
        'wingo-ball relative inline-flex select-none items-center justify-center rounded-full transition-transform duration-100',
        'hover:-translate-y-0.5 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80',
        className,
      )}
      style={style}
    >
      {digit}
    </button>
  );
}
