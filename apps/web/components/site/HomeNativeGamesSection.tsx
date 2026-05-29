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
import { Sparkles, ArrowRight, Lock } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
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

interface NativeListResp {
  enabled: boolean;
  games: NativeGameSummary[];
}

type Code = 'dice' | 'mines' | 'keno' | 'roulette' | 'slots' | 'crash';

const SUPPORTED: ReadonlySet<Code> = new Set(['dice', 'mines', 'keno', 'roulette', 'slots', 'crash']);
function isCode(s: string): s is Code { return SUPPORTED.has(s as Code); }

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

      <p className="-mt-1 text-xs text-brand-inkMute">
        {lang === 'bn'
          ? 'ওয়ালেট কানেক্টেড পাশা গেম এখনই খেলুন।'
          : 'Play wallet-connected Pasha games instantly.'}
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 md:gap-3 xl:grid-cols-6">
        {games.map((g) => {
          const href = g.frontHref ?? '/games';
          const playable = g.isActive;
          const artCode = isCode(g.gameCode) ? g.gameCode : null;

          const CardInner = (
            <div className={cn('group png-card relative h-full overflow-hidden rounded-2xl border border-white/10 bg-brand-ink text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]', !playable && 'opacity-95')}>
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
                  {playable ? (
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

          return playable ? (
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

      <div className="pt-1">
        <Link href="/games" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-ink hover:border-brand-yellow-500 hover:bg-brand-surface">
          {lang === 'bn' ? 'সব গেম দেখুন' : 'View all games'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
