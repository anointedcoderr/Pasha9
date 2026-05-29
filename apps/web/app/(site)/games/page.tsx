// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames } from '@/lib/mock/games';
import { mockCategories } from '@/lib/mock/categories';
import { useT, useLang } from '@/lib/i18n/context';
import { Sparkles, ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { GameArt } from '@/components/native-games/GameArt';
import { ProviderGamesSection } from '@/components/site/ProviderGamesSection';

interface NativeGameSummary {
  gameCode: string;
  displayName: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  frontHref: string | null;
}

type ArtCode = 'dice' | 'mines' | 'keno' | 'roulette' | 'slots' | 'crash';

const SUPPORTED: ReadonlySet<ArtCode> = new Set(['dice', 'mines', 'keno', 'roulette', 'slots', 'crash']);
function isArtCode(s: string): s is ArtCode { return SUPPORTED.has(s as ArtCode); }

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
        kicker={t('home.sectionHot')}
        title={t('home.sectionHot')}
        description={t('home.sectionHotDesc')}
        accent="navy"
        category="hotGames"
        chips={[
          { label: 'Hot', tone: 'rose' },
          { label: 'Trending', tone: 'gold' },
          { label: 'Wallet Connected', tone: 'sky' },
        ]}
      />

      {nativesEnabled && natives.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-yellow-600" />
            <h2 className="text-base font-extrabold text-brand-ink md:text-lg">
              {lang === 'bn' ? 'পাশা অরিজিনালস' : 'Pasha Originals'}
            </h2>
            <span className="ml-2 inline-flex h-5 items-center rounded-full border border-brand-yellow-500/40 bg-brand-yellow-500/10 px-2 text-[10px] font-bold uppercase tracking-wider text-brand-yellow-700">
              {lang === 'bn' ? 'নতুন' : 'New'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 md:gap-3 xl:grid-cols-6">
            {natives.map((g) => {
              const available = g.isActive;
              const href = g.frontHref ?? '/games';
              const artCode = isArtCode(g.gameCode) ? g.gameCode : null;
              const CardInner = (
                <div className={cn('group png-card relative h-full overflow-hidden rounded-2xl border border-white/10 bg-brand-ink text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]', !available && 'opacity-95')}>
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {artCode ? (
                      <GameArt code={artCode} className="absolute inset-0 h-full w-full" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-brand-ink" />
                    )}
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-brand-ink/95" />
                    <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1">
                      {g.isFeatured ? (
                        <span className="rounded-full border border-amber-200/60 bg-amber-200/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100 backdrop-blur">
                          {lang === 'bn' ? 'হট' : 'Hot'}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/30 bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        {lang === 'bn' ? 'অরিজিনাল' : 'Original'}
                      </span>
                    </div>
                  </div>

                  <div className="relative -mt-7 px-3 pb-3 pt-0">
                    <h3 className="truncate text-sm font-extrabold leading-tight text-white">{g.displayName}</h3>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      {available ? (
                        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                          {lang === 'bn' ? 'খেলুন' : 'Play'}
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="inline-flex h-7 items-center gap-1 rounded-full border border-white/25 bg-white/5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
                          <Lock className="h-2.5 w-2.5" />
                          {lang === 'bn' ? 'শীঘ্রই' : 'Soon'}
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums text-white/55">৳{Number(g.minBet)}+</span>
                    </div>
                  </div>
                </div>
              );
              return available ? (
                <Link key={g.gameCode} href={href} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-500/50">
                  {CardInner}
                </Link>
              ) : (
                <div key={g.gameCode} aria-disabled className="cursor-not-allowed">
                  {CardInner}
                </div>
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

      <ProviderGamesSection showAdminLink />
    </div>
  );
}
