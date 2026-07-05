// Built by Anointed Coder.
//
// The three lower tabs of the WinGo page: Game history (recent draws),
// Chart (a compact trend of the last results with big/small and colour
// tallies) and My history (the signed-in player's bets with outcome).
// Each tab has a designed empty state so a fresh mode never looks broken.

'use client';

import { useState } from 'react';
import { History, BarChart3, User, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { WingoBall } from './WingoBall';
import { colorOf, sizeOf, sizeLabel, colorDotClass, selectionLabel, type WingoColorId } from './ui';
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

// ---------- Game history ----------

function GameHistory({ results, lang }: { results: WingoResult[]; lang: 'bn' | 'en' }) {
  const bn = lang === 'bn';
  if (results.length === 0) return <Empty lang={lang} text={bn ? 'এখনও কোনো ড্র হয়নি।' : 'No draws yet.'} />;
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
        <span>{bn ? 'পিরিয়ড' : 'Period'}</span>
        <span className="text-center">{bn ? 'নম্বর' : 'Number'}</span>
        <span className="text-right">{bn ? 'বড়/ছোট' : 'Big/Small'}</span>
      </div>
      <div className="max-h-80 overflow-y-auto scrollbar-none">
        {results.map((r) => {
          const id = colorOf(r.result);
          return (
            <div key={r.periodNumber} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0">
              <span className="truncate font-mono text-xs tabular-nums text-white/70">{r.periodNumber}</span>
              <div className="flex justify-center">
                <WingoBall n={r.result} size={30} asBadge />
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', colorDotClass(id as WingoColorId))} />
                <span className="w-10 text-right text-[11px] font-bold text-white/70">{sizeLabel(sizeOf(r.result), lang)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Chart ----------

function Chart({ results, lang }: { results: WingoResult[]; lang: 'bn' | 'en' }) {
  const bn = lang === 'bn';
  if (results.length === 0) return <Empty lang={lang} text={bn ? 'চার্টের জন্য যথেষ্ট ডেটা নেই।' : 'Not enough data for a chart yet.'} />;

  // Oldest to newest for a left-to-right trend.
  const series = [...results].reverse();
  let big = 0;
  let small = 0;
  let red = 0;
  let green = 0;
  let violet = 0;
  for (const r of results) {
    if (sizeOf(r.result) === 'big') big++;
    else small++;
    const id = colorOf(r.result);
    if (id === 'red' || id === 'red_violet') red++;
    if (id === 'green' || id === 'green_violet') green++;
    if (id === 'red_violet' || id === 'green_violet') violet++;
  }
  const total = results.length;

  return (
    <div className="space-y-4">
      {/* Trend grid: each column marks the drawn digit on a 0..9 ladder. */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 scrollbar-none">
        <div className="flex min-w-max gap-2">
          {series.map((r) => (
            <div key={r.periodNumber} className="flex flex-col-reverse items-center gap-0.5" title={r.periodNumber}>
              {Array.from({ length: 10 }, (_, row) => (
                <span
                  key={row}
                  className={cn(
                    'h-3 w-3 rounded-full',
                    row === r.result ? '' : 'bg-white/10',
                  )}
                  style={row === r.result ? { background: 'radial-gradient(circle at 30% 30%, #ffe08a, #f5b400)' } : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Tallies */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tally label={bn ? 'বড়' : 'Big'} value={big} total={total} tone="amber" />
        <Tally label={bn ? 'ছোট' : 'Small'} value={small} total={total} tone="sky" />
        <Tally label={bn ? 'বেগুনি' : 'Violet'} value={violet} total={total} tone="violet" />
        <Tally label={bn ? 'লাল' : 'Red'} value={red} total={total} tone="rose" />
        <Tally label={bn ? 'সবুজ' : 'Green'} value={green} total={total} tone="emerald" />
        <Tally label={bn ? 'ড্র' : 'Draws'} value={total} total={total} tone="bone" />
      </div>
    </div>
  );
}

function Tally({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'amber' | 'sky' | 'violet' | 'rose' | 'emerald' | 'bone' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const toneCls: Record<string, string> = {
    amber: 'text-amber-200',
    sky: 'text-sky-200',
    violet: 'text-violet-200',
    rose: 'text-rose-200',
    emerald: 'text-emerald-200',
    bone: 'text-white/80',
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</p>
      <p className={cn('mt-0.5 text-lg font-black tabular-nums', toneCls[tone])}>{value}</p>
      <p className="text-[10px] text-white/40">{pct}%</p>
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
