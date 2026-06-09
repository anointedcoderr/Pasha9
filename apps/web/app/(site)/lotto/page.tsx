// Built by Anointed Coder.
//
// Public /lotto page. Phase 8C: deposit-driven 4D lottery with daily
// 7:30 PM draw, prize structure card, iBox explanation, latest winning
// numbers and (when signed in) the visitor's own ticket count, lotto
// balance and accrual progress to the next 2-ticket block.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { LottoCountdown } from '@/components/site/LottoCountdown';
import {
  LottoHeroPremium,
  LottoBallTumbler,
  LottoWinningChips,
  LottoResultMosaic,
} from '@/components/site/LottoPremium';
import { useLang } from '@/lib/i18n/context';
import {
  Ticket,
  Clock,
  Trophy,
  Zap,
  Sparkles,
  ChevronDown,
  Crown,
  Award,
  Medal,
  Wallet as WalletIcon,
} from 'lucide-react';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { LottoWinnerOfTheDay, LottoExtraPrizeGrid, LottoTabBar, type LottoTabKey } from '@/components/site/LottoSections';

interface LiveDraw {
  id: string;
  name: string;
  schedule: string | null;
  drawsAt: string | null;
  digitsCount: number;
  ticketPrice: number | string;
  prizePool: number | string;
  accent: 'yellow' | 'blue' | 'red' | 'royal';
}

interface ResultRow {
  id: string;
  drawId: string;
  drawName: string;
  drawsAt: string | null;
  winningNumber: string;
  publishedAt: string;
  totalWinners: number;
  totalPaid: number;
  ticketBaseValue: number;
  prize1xMult: number;
  // M4 Phase F: optional Babu88-style display blob.
  extraNumbers?: {
    second?: string | null;
    third?: string | null;
    specials?: string[];
    consolations?: string[];
  } | null;
}

type ResultRange = 'all' | 'yesterday' | '7d' | '30d';

interface MeResponse {
  rules: { ticketsPerBlock: number; blockAmount: number; digits: number; drawTimeLabel: string };
  progress: { totalApprovedDeposits: number; earnedTickets: number; toNextBlock: number; blockAmount: number; ticketsPerBlock: number };
  lottoBalance: number;
  summary: { ticketCount: number; wonCount: number; winningCount: number };
  tickets: { id: string; number: string; status: string; generatedAt: string; draw: { id: string; name: string; drawsAt: string | null } | null }[];
  winnings: { id: string; ticketNumber: string; prizeTier: string; amount: number; status: string; createdAt: string; winningNumber: string; publishedAt: string }[];
}

const DEFAULT_PRIZE_TABLE = [
  { tier: 'first', labelEn: '1st Prize', labelBn: '১ম পুরস্কার', multiplier: 2000, icon: Crown, accent: 'from-amber-300 via-amber-500 to-orange-600' },
  { tier: 'second', labelEn: '2nd Prize', labelBn: '২য় পুরস্কার', multiplier: 800, icon: Trophy, accent: 'from-amber-200 via-amber-400 to-amber-600' },
  { tier: 'third', labelEn: '3rd Prize', labelBn: '৩য় পুরস্কার', multiplier: 300, icon: Award, accent: 'from-slate-300 via-slate-400 to-slate-600' },
  { tier: 'special', labelEn: 'Special Prize', labelBn: 'বিশেষ পুরস্কার', multiplier: 150, icon: Sparkles, accent: 'from-fuchsia-400 via-purple-500 to-indigo-700' },
  { tier: 'consolation', labelEn: 'Consolation Prize', labelBn: 'সান্ত্বনা পুরস্কার', multiplier: 30, icon: Medal, accent: 'from-emerald-300 via-emerald-500 to-teal-700' },
] as const;

