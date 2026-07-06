// Built by Anointed Coder.
//
// The three lower tabs of the WinGo page: Game history (recent draws),
// Chart (a compact trend of the last results with big/small and colour
// tallies) and My history (the signed-in player's bets with outcome).
// Each tab has a designed empty state so a fresh mode never looks broken.

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { History, BarChart3, User, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { WingoBall } from './WingoBall';
import { ballSkin, colorOf, sizeOf, sizeLabel, selectionLabel, sizePillSkin, WINGO_MATERIAL } from './ui';

// useLayoutEffect warns during SSR; fall back to useEffect on the server so
// the newest-column auto-scroll stays a client-only paint with no warning.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import type { WingoResult } from './useWingoState';
import type { WingoMyBet } from './WingoGame';

type Tab = 'game' | 'chart' | 'mine';

interface Props {
  results: WingoResult[];
  myBets: WingoMyBet[];
  myBetsLoading: boolean;
  signedIn: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function WingoHistory({ results, myBets, myBetsLoading, signedIn, hasMore, onLoadMore }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [tab, setTab] = useState<Tab>('game');

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur md:p-4">
      <div role="tablist" aria-label={bn ? 'ইতিহাস' : 'History'} className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
        <TabBtn active={tab === 'game'} onClick={() => setTab('game')} icon={<History className="h-3.5 w-3.5" />}>
          {bn ? 'গেম হিস্ট্রি' : 'Game history'}
        </TabBtn>
        <TabBtn active={tab === 'chart'} onClick={() => setTab('chart')} icon={<BarChart3 className="h-3.5 w-3.5" />}>
          {bn ? 'চার্ট' : 'Chart'}
        </TabBtn>
        <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')} icon={<User className="h-3.5 w-3.5" />}>
          {bn ? 'আমার হিস্ট্রি' : 'My history'}
        </TabBtn>
      </div>

      {tab === 'game' ? <GameHistory results={results} lang={lang} /> : null}
      {tab === 'chart' ? <Chart results={results} lang={lang} /> : null}
      {tab === 'mine' ? (
        <MyHistory
          bets={myBets}
          loading={myBetsLoading}
          signedIn={signedIn}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          lang={lang}
        />
      ) : null}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-1 text-[11px] font-bold uppercase tracking-wider transition',
        active ? 'bg-amber-400/20 text-amber-100' : 'text-white/55 hover:text-white/80',
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

// ---------- Shared premium result indicators ----------

// A glossy colour dot that mirrors the ball palette exactly (including the
// split identity of 0 and 5). Reuses ballSkin so the dot can never drift
// out of sync with the balls it represents. Presentation only.
function ResultDot({ n, size = 14 }: { n: number; size?: number }) {
  const skin = ballSkin(n);
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: skin.background,
        boxShadow: `inset 0 0 0 1px ${skin.rim}, inset 0 1px 1px rgba(255,255,255,0.55), 0 0 6px -1px ${skin.glow}`,
      }}
    />
  );
}

