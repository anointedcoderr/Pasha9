// Built by Anointed Coder.
// Wide hero banner used at the top of category pages (slots, live casino,
// fishing, lotto, crash, etc.). Custom SVG art only, no copyrighted imagery.

'use client';

import { cn } from '@/lib/utils/cn';
import { type ReactNode } from 'react';

type Accent = 'yellow' | 'blue' | 'royal' | 'red' | 'green' | 'navy';

interface Props {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  accent?: Accent;
  art?: ReactNode;
}

const ACCENT: Record<Accent, string> = {
  yellow: 'from-amber-400 via-amber-500 to-orange-500',
  blue: 'from-brand-blue-500 via-brand-blue-600 to-brand-blue-700',
  royal: 'from-fuchsia-500 via-indigo-600 to-indigo-800',
  red: 'from-rose-500 via-red-600 to-orange-600',
  green: 'from-emerald-500 via-emerald-600 to-teal-700',
  navy: 'from-slate-700 via-slate-800 to-brand-ink',
};

export function CategoryHero({ kicker, title, description, accent = 'navy', art }: Props) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl text-white shadow-sm',
        'bg-gradient-to-br',
        ACCENT[accent],
      )}
    >
      <div className="absolute inset-0 opacity-90">
        {art ?? <DefaultArt />}
      </div>
      <div className="relative grid items-center gap-4 px-5 py-7 md:grid-cols-[1.4fr_1fr] md:px-10 md:py-10">
        <div>
          {kicker ? (
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-400">
              {kicker}
            </p>
          ) : null}
          <h1 className="mt-1 text-2xl font-extrabold leading-tight md:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-lg text-sm text-white/80 md:text-base">{description}</p> : null}
        </div>
      </div>
    </section>
  );
}

function DefaultArt() {
  return (
    <svg viewBox="0 0 800 220" className="h-full w-full">
      <g opacity="0.6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <path key={i} d={`M0 ${30 + i * 32} Q 400 ${i * 18} 800 ${30 + i * 32}`} />
        ))}
      </g>
      <g transform="translate(560 30)">
        <circle cx="60" cy="60" r="46" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" />
        <text x="60" y="70" textAnchor="middle" fontSize="34" fontWeight="800" fill="#FFFFFF">9</text>
      </g>
    </svg>
  );
}
