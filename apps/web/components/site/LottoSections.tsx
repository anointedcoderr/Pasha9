// Built by Anointed Coder.
//
// Three Lotto presentation components shared by /lotto.
//   LottoWinnerOfTheDay  - 1st/2nd/3rd prize cards from a single result
//   LottoExtraPrizeGrid  - tiled grid for specials or consolations
//   LottoTabBar          - 4-tab navigator above the lotto sections

'use client';

import { Crown, Trophy, Award, Sparkles, Medal } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface LottoResultLike {
  winningNumber: string;
  drawName: string;
  drawsAt: string | null;
  publishedAt: string;
  ticketBaseValue: number;
  prize1xMult: number;
  extraNumbers?: {
    second?: string | null;
    third?: string | null;
    specials?: string[];
    consolations?: string[];
  } | null;
}

function DigitBoxes({ value, accent }: { value: string; accent: string }) {
  const chars = (value || '').padStart(4, '0').slice(-4).split('');
  return (
    <div className="mt-1 flex justify-center gap-1">
      {chars.map((c, i) => (
        <span
          key={`${value}-${i}`}
          className={cn(
            'flex h-10 w-9 items-center justify-center rounded-md border border-white/15 bg-gradient-to-b text-base font-extrabold tabular-nums text-white shadow-inner sm:h-12 sm:w-11 sm:text-lg',
            accent,
          )}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function LottoWinnerOfTheDay({ result, lang }: { result: LottoResultLike | null; lang: 'en' | 'bn' }) {
  const bn = lang === 'bn';
  const second = result?.extraNumbers?.second ?? null;
  const third = result?.extraNumbers?.third ?? null;
  const empty = !result;

  const cards = [
    {
      labelEn: '1st Prize',
      labelBn: '১ম পুরস্কার',
      number: result?.winningNumber ?? null,
      multiplier: result?.prize1xMult ?? 2000,
      Icon: Crown,
      accent: 'from-amber-400 to-amber-700',
      ring: 'ring-amber-400/60',
    },
    {
      labelEn: '2nd Prize',
      labelBn: '২য় পুরস্কার',
      number: second,
      multiplier: 800,
      Icon: Trophy,
      accent: 'from-slate-300 to-slate-600',
      ring: 'ring-slate-300/40',
    },
    {
      labelEn: '3rd Prize',
      labelBn: '৩য় পুরস্কার',
      number: third,
      multiplier: 300,
      Icon: Award,
      accent: 'from-orange-400 to-orange-700',
      ring: 'ring-orange-400/40',
    },
  ];

  return (
    <section className="rounded-2xl border border-brand-divider bg-gradient-to-b from-[#1a1107] to-[#0f0a05] p-4 text-amber-100 shadow-[inset_0_1px_0_rgba(255,200,90,0.18)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <h2 className="text-base font-extrabold uppercase tracking-wider text-amber-200">
            {bn ? 'দিনের বিজয়ী' : 'Winner of the Day'}
          </h2>
        </div>
        {result?.drawName ? (
          <p className="text-[10px] uppercase tracking-wider text-amber-200/70">{result.drawName}</p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.labelEn} className={cn('rounded-xl border border-white/10 bg-black/40 p-3 text-center ring-1', c.ring)}>
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
              <c.Icon className="h-3.5 w-3.5" />
              <span>{bn ? c.labelBn : c.labelEn}</span>
            </div>
            {c.number ? (
              <DigitBoxes value={c.number} accent={c.accent} />
            ) : (
              <div className="mt-2 flex justify-center gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="flex h-10 w-9 items-center justify-center rounded-md border border-white/10 bg-black/60 text-base font-extrabold text-white/30 sm:h-12 sm:w-11">
                    -
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] text-amber-200/70">
              {bn ? `গুণিতক ${c.multiplier}x` : `${c.multiplier}x multiplier`}
            </p>
          </div>
        ))}
      </div>

      {empty ? (
        <p className="mt-3 text-center text-[11px] text-amber-200/70">
          {bn ? 'ফলাফল ঘোষণার অপেক্ষা করুন।' : 'Awaiting the next draw result.'}
        </p>
      ) : null}
    </section>
  );
}

export function LottoExtraPrizeGrid({
  titleEn, titleBn, numbers, multiplier, accent, lang,
}: {
  titleEn: string;
  titleBn: string;
  numbers: string[];
  multiplier: number;
  accent: 'special' | 'consolation';
  lang: 'en' | 'bn';
}) {
  const bn = lang === 'bn';
  const accentClasses = accent === 'special'
    ? 'from-fuchsia-500 to-purple-800'
    : 'from-emerald-500 to-teal-800';
  return (
    <section className="rounded-2xl border border-brand-divider bg-brand-paper p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-brand-yellow-700" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-ink">
            {bn ? titleBn : titleEn}
          </h3>
        </div>
        <span className="text-[10px] text-brand-inkMute">{bn ? `গুণিতক ${multiplier}x` : `${multiplier}x multiplier`}</span>
      </div>
      {numbers.length === 0 ? (
        <p className="mt-2 text-[11px] text-brand-inkMute">
          {bn ? 'এই ড্রয়ের জন্য কোনো সংখ্যা প্রকাশ করা হয়নি।' : 'No numbers published for this draw yet.'}
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {numbers.map((n, i) => (
            <div key={`${n}-${i}`} className="rounded-lg border border-brand-divider bg-brand-surface p-2">
              <DigitBoxes value={n} accent={accentClasses} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export type LottoTabKey = 'latest' | 'wotd' | 'tickets' | 'winnings';

export function LottoTabBar({
  active, onChange, counts, lang, signedIn,
}: {
  active: LottoTabKey;
  onChange: (k: LottoTabKey) => void;
  counts?: { tickets?: number; winnings?: number };
  lang: 'en' | 'bn';
  signedIn: boolean;
}) {
  const bn = lang === 'bn';
  const items: Array<{ key: LottoTabKey; en: string; bn: string; locked?: boolean; badge?: number }> = [
    { key: 'latest', en: 'Latest Results', bn: 'সর্বশেষ ফলাফল' },
    { key: 'wotd', en: 'Winner of the Day', bn: 'দিনের বিজয়ী' },
    { key: 'tickets', en: 'My Tickets', bn: 'আমার টিকেট', locked: !signedIn, badge: counts?.tickets },
    { key: 'winnings', en: 'My Winnings', bn: 'আমার পুরস্কার', locked: !signedIn, badge: counts?.winnings },
  ];
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-2xl border border-brand-divider bg-brand-paper p-1 shadow-sm">
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(it.key)}
            disabled={it.locked}
            className={cn(
              'inline-flex h-10 grow basis-32 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-extrabold uppercase tracking-wider transition',
              isActive
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]'
                : 'text-brand-inkSoft hover:bg-brand-surface hover:text-brand-ink',
              it.locked && 'opacity-50',
            )}
          >
            <span>{bn ? it.bn : it.en}</span>
            {typeof it.badge === 'number' && it.badge > 0 ? (
              <span className="rounded-full bg-brand-ink px-1.5 py-0.5 text-[10px] text-white">{it.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