// A refined Big / Small pill. Big wears the house gold, Small a cool sky
// tone; each is a lit lozenge (vertical highlight -> mid -> shadow) with a
// top inner catch-light and a hairline rim so it sits proud of the row.
function SizePill({ n, lang }: { n: number; lang: 'bn' | 'en' }) {
  const skin = sizePillSkin(sizeOf(n));
  return (
    <span
      className="inline-flex h-6 min-w-[50px] items-center justify-center rounded-full px-2 text-[10px] font-black uppercase tracking-wide"
      style={{
        background: skin.grad,
        color: skin.ink,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), inset 0 0 0 1px ${skin.rim}, 0 2px 6px -2px rgba(0,0,0,0.6)`,
      }}
    >
      {sizeLabel(sizeOf(n), lang)}
    </span>
  );
}

// ---------- Game history ----------

function GameHistory({ results, lang }: { results: WingoResult[]; lang: 'bn' | 'en' }) {
  const bn = lang === 'bn';
  if (results.length === 0) return <Empty lang={lang} text={bn ? 'এখনও কোনো ড্র হয়নি।' : 'No draws yet.'} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <div className="grid grid-cols-[1fr_auto_120px] items-center gap-3 border-b border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100/50">
        <span>{bn ? 'পিরিয়ড' : 'Period'}</span>
        <span className="text-center">{bn ? 'নম্বর' : 'Number'}</span>
        <span className="text-right">{bn ? 'ফলাফল' : 'Result'}</span>
      </div>
      <div className="max-h-80 overflow-y-auto scrollbar-none">
        {results.map((r, i) => (
          <div
            key={r.periodNumber}
            className={cn(
              'grid grid-cols-[1fr_auto_120px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]',
              i % 2 === 1 && 'bg-white/[0.015]',
              'border-b border-white/[0.06] last:border-0',
            )}
          >
            <span className="truncate font-mono text-xs tabular-nums text-white/65">{r.periodNumber}</span>
            <div className="flex justify-center">
              <WingoBall n={r.result} size={32} asBadge />
            </div>
            <div className="flex items-center justify-end gap-2">
              <SizePill n={r.result} lang={lang} />
              <ResultDot n={r.result} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Chart ----------

// Trend ladder geometry. Every dot and the connecting line share these
// constants so the crisp gold poly-line always lands dead-centre on its
// winning dot, at any column count.
const DOT = 14; // dot diameter (px)
const GAP_X = 12; // horizontal gap between period columns
const GAP_Y = 7; // vertical gap between the 0..9 ladder rows
const COL_W = DOT + GAP_X; // column pitch
const ROW_H = DOT + GAP_Y; // row pitch
const TREND_WINDOW = 30; // most-recent periods drawn on the ladder

function Chart({ results, lang }: { results: WingoResult[]; lang: 'bn' | 'en' }) {
  const bn = lang === 'bn';

  // Keep the newest columns of the trend ladder in view. The window is
  // capped, so once it fills the series length stops growing; we key the
  // auto-scroll on the newest period id instead, jumping to the right edge
  // only when a genuinely new draw lands. That reveals the emphasized latest
  // winner first and never yanks the player back while they scroll into
  // older history. Results arrive newest-first, so results[0] is the latest.
  // Hooks stay above the empty-state early return so their order is stable.
  const ladderRef = useRef<HTMLDivElement>(null);
  const lastScrolledPeriod = useRef<string | null>(null);
  const latestPeriod = results.length > 0 ? results[0].periodNumber : '';
  useIsoLayoutEffect(() => {
    const el = ladderRef.current;
    if (!el || latestPeriod === '') return;
    if (lastScrolledPeriod.current !== latestPeriod) {
      el.scrollLeft = el.scrollWidth;
      lastScrolledPeriod.current = latestPeriod;
    }
  }, [latestPeriod]);

  if (results.length === 0) return <Empty lang={lang} text={bn ? 'চার্টের জন্য যথেষ্ট ডেটা নেই।' : 'Not enough data for a chart yet.'} />;

  // Stats are computed over the full result set; the ladder shows a recent
  // window so the trend stays readable on a phone.
  let big = 0;
  let small = 0;
  let red = 0;
  let green = 0;
  let violet = 0;
  const freq = Array.from({ length: 10 }, () => 0);
  for (const r of results) {
    if (sizeOf(r.result) === 'big') big++;
    else small++;
    const id = colorOf(r.result);
    if (id === 'red' || id === 'red_violet') red++;
    if (id === 'green' || id === 'green_violet') green++;
    if (id === 'red_violet' || id === 'green_violet') violet++;
    if (r.result >= 0 && r.result <= 9) freq[r.result]++;
  }
  const total = results.length;
  const maxFreq = Math.max(1, ...freq);

  // Oldest to newest for a left-to-right trend, most recent window only.
  const series = [...results].slice(0, TREND_WINDOW).reverse();
  const gridW = (series.length - 1) * COL_W + DOT;
  const gridH = 9 * ROW_H + DOT;
  const cx = (i: number) => i * COL_W + DOT / 2;
  const cy = (v: number) => (9 - v) * ROW_H + DOT / 2;
  const linePts = series.map((r, i) => `${cx(i)},${cy(r.result)}`).join(' ');

  return (
    <div className="space-y-3">
      {/* Trend ladder: each column marks the drawn digit on a 0..9 rail with
          a polished gold line threading the winners. */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/30 p-3">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100/70">{bn ? 'নম্বর ট্রেন্ড' : 'Number trend'}</h4>
          <span className="text-[10px] font-semibold tabular-nums text-white/35">{series.length} {bn ? 'পিরিয়ড' : 'periods'}</span>
        </div>
        <div className="flex gap-2">
          {/* Fixed 0..9 rail labels, aligned to the ladder rows. */}
          <div className="relative shrink-0" style={{ width: 16, height: gridH }} aria-hidden>
            {Array.from({ length: 10 }, (_, v) => (
              <span
                key={v}
                className="absolute right-0 text-right text-[9px] font-bold tabular-nums text-white/30"
                style={{ top: cy(v) - 6, height: 12, lineHeight: '12px', width: 16 }}
              >
                {v}
              </span>
            ))}
          </div>
          <div ref={ladderRef} className="overflow-x-auto scrollbar-none">
            <div className="relative" style={{ width: gridW, height: gridH }}>
              <svg
                className="pointer-events-none absolute inset-0"
                width={gridW}
                height={gridH}
                viewBox={`0 0 ${gridW} ${gridH}`}
                fill="none"
                aria-hidden
              >
                <defs>
                  <linearGradient id="wingo-trend-stroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#ffe08a" />
                    <stop offset="1" stopColor="#f5b400" />
                  </linearGradient>
                </defs>
                {series.length > 1 ? (
                  <>
                    {/* Layered under-strokes fake a soft glow with no filter. */}
                    <polyline points={linePts} stroke="rgba(245,180,0,0.14)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
                    <polyline points={linePts} stroke="rgba(245,180,0,0.30)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
                    <polyline points={linePts} stroke="url(#wingo-trend-stroke)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  </>
                ) : null}
              </svg>
              {series.map((r, i) => (
                <div key={r.periodNumber} title={r.periodNumber}>
                  {Array.from({ length: 10 }, (_, v) => {
                    const win = v === r.result;
                    const latest = win && i === series.length - 1;
                    return (
                      <span
                        key={v}
                        className={cn('absolute rounded-full', latest && 'wingo-trend-latest')}
                        style={{
                          left: i * COL_W,
                          top: (9 - v) * ROW_H,
                          width: DOT,
                          height: DOT,
                          background: win
                            ? 'radial-gradient(circle at 35% 30%, #fff3cf 0%, #ffd257 42%, #f5b400 74%, #a86e00 100%)'
                            : 'rgba(255,255,255,0.06)',
                          boxShadow: win
                            ? 'inset 0 0 0 1px rgba(255,224,138,0.55), inset 0 1px 1px rgba(255,255,255,0.7), 0 0 9px 0 rgba(245,180,0,0.5)'
                            : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
                          zIndex: win ? 2 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Analytics stat cards. */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={bn ? 'বড়' : 'Big'} value={big} total={total} tone="big" />
        <StatCard label={bn ? 'ছোট' : 'Small'} value={small} total={total} tone="small" />
        <StatCard label={bn ? 'বেগুনি' : 'Violet'} value={violet} total={total} tone="violet" />
        <StatCard label={bn ? 'লাল' : 'Red'} value={red} total={total} tone="red" />
        <StatCard label={bn ? 'সবুজ' : 'Green'} value={green} total={total} tone="green" />
        <StatCard label={bn ? 'ড্র' : 'Draws'} value={total} total={total} tone="draws" />
      </div>

      {/* Number frequency rail (derived from results, no new fetch). */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/30 p-3">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100/70">{bn ? 'নম্বর ফ্রিকোয়েন্সি' : 'Number frequency'}</h4>
          <span className="text-[10px] font-semibold text-white/35">{bn ? `${total} ড্র` : `${total} draws`}</span>
        </div>
        <div className="grid grid-cols-10 gap-1.5">
          {freq.map((count, d) => {
            const hot = count === maxFreq && count > 0;
            const cold = count === 0;
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <WingoBall n={d} size={26} asBadge className={cold ? 'opacity-40' : undefined} />
                <span className={cn('text-[10px] font-black tabular-nums', hot ? 'text-amber-200' : cold ? 'text-white/25' : 'text-white/60')}>{count}</span>
                {/* Relative-frequency micro-meter. */}
                <span className="h-0.5 w-full overflow-hidden rounded-full bg-white/8">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round((count / maxFreq) * 100)}%`,
                      background: hot ? 'linear-gradient(90deg,#ffe08a,#f5b400)' : 'rgba(255,255,255,0.28)',
                    }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// Premium analytics card: a gradient swatch + tinted headline number + a
// gradient fill meter showing the share of draws. The gradients are drawn
// straight from the shared WINGO_MATERIAL tokens so Green / Red / Violet
// read identically to the balls and buttons.
type StatTone = 'big' | 'small' | 'violet' | 'red' | 'green' | 'draws';

function toneGradient(tone: StatTone): string {
  switch (tone) {
    case 'green': {
      const m = WINGO_MATERIAL.green;
      return `linear-gradient(135deg, ${m.highlight} 0%, ${m.mid} 55%, ${m.shadow} 100%)`;
    }
    case 'red': {
      const m = WINGO_MATERIAL.red;
      return `linear-gradient(135deg, ${m.highlight} 0%, ${m.mid} 55%, ${m.shadow} 100%)`;
    }
    case 'violet': {
      const m = WINGO_MATERIAL.violet;
      return `linear-gradient(135deg, ${m.highlight} 0%, ${m.mid} 55%, ${m.shadow} 100%)`;
    }
    case 'big':
      return 'linear-gradient(135deg, #ffe9ad 0%, #f5b400 55%, #9a6a00 100%)';
    case 'small':
      return 'linear-gradient(135deg, #c6e9ff 0%, #39a7e0 55%, #0f4f74 100%)';
    case 'draws':
      return 'linear-gradient(135deg, #fff4d6 0%, #d9b45a 55%, #7c5a12 100%)';
  }
}

const TONE_TEXT: Record<StatTone, string> = {
  green: '#8ff5d0',
  red: '#ffb4bf',
  violet: '#d9b8ff',
  big: '#ffdf9a',
  small: '#a9dcff',
  draws: '#f1e2b2',
};

function StatCard({ label, value, total, tone }: { label: string; value: number; total: number; tone: StatTone }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const grad = toneGradient(tone);
  return (
    <div className="wingo-fade-in relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2.5">
      <div className="flex items-center justify-between">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: grad, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }} aria-hidden />
        <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white/55">{pct}%</span>
      </div>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className="text-xl font-black tabular-nums" style={{ color: TONE_TEXT[tone] }}>{value}</p>
      <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: grad }} />
      </span>
    </div>
  );
}

