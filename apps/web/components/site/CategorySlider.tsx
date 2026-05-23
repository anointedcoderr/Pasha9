// Built by Anointed Coder.
// Babu-style horizontal category slider that sits below the wallet strip.
// Mobile-first; scrolls horizontally with momentum; clean tile cards with
// icon + label. Tapping a tile navigates to the matching catalog page.

'use client';

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
              className={cn(
                'group relative flex shrink-0 snap-start flex-col items-center justify-end',
                'h-[88px] w-[78px] rounded-2xl px-2 pb-2 pt-3 md:h-[100px] md:w-[92px]',
                'overflow-hidden border border-brand-divider bg-brand-paper transition',
                'hover:border-brand-yellow-500 hover:shadow-[0_8px_22px_-14px_rgba(245,180,0,0.6)]',
                'data-[active=true]:border-brand-yellow-500 data-[active=true]:shadow-[0_8px_22px_-14px_rgba(245,180,0,0.6)]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute -top-6 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60',
                  `bg-gradient-to-br ${TONE[item.tone]}`,
                )}
              />
              <span
                className={cn(
                  'relative mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-[0_6px_14px_-8px_rgba(15,17,21,0.4)]',
                  `bg-gradient-to-br ${TONE[item.tone]}`,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="relative text-center text-[11px] font-bold text-brand-ink md:text-[12px]">
                {lang === 'bn' ? item.labelBn : item.labelEn}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
