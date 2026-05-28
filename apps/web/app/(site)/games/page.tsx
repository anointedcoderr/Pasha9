// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames } from '@/lib/mock/games';
import { mockCategories } from '@/lib/mock/categories';
import { useT, useLang } from '@/lib/i18n/context';
import { Sparkles, Dice5, Bomb, Target, Zap, Cherry, CircleDollarSign, ArrowRight, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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

const GAME_ART: Record<string, { icon: LucideIcon; accent: string; taglineEn: string; taglineBn: string }> = {
  dice: {
    icon: Dice5,
    accent: 'from-fuchsia-500 via-indigo-600 to-indigo-800',
    taglineEn: 'Instant settle. Pick a target, roll over or under.',
    taglineBn: 'সাথে সাথে সেটল। লক্ষ্য বাছাই করুন, কম বা বেশি রোল করুন।',
  },
  mines: {
    icon: Bomb,
    accent: 'from-rose-500 via-red-600 to-orange-600',
    taglineEn: 'Reveal safe tiles, cash out before the mine.',
    taglineBn: 'নিরাপদ টাইল উন্মোচন করুন, মাইনের আগে ক্যাশআউট করুন।',
  },
  keno: {
    icon: Target,
    accent: 'from-emerald-500 via-emerald-600 to-teal-700',
    taglineEn: 'Pick numbers. The server draws 20. Match to win big.',
    taglineBn: 'নম্বর বাছাই করুন। সার্ভার ২০টি ড্র করবে। মিল হলেই বড় জয়।',
  },
  roulette: {
    icon: CircleDollarSign,
    accent: 'from-red-600 via-rose-700 to-amber-700',
    taglineEn: 'European single zero. Red, black, straight - your call.',
    taglineBn: 'ইউরোপীয় সিঙ্গেল জিরো। রেড, ব্ল্যাক, সরাসরি - আপনার ইচ্ছা।',
  },
  slots: {
    icon: Cherry,
    accent: 'from-amber-400 via-amber-500 to-orange-500',
    taglineEn: 'Three reels, eight original symbols, instant payout.',
    taglineBn: 'তিন রিল, আটটি মৌলিক চিহ্ন, সাথে সাথে পেআউট।',
  },
  crash: {
    icon: Zap,
    accent: 'from-cyan-500 via-blue-600 to-indigo-700',
    taglineEn: 'Set your target, beat the crash, take the multiplier.',
    taglineBn: 'লক্ষ্য সেট করুন, ক্র্যাশের আগে যান, গুণিতক নিন।',
  },
};

const DEFAULT_ART = {
  icon: Sparkles,
  accent: 'from-slate-700 via-slate-800 to-brand-ink',
  taglineEn: 'Original Pasha 9 native game.',
  taglineBn: 'মৌলিক পাশা ৯ নেটিভ গেম।',
};

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
              const art = GAME_ART[g.gameCode] ?? DEFAULT_ART;
              const Icon = art.icon;
              const available = g.isActive;
              const href = g.frontHref ?? '/games';
              const CardInner = (
                <div className={cn('group relative h-full overflow-hidden rounded-2xl text-white shadow-sm bg-gradient-to-br', art.accent, !available && 'opacity-90')}>
                  <div aria-hidden className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
                  <div className="relative flex h-full flex-col gap-3 p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
                        <Icon className="h-6 w-6" />
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {g.isFeatured ? (
                          <span className="rounded-full border border-amber-200/60 bg-amber-200/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100">
                            {lang === 'bn' ? 'হট' : 'Hot'}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          {lang === 'bn' ? 'অরিজিনাল' : 'Original'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">{lang === 'bn' ? 'পাশা অরিজিনাল' : 'Pasha Original'}</p>
                      <h3 className="text-xl font-extrabold leading-tight md:text-2xl">{g.displayName}</h3>
                      <p className="mt-1 text-sm text-white/85">{lang === 'bn' ? art.taglineBn : art.taglineEn}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-white/75">
                      <span className="rounded-md border border-white/25 bg-white/10 px-2 py-0.5">{lang === 'bn' ? 'ওয়ালেট কানেক্টেড' : 'Wallet connected'}</span>
                      <span className="rounded-md border border-white/25 bg-white/10 px-2 py-0.5">{lang === 'bn' ? 'বেট' : 'Bet'}: {Number(g.minBet)}-{Number(g.maxBet)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {available ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-brand-ink shadow-sm group-hover:translate-y-[-1px] transition">
                          {lang === 'bn' ? 'এখনই খেলুন' : 'Play Now'}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">
                          <Lock className="h-3 w-3" />
                          {lang === 'bn' ? 'শীঘ্রই আসছে' : 'Coming soon'}
                        </span>
                      )}
                      <span className="text-[10px] text-white/65">{lang === 'bn' ? 'হাউস এজ' : 'Edge'}: {(Number(g.houseEdgeBps) / 100).toFixed(2)}%</span>
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
