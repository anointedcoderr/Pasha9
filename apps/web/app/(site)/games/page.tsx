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

const GAME_META: Record<string, { taglineEn: string; taglineBn: string; chipEn: string; chipBn: string }> = {
  dice: {
    taglineEn: 'Instant settle. Pick a target, roll over or under.',
    taglineBn: 'সাথে সাথে সেটল। লক্ষ্য বাছাই করুন, কম বা বেশি রোল করুন।',
    chipEn: 'Instant', chipBn: 'ইনস্ট্যান্ট',
  },
  mines: {
    taglineEn: 'Reveal safe tiles, cash out before the mine.',
    taglineBn: 'নিরাপদ টাইল উন্মোচন করুন, মাইনের আগে ক্যাশআউট করুন।',
    chipEn: 'Arcade', chipBn: 'আর্কেড',
  },
  keno: {
    taglineEn: 'Pick numbers. The server draws 20. Match to win big.',
    taglineBn: 'নম্বর বাছাই করুন। সার্ভার ২০টি ড্র করবে। মিল হলেই বড় জয়।',
    chipEn: 'Instant', chipBn: 'ইনস্ট্যান্ট',
  },
  roulette: {
    taglineEn: 'European single zero. Red, black, straight - your call.',
    taglineBn: 'ইউরোপীয় সিঙ্গেল জিরো। রেড, ব্ল্যাক, সরাসরি - আপনার ইচ্ছা।',
    chipEn: 'Table game', chipBn: 'টেবিল গেম',
  },
  slots: {
    taglineEn: 'Three reels, eight original symbols, instant payout.',
    taglineBn: 'তিন রিল, আটটি মৌলিক চিহ্ন, সাথে সাথে পেআউট।',
    chipEn: 'Reels', chipBn: 'রিল',
  },
  crash: {
    taglineEn: 'Set your target, beat the crash, take the multiplier.',
    taglineBn: 'লক্ষ্য সেট করুন, ক্র্যাশের আগে যান, গুণিতক নিন।',
    chipEn: 'Arcade', chipBn: 'আর্কেড',
  },
};

const DEFAULT_META = {
  taglineEn: 'Original Pasha 9 native game.',
  taglineBn: 'মৌলিক পাশা ৯ নেটিভ গেম।',
  chipEn: 'Original',
  chipBn: 'অরিজিনাল',
};

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
        kicker={t('navx.slots').replace(/.*/, t('home.sectionHot').toUpperCase())}
        title={t('home.sectionHot')}
        description={t('home.sectionHotDesc')}
        accent="navy"
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {natives.map((g) => {
              const meta = GAME_META[g.gameCode] ?? DEFAULT_META;
              const available = g.isActive;
              const href = g.frontHref ?? '/games';
              const artCode = isArtCode(g.gameCode) ? g.gameCode : null;
              const CardInner = (
                <div className={cn('group relative h-full overflow-hidden rounded-2xl bg-brand-ink text-white shadow-sm', !available && 'opacity-95')}>
                  <div className="relative">
                    {artCode ? (
                      <GameArt code={artCode} className="w-full" />
                    ) : (
                      <div className="aspect-[16/10] w-full bg-gradient-to-br from-slate-700 via-slate-800 to-brand-ink" />
                    )}
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-brand-ink/95" />
                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                      {g.isFeatured ? (
                        <span className="rounded-full border border-amber-200/60 bg-amber-200/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100">
                          {lang === 'bn' ? 'হট' : 'Hot'}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        {lang === 'bn' ? 'অরিজিনাল' : 'Original'}
                      </span>
                      <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        {lang === 'bn' ? meta.chipBn : meta.chipEn}
                      </span>
                    </div>
                  </div>

                  <div className="relative -mt-10 flex flex-col gap-3 p-4 md:p-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">{lang === 'bn' ? 'পাশা অরিজিনাল' : 'Pasha Original'}</p>
                      <h3 className="text-xl font-extrabold leading-tight">{g.displayName}</h3>
                      <p className="mt-1 text-xs text-white/85">{lang === 'bn' ? meta.taglineBn : meta.taglineEn}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/80">
                      <span className="rounded-md border border-white/20 bg-white/5 px-2 py-0.5">{lang === 'bn' ? 'ওয়ালেট কানেক্টেড' : 'Wallet connected'}</span>
                      <span className="rounded-md border border-white/20 bg-white/5 px-2 py-0.5">{lang === 'bn' ? 'মিন বেট' : 'Min bet'}: {Number(g.minBet)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {available ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-yellow-500 px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-brand-ink shadow-sm transition group-hover:translate-y-[-1px]">
                          {lang === 'bn' ? 'এখনই খেলুন' : 'Play Now'}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">
                          <Lock className="h-3 w-3" />
                          {lang === 'bn' ? 'শীঘ্রই আসছে' : 'Coming soon'}
                        </span>
                      )}
                      <span className="text-[10px] text-white/60">{lang === 'bn' ? 'হাউস এজ' : 'Edge'}: {(Number(g.houseEdgeBps) / 100).toFixed(2)}%</span>
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
    </div>
  );
}
