// Built by Anointed Coder.
// Babu-style horizontal category slider that sits below the wallet strip.
// Mobile-first; scrolls horizontally with momentum; clean tile cards with
// icon + label. Tapping a tile navigates to the matching catalog page.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, Flame, Cherry, Tv2, Zap, Trophy, Fish, Dice5 } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

interface Item {
  key: string;
  labelEn: string;
  labelBn: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'gold' | 'red' | 'blue' | 'violet' | 'teal' | 'orange' | 'cyan';
}

const ITEMS: Item[] = [
  { key: 'jackpot', labelEn: 'Jackpot', labelBn: 'জ্যাকপট', href: '/games?cat=jackpot', icon: Crown, tone: 'gold' },
  { key: 'hot', labelEn: 'Hot', labelBn: 'হট', href: '/games', icon: Flame, tone: 'red' },
  { key: 'slot', labelEn: 'Slot', labelBn: 'স্লট', href: '/slots', icon: Cherry, tone: 'violet' },
  { key: 'casino', labelEn: 'Casino', labelBn: 'ক্যাসিনো', href: '/live-casino', icon: Tv2, tone: 'blue' },
  { key: 'crash', labelEn: 'Crash', labelBn: 'ক্র্যাশ', href: '/games/crash', icon: Zap, tone: 'orange' },
  { key: 'sports', labelEn: 'Sports', labelBn: 'স্পোর্টস', href: '/sports', icon: Trophy, tone: 'teal' },
  { key: 'fishing', labelEn: 'Fishing', labelBn: 'ফিশিং', href: '/fishing', icon: Fish, tone: 'cyan' },
  { key: 'table', labelEn: 'Table', labelBn: 'টেবিল', href: '/games/table', icon: Dice5, tone: 'gold' },
];

const TONE: Record<Item['tone'], string> = {
  gold: 'from-amber-300 via-amber-400 to-amber-600',
  red: 'from-rose-400 via-red-500 to-orange-600',
  blue: 'from-sky-400 via-blue-500 to-blue-700',
  violet: 'from-fuchsia-400 via-purple-500 to-indigo-700',
  teal: 'from-teal-300 via-teal-500 to-emerald-700',
  orange: 'from-orange-300 via-orange-500 to-red-600',
  cyan: 'from-cyan-300 via-cyan-500 to-blue-700',
};

export function CategorySlider() {
  const { lang } = useLang();
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    fetch('/api/content/homepage-shortcuts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.icons) return;
        setOverrides(j.icons as Record<string, string>);
      })
      .catch(() => { /* keep lucide fallback */ });
    return () => { alive = false; };
  }, []);

  return (
    <section
      aria-label={lang === 'bn' ? 'গেম ক্যাটাগরি' : 'Game categories'}
      className="-mx-3 px-3 md:mx-0 md:px-0"
    >
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 scrollbar-none md:gap-3">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              data-active={active}
              aria-label={lang === 'bn' ? item.labelBn : item.labelEn}
              className={cn(
                'group relative flex shrink-0 snap-start flex-col items-center justify-end',
                'h-[94px] w-[80px] rounded-2xl px-2 pb-2 pt-3 md:h-[110px] md:w-[96px]',
                'overflow-hidden border border-brand-divider bg-brand-paper transition-all duration-200',
                'hover:-translate-y-0.5 hover:border-brand-yellow-500 hover:shadow-[0_14px_28px_-16px_rgba(245,180,0,0.55)]',
                'data-[active=true]:-translate-y-0.5 data-[active=true]:border-brand-yellow-500 data-[active=true]:shadow-[0_14px_28px_-16px_rgba(245,180,0,0.55)]',
              )}
            >
              {/* Glow behind icon (intensity boosts on hover/active) */}
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute -top-5 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full opacity-35 blur-2xl transition-opacity duration-200 group-hover:opacity-65 group-data-[active=true]:opacity-65',
                  `bg-gradient-to-br ${TONE[item.tone]}`,
                )}
              />
              {/* Top-edge hairline */}
              <span aria-hidden className="pointer-events-none absolute inset-x-2 top-1 h-px bg-gradient-to-r from-transparent via-brand-yellow-500/60 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-data-[active=true]:opacity-100" />
              {/* Diagonal shine sweep on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-y-2 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100"
              />

              {/* Icon tile. With a custom upload we drop the gradient
                  background entirely and let the image fill the tile,
                  matching Babu-style category cards. The lucide
                  fallback keeps the original gradient + inset
                  highlight. */}
              {overrides[item.key] ? (
                <span className="relative mx-auto mb-1.5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl md:h-16 md:w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={overrides[item.key]}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </span>
              ) : (
                <span
                  className={cn(
                    'relative mx-auto mb-1.5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl text-white',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.18),0_6px_14px_-6px_rgba(15,17,21,0.35)]',
                    'ring-1 ring-black/10',
                    `bg-gradient-to-br ${TONE[item.tone]}`,
                  )}
                >
                  <Icon className="h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
                </span>
              )}
              <span className="relative text-center text-[11px] font-bold leading-tight text-brand-ink md:text-[12px]">
                {lang === 'bn' ? item.labelBn : item.labelEn}
              </span>
              {/* Active dot */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-yellow-500 opacity-0 transition-opacity duration-200 group-data-[active=true]:opacity-100"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
