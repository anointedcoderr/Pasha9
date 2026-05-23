// Built by Anointed Coder.
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type Tone = 'light' | 'dark';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE = {
  sm: { box: 'h-8 w-8', icon: 'h-[18px] w-[18px]', text: 'text-base', gap: 'gap-2' },
  md: { box: 'h-10 w-10', icon: 'h-[22px] w-[22px]', text: 'text-xl', gap: 'gap-2.5' },
  lg: { box: 'h-12 w-12', icon: 'h-7 w-7', text: 'text-2xl', gap: 'gap-3' },
  xl: { box: 'h-14 w-14', icon: 'h-8 w-8', text: 'text-3xl', gap: 'gap-3' },
} as const;

export function Logo({
  compact,
  href = '/',
  tone = 'dark',
  size = 'md',
  className,
}: {
  compact?: boolean;
  href?: string;
  /** dark = for light backgrounds (default for public site); light = for dark backgrounds (admin) */
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  const s = SIZE[size];
  const textColor = tone === 'dark' ? 'text-brand-ink' : 'text-white';
  return (
    <Link
      href={href}
      className={cn('group inline-flex items-center', s.gap, className)}
      aria-label="Pasha 9 home"
    >
      <span
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-2xl',
          s.box,
          'bg-[linear-gradient(140deg,#FFE066_0%,#FFCC00_45%,#F5B400_75%,#A87200_100%)]',
          'shadow-[0_8px_22px_-10px_rgba(245,180,0,0.85),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_4px_rgba(0,0,0,0.18)]',
          'ring-1 ring-black/10',
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <span className="absolute -left-2 top-0 h-1/2 w-1/2 rotate-12 rounded-full bg-white/35 blur-md" />
        </span>
        <svg viewBox="0 0 32 32" className={cn('relative', s.icon)} fill="none" aria-hidden>
          <defs>
            <linearGradient id="pashaShine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1d24" />
              <stop offset="100%" stopColor="#0F1115" />
            </linearGradient>
          </defs>
          <path
            d="M16 3 L27 9 L27 22 L16 29 L5 22 L5 9 Z"
            fill="url(#pashaShine)"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.6"
          />
          <path
            d="M14 10 v12 M14 10 q5 0 5 4 q0 4 -5 4 h-0"
            stroke="#FFCC00"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="22" cy="11" r="1.2" fill="#FFE066" />
        </svg>
      </span>
      {!compact && (
        <span className={cn('font-display font-extrabold leading-none tracking-tight', s.text, textColor)}>
          <span>Pasha</span>
          <span aria-hidden> </span>
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg,#F5B400 0%,#FFCC00 45%,#A87200 100%)' }}
          >
            9
          </span>
        </span>
      )}
    </Link>
  );
}
