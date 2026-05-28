// Built by Anointed Coder.
//
// Pasha Originals strip for the homepage. Pulls /api/native-games at
// mount, filters by isFeatured, and renders a premium card per game.
// Inactive games surface as "Temporarily unavailable" so the strip
// never silently disappears. When the global native_games_enabled
// flag is OFF the entire strip is hidden.
//
// Cards link to the per-game /games/<code> page. Logged-out players
// hitting Play Now keep going to the same URL; the play page itself
// triggers the existing login modal/redirect on first server call -
// no duplicate auth handling here.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Dice5, Bomb, Target, Zap, Cherry, CircleDollarSign, ArrowRight, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
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

interface NativeListResp {
  enabled: boolean;
  games: NativeGameSummary[];
}

// Per-game accent + icon. Anything not listed here renders with the
// default gold accent so a future game added by an operator still
// surfaces cleanly even before this file is updated.
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

export function HomeNativeGamesSection() {
  const { lang } = useLang();
  const [games, setGames] = useState<NativeGameSummary[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/native-games', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: NativeListResp | null) => {
        if (!alive || !data) { setLoaded(true); return; }
        setEnabled(Boolean(data.enabled));
        setGames(Array.isArray(data.games) ? data.games.filter((g) => g.isFeatured) : []);
        setLoaded(true);
      })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  if (!loaded) return null;
  if (!enabled) return null;
  if (games.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow-500 text-brand-ink">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-brand-ink md:text-xl">
              {lang === 'bn' ? 'পাশা অরিজিনালস' : 'Pasha Originals'}
            </h2>
            <p className="text-xs text-brand-inkMute">
              {lang === 'bn'
                ? 'মৌলিক, প্রভাবলি ফেয়ার, ওয়ালেট কানেক্টেড। সাথে সাথে রেজাল্ট।'
                : 'Original, provably fair, wallet connected. Instant results.'}
            </p>
          </div>
        </div>
        <Link href="/games" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink hover:text-brand-yellow-600">
          {lang === 'bn' ? 'সব দেখুন' : 'View All'} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => {
          const art = GAME_ART[g.gameCode] ?? DEFAULT_ART;
          const href = g.frontHref ?? '/games';
          const playable = g.isActive;
          const Icon = art.icon;

          const CardInner = (
            <div
              className={cn(
                'group relative overflow-hidden rounded-2xl text-white shadow-sm bg-gradient-to-br h-full',
                art.accent,
                !playable && 'opacity-90',
              )}
            >
              <div aria-hidden className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
              <div className="relative flex h-full flex-col gap-3 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      {lang === 'bn' ? 'অরিজিনাল' : 'Original'}
                    </span>
                    <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      {lang === 'bn' ? 'ইনস্ট্যান্ট' : 'Instant'}
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
                  {playable ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-brand-ink shadow-sm group-hover:translate-y-[-1px] transition">
                      {lang === 'bn' ? 'এখনই খেলুন' : 'Play Now'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">
                      <Lock className="h-3 w-3" />
                      {lang === 'bn' ? 'সাময়িকভাবে অনুপলব্ধ' : 'Temporarily unavailable'}
                    </span>
                  )}
                  <span className="text-[10px] text-white/65">{lang === 'bn' ? 'হাউস এজ' : 'Edge'}: {(Number(g.houseEdgeBps) / 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );

          return playable ? (
            <Link key={g.gameCode} href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-500/50 rounded-2xl">
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
  );
}
