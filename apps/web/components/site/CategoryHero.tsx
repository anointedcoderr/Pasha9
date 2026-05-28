// Built by Anointed Coder.
//
// Premium shared hero used by every public category / menu page
// (Hot Games, Live Casino, Slot Games, Crash, Cricket, Table Games,
// Fast, Fishing, Sportsbook, Promotion, Betting Pass, Pasha
// Originals, Lotto, Rewards, VIP, Affiliate, FAQ).
//
// 2-column composition: kicker / title / subtitle / chips / CTA on
// the left, per-category artwork on the right with ambient glow.
// Backwards-compatible: callers that only pass kicker/title/
// description/accent get the upgraded look automatically. Pass
// `category` to lock in the per-category artwork.

'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { type ReactNode } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CategoryHeroArt, type CategoryCode } from './CategoryHeroArt';

type Accent = 'yellow' | 'blue' | 'royal' | 'red' | 'green' | 'navy';
type ChipTone = 'gold' | 'emerald' | 'sky' | 'rose' | 'bone';

interface ChipItem {
  label: string;
  tone?: ChipTone;
}

interface Props {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  accent?: Accent;
  /** Optional per-category artwork. Falls back to a premium default mark. */
  category?: CategoryCode;
  /** Optional premium chip stack rendered under the subtitle. */
  chips?: Array<ChipItem | string>;
  /** Optional call-to-action button. */
  cta?: { label: string; href: string };
  /** Legacy escape hatch: pass a custom illustration to fully override the right column. */
  art?: ReactNode;
}

// Per-accent gradient story for the hero ribbon. Darker than the
// old translucent banner so text contrast lifts immediately.
const ACCENT_BG: Record<Accent, string> = {
  yellow: 'from-[#3a1f08] via-[#5a330e] to-[#1a0a06]',
  blue:   'from-[#0a1640] via-[#102a72] to-[#04060f]',
  royal:  'from-[#1a0d2a] via-[#2a1062] to-[#101030]',
  red:    'from-[#260714] via-[#480818] to-[#1a0608]',
  green:  'from-[#08231a] via-[#0e4634] to-[#06120e]',
  navy:   'from-[#0b1020] via-[#1a1f3a] to-[#040816]',
};

export function CategoryHero({ kicker, title, description, accent = 'navy', category, chips, cta, art }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0613] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_60px_-30px_rgba(0,0,0,0.65)]">
      {/* Layered background */}
      <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br opacity-95', ACCENT_BG[accent])} />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(255,213,84,0.18),transparent_55%)]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-12 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-10 bottom-0 h-60 w-60 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative grid grid-cols-[1fr_125px] items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_180px] sm:gap-5 sm:px-5 sm:py-5 md:grid-cols-[1.2fr_1fr] md:gap-6 md:px-7 md:py-7">
        {/* Left: copy + chips + CTA */}
        <div className="min-w-0">
          {kicker ? (
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
              <Sparkles className="h-3 w-3" />
              {kicker}
            </p>
          ) : null}
          <h1 className="mt-1 text-2xl font-extrabold leading-[1.05] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] sm:text-3xl md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-md text-xs font-medium text-white/90 sm:text-sm">
              {description}
            </p>
          ) : null}

          {chips && chips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chips.map((c, i) => {
                const item = typeof c === 'string' ? { label: c } : c;
                return <Chip key={i} tone={item.tone ?? 'bone'}>{item.label}</Chip>;
              })}
            </div>
          ) : null}

          {cta ? (
            <Link
              href={cta.href}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-5 text-xs font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_18px_-8px_rgba(245,180,0,0.7)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 active:translate-y-px"
            >
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        {/* Right: per-category illustration. `art` prop wins if passed. */}
        <div className="relative h-28 sm:h-36 md:h-44">
          {art ? (
            <div className="absolute inset-0">{art}</div>
          ) : (
            <CategoryHeroArt code={category ?? 'default'} className="absolute inset-0 h-full w-full drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]" />
          )}
        </div>
      </div>
    </section>
  );
}

function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const map: Record<ChipTone, string> = {
    gold:    'border-amber-300/55 bg-gradient-to-b from-amber-300/25 to-amber-500/10 text-amber-100',
    emerald: 'border-emerald-300/55 bg-gradient-to-b from-emerald-400/25 to-emerald-600/10 text-emerald-100',
    sky:     'border-sky-300/55 bg-gradient-to-b from-sky-400/25 to-sky-600/10 text-sky-100',
    rose:    'border-rose-300/55 bg-gradient-to-b from-rose-400/25 to-rose-600/10 text-rose-100',
    bone:    'border-white/25 bg-white/10 text-white/90',
  };
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur', map[tone])}>
      {children}
    </span>
  );
}