const FAQ_ITEMS = [
  {
    qEn: 'What is the Pasha 9 4D Lottery?',
    qBn: 'পাশা ৯ 4D লটারি কী?',
    aEn: 'A daily 4-digit lottery drawn every evening at 7:30 PM. Each ticket holds a random 4-digit number; if the draw matches, the ticket wins.',
    aBn: 'প্রতিদিন সন্ধ্যা ৭:৩০ টায় ড্র হয় এমন একটি ৪-অঙ্কের লটারি। প্রতিটি টিকেটে একটি র‍্যান্ডম ৪-অঙ্কের নম্বর থাকে; ড্রয়ের সাথে মিললে টিকেট জিতে যায়।',
  },
  {
    qEn: 'How do I receive tickets?',
    qBn: 'আমি কীভাবে টিকেট পাই?',
    aEn: 'Tickets are generated automatically when an admin approves your deposit. Every accumulated BDT 1,200 of approved deposits earns you 2 tickets. There is no manual ticket purchase.',
    aBn: 'অ্যাডমিন ডিপোজিট অনুমোদন করলেই টিকেট স্বয়ংক্রিয়ভাবে তৈরি হয়। অনুমোদিত মোট প্রতি ১,২০০ টাকায় ২টি টিকেট পাবেন। ম্যানুয়াল কেনার সুযোগ নেই।',
  },
  {
    qEn: 'How does the iBox / permutation system work?',
    qBn: 'iBox / পারমুটেশন সিস্টেম কীভাবে কাজ করে?',
    aEn: 'If your ticket matches the winning number in any order, it wins under iBox. For numbers with all-different digits like 1234, the prize is split across 24 unique permutations. For identical digits like 1111, only one permutation exists, so the full prize is paid.',
    aBn: 'টিকেটের অঙ্কগুলো যেকোনো ক্রমে মিললে iBox-এ জিতবে। ১২৩৪ এর মতো ভিন্ন অঙ্কে পুরস্কার ২৪টি ইউনিক পারমুটেশনে ভাগ হয়। ১১১১ এর মতো এক অঙ্কে শুধু একটিই পারমুটেশন থাকে, তাই পুরো পুরস্কার দেওয়া হয়।',
  },
  {
    qEn: 'What is the prize structure?',
    qBn: 'পুরস্কার কাঠামো কী?',
    aEn: '1st Prize 2000x, 2nd Prize 800x, 3rd Prize 300x, Special Prize 150x, Consolation Prize 30x of the ticket base value (typically BDT 20).',
    aBn: 'টিকেট বেস ভ্যালুর (সাধারণত ২০ টাকা) ১ম ২০০০x, ২য় ৮০০x, ৩য় ৩০০x, বিশেষ ১৫০x, সান্ত্বনা ৩০x।',
  },
  {
    qEn: 'When is the draw?',
    qBn: 'ড্র কখন হয়?',
    aEn: 'Every day at 7:30 PM Bangladesh time. The winning number is published on this page once the admin settles the draw.',
    aBn: 'প্রতিদিন সন্ধ্যা ৭:৩০ টা (বাংলাদেশ সময়)। অ্যাডমিন ড্র সেটল করার সাথে সাথে এই পেজে জয়ী নম্বর প্রকাশিত হয়।',
  },
  {
    qEn: 'How do I receive winnings?',
    qBn: 'জিতলে কীভাবে পাব?',
    aEn: 'Winnings are credited automatically to your Lotto Balance the moment the admin publishes the result. Lotto Balance withdrawal pipeline ships in Milestone 2.',
    aBn: 'অ্যাডমিন ফলাফল প্রকাশ করার সাথে সাথে জয়ী অর্থ স্বয়ংক্রিয়ভাবে আপনার লটো ব্যালেন্সে যোগ হয়। লটো ব্যালেন্স উইথড্র Milestone 2 এ আসবে।',
  },
  {
    qEn: 'Is there a ticket limit?',
    qBn: 'টিকেটের সীমা আছে?',
    aEn: 'No hard cap. Higher accumulated approved deposits generate proportionally more tickets at the 2-per-1,200 rate.',
    aBn: 'কোনো নির্দিষ্ট সীমা নেই। বেশি অনুমোদিত ডিপোজিট হলে প্রতি ১,২০০ টাকার জন্য ২টি হারে আরও টিকেট তৈরি হবে।',
  },
];

const GRAD: Record<LiveDraw['accent'], string> = {
  yellow: 'from-brand-yellow-400 via-amber-500 to-orange-500',
  blue: 'from-brand-blue-500 via-brand-blue-600 to-brand-blue-700',
  red: 'from-rose-500 via-red-600 to-orange-600',
  royal: 'from-fuchsia-500 via-indigo-600 to-indigo-800',
};