// ---------- My history ----------

function MyHistory({
  bets,
  loading,
  signedIn,
  hasMore,
  onLoadMore,
  lang,
}: {
  bets: WingoMyBet[];
  loading: boolean;
  signedIn: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  lang: 'bn' | 'en';
}) {
  const bn = lang === 'bn';
  if (!signedIn) return <Empty lang={lang} text={bn ? 'আপনার বাজি দেখতে লগইন করুন।' : 'Log in to see your bets.'} />;
  if (loading && bets.length === 0)
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5 motion-keep" />
        ))}
      </div>
    );
  if (bets.length === 0) return <Empty lang={lang} text={bn ? 'আপনি এখনও কোনো বাজি দেননি।' : 'You have not placed any bets yet.'} />;

  return (
    <div className="space-y-2">
      {bets.map((b) => {
        const won = b.status === 'WON';
        const pending = b.status === 'PENDING';
        const refunded = b.status === 'REFUNDED';
        return (
          <div key={b.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
            {b.betType === 'number' ? (
              <WingoBall n={Number(b.selection)} size={36} asBadge />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-[10px] font-black uppercase text-white/85">
                {selectionLabel(b.betType, b.selection, lang).slice(0, 3)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white/85">{selectionLabel(b.betType, b.selection, lang)}</p>
              <p className="truncate font-mono text-[10px] tabular-nums text-white/45">{b.periodNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold tabular-nums text-white/70">{formatBDT(b.betAmount)}</p>
              <p
                className={cn(
                  'text-[11px] font-extrabold uppercase tracking-wider',
                  won ? 'text-emerald-300' : pending ? 'text-amber-200' : refunded ? 'text-sky-200' : 'text-rose-300',
                )}
              >
                {pending
                  ? bn ? 'চলছে' : 'Pending'
                  : won
                    ? `+${formatBDT(b.payoutAmount)}`
                    : refunded
                      ? bn ? 'ফেরত' : 'Refunded'
                      : bn ? 'হার' : 'Lost'}
              </p>
            </div>
          </div>
        );
      })}
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? (bn ? 'লোড হচ্ছে...' : 'Loading...') : bn ? 'আরও দেখুন' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}

function Empty({ text, lang }: { text: string; lang: 'bn' | 'en' }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-10 text-center">
      <Inbox className="h-8 w-8 text-white/25" />
      <p className="mt-3 text-sm text-white/55">{text}</p>
      <p className="mt-1 text-[11px] text-white/35">{lang === 'bn' ? 'পাশা উইনগো' : 'Pasha WinGo'}</p>
    </div>
  );
}
