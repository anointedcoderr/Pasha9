// Built by Anointed Coder.
//
// Glossy 3D WinGo ball. Original SVG/CSS artwork: a radial gloss over
// the digit's colour identity, a specular highlight, a hairline gold
// ring when selected, and a soft ambient glow. Split balls (0 and 5)
// render a diagonal two-colour face. Press feedback is transform-only
// so it stays at 60fps and honours reduced-motion.

'use client';

import { cn } from '@/lib/utils/cn';
import { ballSkin, ballShadow } from './ui';

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
    boxShadow: ballShadow(skin, size, selected),
    color: skin.ink,
  };

  // A soft elliptical top gloss band sitting above the digit sells the wet,
  // glass-marble shine. Purely decorative, no layout, transform-free.
  const gloss = (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[7%] z-20 h-[36%] w-[64%] -translate-x-1/2 rounded-[100%]"
      style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.14) 55%, rgba(255,255,255,0) 100%)' }}
    />
  );

  const digit = (
    <span
      className="relative z-10 font-black tabular-nums leading-none"
      style={{
        fontSize: Math.round(size * 0.46),
        textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.4)',
      }}
    >
      {n}
    </span>
  );

  if (asBadge) {
    return (
      <span
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
        className={cn('relative inline-flex shrink-0 select-none items-center justify-center rounded-full', className)}
        style={style}
      >
        {size >= 24 ? gloss : null}
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
        'wingo-ball relative inline-flex shrink-0 select-none items-center justify-center rounded-full transition-transform duration-150 ease-out',
        'hover:-translate-y-0.5 hover:scale-[1.04] active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40',
        selected && 'wingo-selected',
        className,
      )}
      style={style}
    >
      {gloss}
      {digit}
    </button>
  );
}
