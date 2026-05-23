// Built by Anointed Coder.
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type Tone = 'light' | 'dark';

export function Logo({
  compact,
  href = '/',
  tone = 'dark',
}: {
  compact?: boolean;
  href?: string;
  /** dark = for light backgrounds (default for public site); light = for dark backgrounds (admin) */
  tone?: Tone;
}) {
  const textBase = tone === 'dark' ? 'text-brand-ink' : 'text-ink-hi';
  const accentClass = tone === 'dark' ? 'text-brand-yellow-600' : 'text-gradient-neon';
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2.5')} aria-label="Pasha 9 home">
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-grad-yellow shadow-[0_4px_14px_-6px_rgba(245,180,0,0.55)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z" stroke="#0F1115" strokeWidth="1.6" />
          <path d="M12 8 L15 12 L12 16 L9 12 Z" fill="#0F1115" />
        </svg>
      </span>
      {!compact && (
        <span className={cn('font-display text-lg font-extrabold tracking-tight', textBase)}>
          <span>Pasha</span>
          <span aria-hidden="true">&nbsp;</span>
          <span className={accentClass}>9</span>
        </span>
      )}
    </Link>
  );
}
