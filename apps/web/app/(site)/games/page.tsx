// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames } from '@/lib/mock/games';
import { mockCategories } from '@/lib/mock/categories';
import { useT, useLang } from '@/lib/i18n/context';
import { Sparkles, Dice5, Bomb, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NativeGameSummary {
  gameCode: string;
  displayName: string;
  isActive: boolean;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
}

const NATIVE_CARDS: Array<{
  gameCode: string;
  href: string;
  icon: typeof Dice5;
  accent: string;
  taglineEn: string;
  taglineBn: string;
}> = [
  {
    gameCode: 'dice',
    href: '/games/dice',
    icon: Dice5,
    accent: 'from-fuchsia-500 via-indigo-600 to-indigo-800',
    taglineEn: 'Instant settle. Pick a target, roll over or under.',
    taglineBn: 'সাথে সাথে সেটল। লক্ষ্য বাছাই করুন, কম বা বেশি রোল করুন।',
  },
  {
    gameCode: 'mines',
    href: '/games/mines',
    icon: Bomb,
    accent: 'from-rose-500 via-red-600 to-orange-600',
    taglineEn: 'Reveal safe tiles, cash out before the mine.',
    taglineBn: 'নিরাপদ টাইল উন্মোচন করুন, মাইনের আগে ক্যাশআউট করুন।',
  },
];

export default function GamesPage() {
  const t = useT();
  const { lang } = useLang();
  const [category, setCategory] = useState<string>('all');
  const filtered = category === 'all' ? mockGames : mockGames.filter((g) => g.categoryId === category);

  const [natives, setNatives] = useState<NativeGameSummary[]>([]);
  const [nativesEnabled, setNativesEnabled] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/native-games', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setNatives(Array.isArray(data.games) ? (data.games as NativeGameSummary[]) : []);
        setNativesEnabled(Boolean(data.enabled));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      <CategoryHero
        kicker={t('navx.slots').replace(/.*/, t('home.sectionHot').toUpperCase())}
        title={t('home.sectionHot')}
        description={t('home.sectionHotDesc')}
        accent="navy"
      />

      {natives.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-yellow-600" />
            <h2 className="text-base font-extrabold text-brand-ink md:text-lg">
              {lang === 'bn' ? 'পাশা নেটিভ গেমস' : 'Pasha Native Games'}
            </h2>
            <span className="ml-2 inline-flex h-5 items-center rounded-full border border-brand-yellow-500/40 bg-brand-yellow-500/10 px-2 text-[10px] font-bold uppercase tracking-wider text-brand-yellow-700">
              {lang === 'bn' ? 'নতুন' : 'New'}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {NATIVE_CARDS.map((card) => {
              const live = natives.find((n) => n.gameCode === card.gameCode);
              if (!live) return null;
              const available = nativesEnabled && live.isActive;
              const Icon = card.icon;
              return (
                <Link
                  key={card.gameCode}
                  href={card.href}
                  className={cn(
                    'group relative block overflow-hidden rounded-2xl text-white shadow-sm',
                    'bg-gradient-to-br',
                    card.accent,
                  )}
                >
                  <div aria-hidden className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
                  <div className="relative flex items-center gap-4 p-5 md:p-6">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
                      <Icon className="h-7 w-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">{lang === 'bn' ? 'পাশা নেটিভ' : 'Pasha Native'}</p>
                      <h3 className="text-xl font-extrabold leading-tight md:text-2xl">{live.displayName}</h3>
                      <p className="mt-1 text-sm text-white/80">{lang === 'bn' ? card.taglineBn : card.taglineEn}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                        <span className="rounded-md border border-white/25 bg-white/10 px-2 py-0.5">{lang === 'bn' ? 'বেট' : 'Bet'}: {Number(live.minBet)} - {Number(live.maxBet)}</span>
                        <span className="rounded-md border border-white/25 bg-white/10 px-2 py-0.5">{lang === 'bn' ? 'হাউস এজ' : 'Edge'}: {(Number(live.houseEdgeBps) / 100).toFixed(2)}%</span>
                        {!available ? (
                          <span className="rounded-md border border-amber-200/60 bg-amber-200/15 px-2 py-0.5 font-semibold text-amber-100">
                            {lang === 'bn' ? 'সাময়িকভাবে অনুপলব্ধ' : 'Temporarily unavailable'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className="pill-provider"
          data-active={category === 'all'}
        >
          {t('common.all')}
        </button>
        {mockCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className="pill-provider"
            data-active={category === c.id}
          >
            {lang === 'bn' ? c.nameBn : c.nameEn}
          </button>
        ))}
      </div>

      <CategoryCatalog games={filtered} />
    </div>
  );
}
