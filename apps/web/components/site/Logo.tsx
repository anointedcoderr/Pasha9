import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export function Logo({ compact, href = '/' }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2.5')} aria-label="Pasha 9 home">
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-grad-gold shadow-glow-gold">
        <span className="absolute inset-0 rounded-xl opacity-40 mix-blend-overlay animate-pulseGlow" />
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z" stroke="#06120c" strokeWidth="1.6" />
          <path d="M12 8 L15 12 L12 16 L9 12 Z" fill="#06120c" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-lg font-extrabold tracking-tight">
          <span className="text-ink-hi">Pasha</span>
          <span aria-hidden="true">&nbsp;</span>
          <span className="text-gradient-neon">9</span>
        </span>
      )}
    </Link>
  );
}