export default function LottoPage() {
  const { lang } = useLang();
  const [draws, setDraws] = useState<LiveDraw[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [resultRange, setResultRange] = useState<ResultRange>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeTab, setActiveTab] = useState<LottoTabKey>('latest');

  useEffect(() => {
    let alive = true;
    fetch('/api/content/lotto')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const live = Array.isArray(data?.draws) ? (data.draws as LiveDraw[]) : [];
        if (alive) setDraws(live);
      })
      .catch(() => {});
    const params = new URLSearchParams();
    if (resultRange !== 'all') params.set('range', resultRange);
    if (customFrom) params.set('from', customFrom);
    if (customTo) params.set('to', customTo);
    params.set('take', '30');
    fetch(`/api/content/lotto/results?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.results) setResults(data.results as ResultRow[]);
      })
      .catch(() => {});
    fetch('/api/lotto/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && !data.code) setMe(data as MeResponse);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [resultRange, customFrom, customTo]);

  const featured = draws[0];

  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'লটো' : 'Lotto'} />

      <LottoHeroPremium
        jackpot={Number(featured?.prizePool ?? 0)}
        ticketBase={Number(featured?.ticketPrice ?? 20)}
        drawsAt={featured?.drawsAt ?? null}
        schedule={featured?.schedule ?? null}
      >
        {me ? (
          <LottoSelfStrip me={me} lang={lang} />
        ) : (
          <LottoLockedCta lang={lang} />
        )}
      </LottoHeroPremium>

      {/* Winner of the Day + tab navigator. The WOTD card is the
          opening visual for every visit; the tab bar lets the visitor
          drill into Latest Results, My Tickets, My Winnings without
          extra navigation. */}
      <LottoWinnerOfTheDay result={results[0] ?? null} lang={lang} />

      {results[0]?.extraNumbers?.specials && results[0].extraNumbers.specials.length > 0 ? (
        <LottoExtraPrizeGrid
          titleEn="Special Prize"
          titleBn="বিশেষ পুরস্কার"
          numbers={results[0].extraNumbers.specials}
          multiplier={150}
          accent="special"
          lang={lang}
        />
      ) : null}

      {results[0]?.extraNumbers?.consolations && results[0].extraNumbers.consolations.length > 0 ? (
        <LottoExtraPrizeGrid
          titleEn="Consolation Prize"
          titleBn="সান্ত্বনা পুরস্কার"
          numbers={results[0].extraNumbers.consolations}
          multiplier={30}
          accent="consolation"
          lang={lang}
        />
      ) : null}

      <LottoTabBar
        active={activeTab}
        onChange={setActiveTab}
        counts={{ tickets: me?.summary.ticketCount ?? 0, winnings: me?.summary.winningCount ?? 0 }}
        lang={lang}
        signedIn={Boolean(me)}
      />

      {/* My Tickets quick view */}
      {activeTab === 'tickets' && me ? (
        <section className="rounded-2xl border border-brand-divider bg-brand-paper p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-brand-ink">
            {lang === 'bn' ? 'আমার সক্রিয় টিকেট' : 'My active tickets'}
          </h3>
          {me.tickets.length === 0 ? (
            <p className="text-[11px] text-brand-inkMute">
              {lang === 'bn' ? 'এই মুহূর্তে কোনো টিকেট নেই। ১,২০০ টাকা ডিপোজিট অনুমোদন হলে ২টি টিকেট পাবেন।' : 'No tickets yet. Every accumulated 1,200 BDT of approved deposits earns you 2 tickets.'}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {me.tickets.slice(0, 12).map((tk) => (
                <li key={tk.id} className="rounded-lg border border-brand-divider bg-brand-surface p-2 text-center">
                  <p className="font-mono text-lg font-extrabold tabular-nums text-brand-ink">{tk.number}</p>
                  <p className="mt-0.5 text-[10px] text-brand-inkMute">{tk.draw?.name ?? (lang === 'bn' ? 'অপেক্ষমান' : 'Pending')}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-right">
            <Link href="/lotto/my-tickets" className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-700 hover:text-brand-ink">
              {lang === 'bn' ? 'সব টিকেট দেখুন' : 'View all tickets'}
            </Link>
          </p>
        </section>
      ) : null}

      {/* My Winnings quick view */}
      {activeTab === 'winnings' && me ? (
        <section className="rounded-2xl border border-brand-divider bg-brand-paper p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-brand-ink">
            {lang === 'bn' ? 'আমার পুরস্কার' : 'My winnings'}
          </h3>
          {me.winnings.length === 0 ? (
            <p className="text-[11px] text-brand-inkMute">
              {lang === 'bn' ? 'এখনও কোনো পুরস্কার নেই। শুভকামনা!' : 'No winnings yet. Good luck on the next draw!'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {me.winnings.slice(0, 8).map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-md border border-brand-divider bg-brand-surface px-2 py-1.5 text-[11px]">
                  <span className="font-mono font-bold text-brand-ink">{w.ticketNumber}</span>
                  <span className="rounded-full bg-brand-yellow-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-yellow-700">{w.prizeTier}</span>
                  <span className="ml-auto font-extrabold tabular-nums text-brand-ink">{formatBDT(Number(w.amount))}</span>
                  <span className="text-[10px] text-brand-inkMute">{formatDateTime(w.publishedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-right">
            <Link href="/lotto/my-winnings" className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-700 hover:text-brand-ink">
              {lang === 'bn' ? 'সব পুরস্কার দেখুন' : 'View all winnings'}
            </Link>
          </p>
        </section>
      ) : null}

      {/* Latest results (only visible when the matching tab is active
          or when no specific tab is chosen) */}
      <section className={cn(activeTab === 'wotd' && 'hidden')}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brand-yellow-600" />
            <h3 className="text-base font-extrabold text-brand-ink md:text-lg">
              {lang === 'bn' ? 'ফলাফলের ইতিহাস' : 'Result history'}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'all', en: 'All', bn: 'সব' },
                { key: 'yesterday', en: 'Yesterday', bn: 'গতকাল' },
                { key: '7d', en: '7 days', bn: '৭ দিন' },
                { key: '30d', en: '30 days', bn: '৩০ দিন' },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => { setResultRange(r.key as ResultRange); setCustomFrom(''); setCustomTo(''); }}
                  className="pill-provider"
                  data-active={resultRange === r.key && !customFrom && !customTo}
                >
                  {lang === 'bn' ? r.bn : r.en}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setResultRange('all'); }}
                className="h-8 rounded-lg border border-brand-divider bg-brand-paper px-2 text-xs text-brand-ink"
              />
              <span className="text-[10px] text-brand-inkMute">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setResultRange('all'); }}
                className="h-8 rounded-lg border border-brand-divider bg-brand-paper px-2 text-xs text-brand-ink"
              />
            </div>
            <Link
              href="/lotto/my-tickets"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-2 text-[11px] font-bold text-brand-ink hover:border-brand-yellow-500"
            >
              <Ticket className="h-3 w-3" /> {lang === 'bn' ? 'আমার টিকিট' : 'My tickets'}
            </Link>
            <Link
              href="/lotto/my-winnings"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-2 text-[11px] font-bold text-brand-ink hover:border-brand-yellow-500"
            >
              <Trophy className="h-3 w-3" /> {lang === 'bn' ? 'আমার জয়' : 'My winnings'}
            </Link>
          </div>
        </div>
        {/* Featured latest result: full ball-tumbler reveal + extras
            rendered as premium enamel chips. */}
        {results[0] ? (
          <div className="mb-4 rounded-2xl border border-amber-400/25 p-5" style={{ background: 'var(--pa-grad-mahogany)' }}>
            <p className="pa-display pa-gold-text text-center text-[11px] font-black uppercase tracking-[0.32em]">
              {lang === 'bn' ? 'সর্বশেষ ফলাফল' : 'Latest result'}
            </p>
            <p className="text-center text-[10px] text-amber-200/65">
              {results[0].drawName} . {formatDateTime(results[0].publishedAt, lang)}
            </p>
            <div className="mt-4 flex justify-center">
              <LottoBallTumbler number={results[0].winningNumber} />
            </div>
            <p className="mt-3 text-center text-[11px] text-amber-100/80">
              {results[0].totalWinners} {lang === 'bn' ? 'বিজয়ী' : 'winner(s)'} . {formatBDT(results[0].totalPaid)} {lang === 'bn' ? 'পরিশোধিত' : 'paid'}
            </p>
          </div>
        ) : null}

        {/* Result history calendar mosaic */}
        <LottoResultMosaic
          results={results.slice(0, 30).map((r) => ({
            id: r.id,
            drawsAt: r.drawsAt,
            publishedAt: r.publishedAt,
            winningNumber: r.winningNumber,
            totalWinners: r.totalWinners,
            totalPaid: r.totalPaid,
          }))}
        />
      </section>

      {/* Prize structure */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Crown className="h-4 w-4 text-brand-yellow-600" />
          <h3 className="text-base font-extrabold text-brand-ink md:text-lg">
            {lang === 'bn' ? 'পুরস্কার কাঠামো' : 'Prize structure'}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DEFAULT_PRIZE_TABLE.map((row) => {
            const Icon = row.icon;
            return (
              <article key={row.tier} className="card-light overflow-hidden">
                <div className={cn('flex items-center gap-2 bg-gradient-to-br p-3 text-white', row.accent)}>
                  <Icon className="h-4 w-4" />
                  <p className="text-[11px] font-bold uppercase tracking-wider">
                    {lang === 'bn' ? row.labelBn : row.labelEn}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-2xl font-extrabold text-brand-ink">{row.multiplier}x</p>
                  <p className="mt-0.5 text-[11px] text-brand-inkMute">
                    {lang === 'bn' ? 'টিকেট মূল্যের গুণিতক' : 'of ticket base value'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-brand-inkMute">
          {lang === 'bn'
            ? 'টিকেটের বেস ভ্যালু ২০ টাকা ধরে ১ম পুরস্কার = ৪০,০০০ টাকা। বেস ভ্যালু অ্যাডমিন প্যানেল থেকে পরিবর্তনযোগ্য।'
            : 'At BDT 20 base value, the 1st prize is BDT 40,000. The base value is configurable from the admin panel.'}
        </p>
      </section>

      {/* iBox explanation */}
      <section className="card-light p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue-500/15 text-brand-blue-600">
            <Zap className="h-5 w-5" />
          </span>
          <div className="flex-1 space-y-3">
            <h3 className="text-base font-extrabold text-brand-ink md:text-lg">
              {lang === 'bn' ? 'iBox / পারমুটেশন সিস্টেম' : 'iBox / permutation system'}
            </h3>
            <p className="text-sm leading-relaxed text-brand-inkSoft">
              {lang === 'bn'
                ? 'আপনার টিকেট জয়ী নম্বরের সাথে যেকোনো ক্রমে মিললে iBox এর অধীনে জিতবে। তবে পুরস্কারের পরিমাণ ইউনিক পারমুটেশন সংখ্যার উপর নির্ভর করে।'
                : 'If your ticket matches the winning number in any order, it wins under iBox. The prize amount depends on how many unique permutations the number has.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-divider bg-brand-surface p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
                  {lang === 'bn' ? 'উদাহরণ' : 'Example'} · 1234
                </p>
                <p className="mt-1 text-sm font-semibold text-brand-ink">
                  {lang === 'bn' ? '২৪টি ইউনিক পারমুটেশন' : '24 unique permutations'}
                </p>
                <p className="mt-1 text-xs text-brand-inkSoft">
                  {lang === 'bn'
                    ? 'এক্স্যাক্ট ম্যাচ পুরো পুরস্কার পাবে। যেকোনো অন্য পারমুটেশন (যেমন 4321) পুরস্কারের ১/২৪ পাবে।'
                    : 'Exact match wins the full prize. Any other permutation (e.g. 4321) wins 1/24 of the prize.'}
                </p>
              </div>
              <div className="rounded-xl border border-brand-divider bg-brand-surface p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
                  {lang === 'bn' ? 'উদাহরণ' : 'Example'} · 1111
                </p>
                <p className="mt-1 text-sm font-semibold text-brand-ink">
                  {lang === 'bn' ? '১টি ইউনিক পারমুটেশন' : '1 unique permutation'}
                </p>
                <p className="mt-1 text-xs text-brand-inkSoft">
                  {lang === 'bn'
                    ? 'শুধুমাত্র 1111 মিলে। এই ক্ষেত্রে পুরো পুরস্কার দেওয়া হয়।'
                    : 'Only 1111 matches. The full prize is awarded in this case.'}
                </p>
              </div>
            </div>
            <p className="text-xs text-brand-inkMute">
              {lang === 'bn'
                ? 'M1 এ ১ম পুরস্কার (এক্স্যাক্ট + iBox) সেটেল হয়। ২য়/৩য়/বিশেষ/সান্ত্বনা অটোমেশন Milestone 2 এ আসবে।'
                : 'M1 settles the 1st prize (exact + iBox). 2nd / 3rd / Special / Consolation automation ships in Milestone 2.'}
            </p>
          </div>
        </div>
      </section>

      {/* Active draws */}
      {draws.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Ticket className="h-4 w-4 text-brand-yellow-600" />
            <h3 className="text-base font-extrabold text-brand-ink md:text-lg">
              {lang === 'bn' ? 'চলমান ড্র' : 'Active draws'}
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {draws.map((d) => (
              <article key={d.id} className={cn('relative overflow-hidden rounded-2xl text-white bg-gradient-to-br', GRAD[d.accent])}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
                <div className="relative px-5 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/85">{d.schedule}</p>
                  <h4 className="mt-1 text-xl font-extrabold leading-tight md:text-2xl">{d.name}</h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <Cell label={lang === 'bn' ? 'প্রাইজ পুল' : 'Prize Pool'} value={formatBDT(Number(d.prizePool), { compact: true })} />
                    <Cell label={lang === 'bn' ? 'টিকেট বেস' : 'Ticket base'} value={formatBDT(Number(d.ticketPrice))} />
                  </div>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/85">
                    <Clock className="h-3 w-3" />
                    {lang === 'bn' ? 'ড্র সময়' : 'Draw time'}: {d.drawsAt ? formatDateTime(d.drawsAt, lang) : (lang === 'bn' ? 'প্রতিদিন ৭:৩০ পিএম' : 'Daily 7:30 PM')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-yellow-600" />
          <h3 className="text-base font-extrabold text-brand-ink md:text-lg">
            {lang === 'bn' ? 'লটারি নিয়মাবলী এবং প্রশ্ন' : 'Lottery Rules & FAQ'}
          </h3>
        </div>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className="card-light overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-brand-surface"
                >
                  <span className="text-sm font-bold text-brand-ink md:text-base">
                    {lang === 'bn' ? item.qBn : item.qEn}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-brand-inkMute transition-transform',
                      isOpen && 'rotate-180 text-brand-ink',
                    )}
                  />
                </button>
                {isOpen ? (
                  <div className="border-t border-brand-divider bg-brand-surface px-4 py-3.5 text-sm leading-relaxed text-brand-inkSoft">
                    {lang === 'bn' ? item.aBn : item.aEn}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-2.5 py-2 backdrop-blur">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/75">{label}</dt>
      <dd className="mt-0.5 font-extrabold text-white tabular-nums">{value}</dd>
    </div>
  );
}

function LottoLockedCta({ lang }: { lang: 'bn' | 'en' }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300">
        {lang === 'bn' ? 'টিকেট পেতে' : 'How to earn tickets'}
      </p>
      <p className="mt-1.5 text-sm leading-snug text-white/85">
        {lang === 'bn'
          ? 'লগইন করুন। অ্যাডমিন অনুমোদিত প্রতি ১,২০০ টাকার ডিপোজিটে ২টি টিকেট পাবেন।'
          : 'Log in. Every BDT 1,200 of admin-approved deposits earns you 2 tickets.'}
      </p>
      <div className="mt-3 flex gap-2">
        <Link href="/?signup=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-sm">
          {lang === 'bn' ? 'রেজিস্টার' : 'Register'}
        </Link>
        <Link href="/?login=1" className="inline-flex h-10 items-center rounded-lg border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15">
          {lang === 'bn' ? 'লগইন' : 'Log in'}
        </Link>
      </div>
    </div>
  );
}

function LottoSelfStrip({ me, lang }: { me: MeResponse; lang: 'bn' | 'en' }) {
  const progressPct = me.progress.blockAmount > 0
    ? Math.min(100, Math.round(((me.progress.blockAmount - me.progress.toNextBlock) / me.progress.blockAmount) * 100))
    : 0;
  return (
    <div className="grid gap-2 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur sm:grid-cols-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          {lang === 'bn' ? 'আপনার টিকেট' : 'Your tickets'}
        </p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-white">{me.summary.ticketCount}</p>
        <p className="text-[11px] text-white/55">
          {lang === 'bn' ? `${me.summary.wonCount} জয়ী` : `${me.summary.wonCount} won`}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          {lang === 'bn' ? 'লটো ব্যালেন্স' : 'Lotto balance'}
        </p>
        <p className="mt-1 inline-flex items-baseline gap-1 text-xl font-extrabold tabular-nums text-brand-yellow-300">
          <WalletIcon className="h-4 w-4 text-brand-yellow-300" />
          {formatBDT(me.lottoBalance)}
        </p>
        <p className="text-[11px] text-white/55">
          {lang === 'bn' ? `${me.summary.winningCount} জয়ের রেকর্ড` : `${me.summary.winningCount} winning record(s)`}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          {lang === 'bn' ? 'পরবর্তী টিকেট ব্লক' : 'Next ticket block'}
        </p>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-brand-yellow-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-white/70">
          {lang === 'bn'
            ? `আর ${formatBDT(me.progress.toNextBlock)} ডিপোজিট করুন, ২টি টিকেট পাবেন`
            : `Deposit ${formatBDT(me.progress.toNextBlock)} more to earn 2 tickets`}
        </p>
      </div>
    </div>
  );
}
