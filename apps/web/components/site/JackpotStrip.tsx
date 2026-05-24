// Built by Anointed Coder.
//
// Premium jackpot strip. Dark glass card with gold trim, light streak
// across the surface, sparkle dust, and three pool cards with strong
// visual hierarchy (Grand sits in the centre, larger and gold-rimmed).
// Numbers tick upward gently to feel alive. Pure UI, no real prize
// pool source.

'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Crown, Trophy } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export function JackpotStrip() {
  const t = useT();
  const [mini, setMini] = useState(493);
  const [grand, setGrand] = useState(121_497);
  const [major, setMajor] = useState(7_923);

  useEffect(() => {
    const id = setInterval(() => {
      setMini((v) => v + Math.random() * 0.2);
      setGrand((v) => v + Math.random() * 4);
      setMajor((v) => v + Math.random() * 1);
    }, 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      aria-label={t('home.jackpot.title')}
      className="relative overflow-hidden rounded-2xl border border-brand-yellow-500/30 bg-[linear-gradient(135deg,#0F1115_0%,#1A1D24_45%,#0F1115_100%)] p-4 text-white shadow-[0_18px_44px_-28px_rgba(245,180,0,0.55)] md:p-6"
    >
      {/* Decorative layers */}
      <span aria-hidden className="pointer-events-none absolute -top-20 -left-12 h-48 w-48 rounded-full bg-brand-yellow-500/30 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-rose-500/20 blur-3xl" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'repeating-linear-gradient(115deg, transparent 0 18px, rgba(255,255,255,0.04) 18px 19px)',
        }}
      />
      {/* Sweep light streak */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[-30%] w-[60%] -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
      {/* Tiny coin sparkles */}
      <span aria-hidden className="pointer-events-none absolute right-6 top-3 h-1.5 w-1.5 rounded-full bg-brand-yellow-300 shadow-[0_0_8px_rgba(255,224,102,0.85)]" />
      <span aria-hidden className="pointer-events-none absolute right-14 top-7 h-1 w-1 rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.85)]" />
      <span aria-hidden className="pointer-events-none absolute left-10 bottom-3 h-1 w-1 rounded-full bg-brand-yellow-400" />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-yellow-500 text-brand-ink shadow-[0_4px_10px_-4px_rgba(245,180,0,0.7)]">
            <Crown className="h-4 w-4" />
          </span>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-yellow-300">
            {t('home.jackpot.title')}
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-yellow-500/20 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/75">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {t('home.jackpot.subtitle')}
        </p>
      </div>

      <div className="relative mt-4 grid grid-cols-3 items-end gap-2 sm:gap-3">
        <Pool
          icon={<Sparkles className="h-3.5 w-3.5" />}
          gradient="from-amber-300 via-amber-500 to-amber-700"
          label={t('home.jackpot.mini')}
          value={mini}
        />
        <Pool
          icon={<Crown className="h-3.5 w-3.5" />}
          gradient="from-rose-400 via-rose-500 to-red-700"
          label={t('home.jackpot.grand')}
          value={grand}
          highlight
        />
        <Pool
          icon={<Trophy className="h-3.5 w-3.5" />}
          gradient="from-sky-400 via-blue-500 to-blue-800"
          label={t('home.jackpot.major')}
          value={major}
        />
      </div>
    </section>
  );
}

function Pool({
  icon,
  gradient,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  gradient: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border text-center transition',
        highlight
          ? 'border-brand-yellow-500/55 bg-gradient-to-b from-white/10 to-white/[0.02] px-3 py-4 sm:py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_28px_-16px_rgba(245,180,0,0.65)] -translate-y-1'
          : 'border-white/10 bg-white/[0.04] px-3 py-3 sm:py-4',
      )}
    >
      {/* Tone wash */}
      <span aria-hidden className={cn('pointer-events-none absolute -top-10 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full opacity-40 blur-2xl', `bg-gradient-to-br ${gradient}`)} />
      {/* Bottom hairline */}
      <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Icon badge */}
      <span
        className={cn(
          'relative mx-auto flex items-center justify-center rounded-lg text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(0,0,0,0.5)]',
          highlight ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-7 w-7',
          `bg-gradient-to-br ${gradient}`,
        )}
      >
        {icon}
      </span>

      <p className={cn(
        'relative mt-1 text-[10px] font-bold uppercase tracking-wider',
        highlight ? 'text-brand-yellow-200/95' : 'text-white/70',
      )}>
        {label}
      </p>

      <p
        className={cn(
          'relative mt-0.5 font-black tabular-nums leading-none',
          highlight
            ? 'text-xl sm:text-2xl bg-clip-text text-transparent bg-[linear-gradient(180deg,#FFE066_0%,#F5B400_50%,#A87200_100%)] drop-shadow-[0_2px_6px_rgba(245,180,0,0.45)]'
            : 'text-base sm:text-lg text-white drop-shadow',
        )}
      >
        {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
