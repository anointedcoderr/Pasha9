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
}

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

  useEffect(() => {
    let alive = true;
    fetch('/api/content/lotto')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const live = Array.isArray(data?.draws) ? (data.draws as LiveDraw[]) : [];
        if (alive) setDraws(live);
      })
      .catch(() => {});
    fetch('/api/content/lotto/results')
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
  }, []);

  const featured = draws[0];

  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'লটো' : 'Lotto'} />

      <CategoryHero
        kicker={lang === 'bn' ? '4D লটারি' : '4D Lottery'}
        title={lang === 'bn' ? 'পাশা ৯ ডেইলি 4D লটারি' : 'Pasha 9 Daily 4D Lottery'}
        description={
          lang === 'bn'
            ? 'প্রতিদিন সন্ধ্যা ৭:৩০ টায় ড্র। ডিপোজিট থেকে টিকেট জেনারেট হয়।'
            : 'Draws every day at 7:30 PM BST. Tickets are earned automatically from approved deposits.'
        }
        accent="yellow"
        category="lotto"
        chips={[
          { label: 'Daily', tone: 'gold' },
          { label: '4D Draw', tone: 'rose' },
          { label: 'Deposit Earn', tone: 'sky' },
        ]}
      />

      {/* Top strip: next draw + draw timing */}
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0F1115_0%,#1A1D24_60%,#0F1115_100%)] p-5 text-white shadow-[0_10px_30px_-18px_rgba(15,17,21,0.7)]">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand-yellow-500/30 blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300">
              <Clock className="h-3 w-3" /> {lang === 'bn' ? 'দৈনিক ড্র' : 'Daily Draw'}
            </span>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight md:text-3xl">
              {lang === 'bn' ? 'প্রতিদিন সন্ধ্যা ৭:৩০ টায়' : 'Every day at 7:30 PM BST'}
            </h2>
            <p className="mt-1 text-sm text-white/75">
              {featured?.drawsAt
                ? lang === 'bn'
                  ? `পরবর্তী ড্র: ${formatDateTime(featured.drawsAt, lang)}`
                  : `Next draw: ${formatDateTime(featured.drawsAt, lang)}`
                : lang === 'bn'
                  ? 'পরবর্তী ড্রের জন্য পেজে চোখ রাখুন।'
                  : 'Watch this page for the next draw window.'}
            </p>
          </div>
          {me ? (
            <LottoSelfStrip me={me} lang={lang} />
          ) : (
            <LottoLockedCta lang={lang} />
          )}
        </div>
      </section>

      {/* Latest results */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-brand-yellow-600" />
          <h3 className="text-base font-extrabold text-brand-ink md:text-lg">
            {lang === 'bn' ? 'সর্বশেষ ফলাফল' : 'Latest results'}
          </h3>
        </div>
        {results.length === 0 ? (
          <div className="card-light flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow-500/15 text-brand-yellow-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-sm text-brand-inkSoft">
              {lang === 'bn'
                ? 'প্রথম ফলাফলের জন্য অপেক্ষা করুন - প্রকাশের সাথে সাথে এখানে দেখা যাবে।'
                : 'No results yet - the first winning number will appear here as soon as it is published.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {results.slice(0, 6).map((r) => (
              <article key={r.id} className="card-light overflow-hidden">
                <div className="bg-[linear-gradient(135deg,#15171C_0%,#0F1115_100%)] p-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">{r.drawName}</p>
                  <div className="mt-2 flex justify-center gap-2">
                    {r.winningNumber.split('').map((d, i) => (
                      <span key={i} className="flex h-12 w-10 items-center justify-center rounded-lg bg-brand-yellow-500 text-xl font-extrabold text-brand-ink">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[11px] text-brand-inkMute">{formatDateTime(r.publishedAt, lang)}</p>
                  <p className="mt-1 text-sm text-brand-inkSoft">
                    {r.totalWinners} {lang === 'bn' ? 'বিজয়ী' : 'winner(s)'} · {formatBDT(r.totalPaid)} {lang === 'bn' ? 'পরিশোধিত' : 'paid'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
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
