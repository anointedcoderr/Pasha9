// Built by Anointed Coder.
//
// Four supporting components for the public Spin tab:
//   SpinTierSelector     - tier picker card grid
//   SpinWinnersFeed      - live winners list
//   SpinHowToGetCoins    - explainer card
//   SpinTermsAccordion   - rules accordion

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Coins, Gift, Sparkles, Trophy, UserPlus, Wallet } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

// ---------- SpinTierSelector ----------

export interface SpinTierDef {
  id: string;
  key: string;
  nameEn: string;
  nameBn: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  costPerSpin: number;
  freeSpinsPerDay: number;
  color: string;
}

export function SpinTierSelector({
  tiers, selectedKey, onSelect, coinBalance, freeRemainingByTier,
}: {
  tiers: SpinTierDef[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  coinBalance: number;
  freeRemainingByTier: Record<string, number>;
}) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  if (tiers.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {tiers.map((t) => {
        const active = t.key === selectedKey;
        const insufficient = coinBalance < t.costPerSpin;
        const free = freeRemainingByTier[t.key] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.key)}
            aria-pressed={active}
            className={cn(
              'relative overflow-hidden rounded-2xl border bg-brand-paper p-3 text-left transition',
              active
                ? 'border-brand-yellow-500 shadow-[0_8px_24px_-12px_rgba(245,180,0,0.6)]'
                : 'border-brand-divider hover:border-brand-yellow-500/50',
            )}
          >
            <span
              aria-hidden
              className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-25"
              style={{ background: t.color }}
            />
            <div className="relative flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                style={{ background: t.color }}
              >
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold uppercase tracking-wider text-brand-ink">
                  {bn && t.nameBn ? t.nameBn : t.nameEn}
                </p>
                <p className="text-[10px] text-brand-inkMute">
                  {bn ? 'প্রতি স্পিন' : 'Per spin'}: <span className="font-bold text-brand-ink">{t.costPerSpin}</span> {bn ? 'কয়েন' : 'coins'}
                </p>
              </div>
            </div>
            <div className="relative mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="rounded-full border border-brand-yellow-500/40 bg-brand-yellow-500/10 px-2 py-0.5 font-bold text-brand-yellow-700">
                {bn ? `প্রতিদিন ${t.freeSpinsPerDay} ফ্রি স্পিন` : `${t.freeSpinsPerDay} free/day`}
              </span>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-700">
                {bn ? `অবশিষ্ট ${free}` : `${free} left today`}
              </span>
              {insufficient ? (
                <span className="rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 font-bold text-rose-700">
                  {bn ? 'যথেষ্ট কয়েন নেই' : 'Not enough coins'}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------- SpinWinnersFeed ----------

interface WinnerRow {
  id: string;
  maskedName: string;
  segmentLabel: string;
  payoutType: string;
  payoutAmount: number;
  tierKey: string | null;
  tierNameEn: string | null;
  tierNameBn: string | null;
  createdAt: string;
}

function formatRelative(iso: string, bn: boolean): string {
  const t = Date.now() - new Date(iso).getTime();
  const m = Math.floor(t / 60_000);
  if (m < 1) return bn ? 'এইমাত্র' : 'just now';
  if (m < 60) return bn ? `${m} মিনিট আগে` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return bn ? `${h} ঘন্টা আগে` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return bn ? `${d} দিন আগে` : `${d}d ago`;
}

export function SpinWinnersFeed({ tierKey, refreshKey }: { tierKey?: string | null; refreshKey?: number }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [winners, setWinners] = useState<WinnerRow[] | null>(null);
  const [activeTab, setActiveTab] = useState<'winners' | 'records'>('winners');

  const load = useCallback(async () => {
    const qs = tierKey ? `?tierKey=${encodeURIComponent(tierKey)}` : '';
    try {
      const r = await fetch(`/api/content/spin-winners${qs}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setWinners(Array.isArray(j?.winners) ? (j.winners as WinnerRow[]) : []);
    } catch { /* ignore */ }
  }, [tierKey]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="rounded-2xl border border-brand-divider bg-brand-paper p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-brand-yellow-700" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-ink">
            {bn ? 'বিজয়ী তালিকা' : 'Winners list'}
          </h3>
        </div>
        <div role="tablist" className="flex gap-1 text-[10px]">
          {[
            { k: 'winners' as const, en: 'Winners', bnLabel: 'বিজয়ী' },
            { k: 'records' as const, en: 'Records', bnLabel: 'রেকর্ড' },
          ].map((t) => (
            <button
              key={t.k}
              type="button"
              role="tab"
              aria-selected={activeTab === t.k}
              onClick={() => setActiveTab(t.k)}
              className={cn(
                'rounded-full border px-2.5 py-1 font-bold uppercase tracking-wider transition',
                activeTab === t.k
                  ? 'border-brand-yellow-500 bg-brand-yellow-500/15 text-brand-ink'
                  : 'border-brand-divider text-brand-inkMute hover:text-brand-ink',
              )}
            >
              {bn ? t.bnLabel : t.en}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 max-h-[260px] overflow-y-auto">
        {winners === null ? (
          <p className="py-6 text-center text-[11px] text-brand-inkMute">{bn ? 'লোড হচ্ছে...' : 'Loading...'}</p>
        ) : winners.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-brand-inkMute">
            {bn ? 'আজ এখনো কোনো বিজয়ী নেই। প্রথম জনপ্রিয় হোন!' : 'No winners yet today. Be the first!'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {winners.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-md border border-brand-divider bg-brand-surface px-2 py-1.5 text-[11px]">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/15 text-brand-yellow-700">
                  <Trophy className="h-3.5 w-3.5" />
                </span>
                <span className="grow truncate font-semibold text-brand-ink">{w.maskedName}</span>
                {w.tierNameEn ? (
                  <span className="shrink-0 rounded-full bg-brand-yellow-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-yellow-700">
                    {bn && w.tierNameBn ? w.tierNameBn : w.tierNameEn}
                  </span>
                ) : null}
                <span className="shrink-0 font-mono font-bold text-brand-ink">{w.segmentLabel}</span>
                <span className="shrink-0 text-[10px] text-brand-inkMute">{formatRelative(w.createdAt, bn)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------- SpinHowToGetCoins ----------

export function SpinHowToGetCoins() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const items = [
    {
      icon: <Wallet className="h-4 w-4" />,
      titleEn: 'Deposit ৳200 or more',
      titleBn: 'কমপক্ষে ৳২০০ ডিপোজিট',
      bodyEn: 'Every approved deposit earns coins based on the active rate. Bigger deposits land bigger coin packs.',
      bodyBn: 'প্রতিটি অনুমোদিত ডিপোজিট সক্রিয় হারে কয়েন এনে দেয়। বড় ডিপোজিটে বেশি কয়েন।',
      href: '/deposit',
      cta: bn ? 'ডিপোজিট করুন' : 'Deposit',
    },
    {
      icon: <Gift className="h-4 w-4" />,
      titleEn: 'Daily check-in',
      titleBn: 'প্রতিদিন চেক ইন',
      bodyEn: 'Visit every day to grow your streak. Day 7 unlocks a coin bonus.',
      bodyBn: 'প্রতিদিন চেক ইন করুন। সপ্তম দিনে বিশেষ বোনাস।',
      href: '/rewards',
      cta: bn ? 'চেক ইন করুন' : 'Check in',
    },
    {
      icon: <UserPlus className="h-4 w-4" />,
      titleEn: 'Invite friends',
      titleBn: 'বন্ধুদের আমন্ত্রণ জানান',
      bodyEn: 'Share your referral link. Coins arrive each time a friend joins and plays.',
      bodyBn: 'রেফারেল লিঙ্ক শেয়ার করুন। বন্ধু যোগ দিলে কয়েন পাবেন।',
      href: '/referral',
      cta: bn ? 'রেফারেল' : 'Refer',
    },
  ];
  return (
    <section className="rounded-2xl border border-brand-divider bg-brand-paper p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-brand-yellow-700" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-ink">
          {bn ? 'কয়েন কিভাবে পাবেন' : 'How to get coins'}
        </h3>
      </div>
      <ul className="mt-3 grid gap-2 md:grid-cols-3">
        {items.map((it) => (
          <li key={it.titleEn} className="rounded-xl border border-brand-divider bg-brand-surface p-3">
            <div className="flex items-center gap-2 text-brand-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-yellow-500/15 text-brand-yellow-700">{it.icon}</span>
              <p className="text-xs font-extrabold">{bn ? it.titleBn : it.titleEn}</p>
            </div>
            <p className="mt-1.5 text-[11px] text-brand-inkSoft">{bn ? it.bodyBn : it.bodyEn}</p>
            <Link href={it.href} className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wider text-brand-yellow-700 hover:text-brand-ink">
              {it.cta}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- SpinTermsAccordion ----------

export function SpinTermsAccordion() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const items = [
    {
      qEn: 'What does each spin cost?',
      qBn: 'প্রতি স্পিনের খরচ কত?',
      aEn: 'Each tier has its own per-spin cost. Lucky is the cheapest, Supreme is the highest. The cost is shown on the tier card and deducted from your coin balance when no free spin is available.',
      aBn: 'প্রতিটি স্তরের নিজস্ব স্পিন খরচ আছে। লাকি সবচেয়ে কম, সুপ্রিম সবচেয়ে বেশি। কয়েন ব্যালেন্স থেকে কাটা হবে যদি ফ্রি স্পিন না থাকে।',
    },
    {
      qEn: 'How do free spins work?',
      qBn: 'ফ্রি স্পিন কিভাবে কাজ করে?',
      aEn: 'Each tier has a daily free-spin allowance. The counter resets every 24 hours per tier. Free spins do not deduct coins but still pay out real rewards.',
      aBn: 'প্রতিটি স্তরে দৈনিক ফ্রি স্পিনের সীমা রয়েছে। ২৪ ঘন্টা পর কাউন্টার রিসেট হয়। ফ্রি স্পিনে কয়েন কাটা হয় না কিন্তু পুরস্কার একই।',
    },
    {
      qEn: 'What happens when I win a bonus reward?',
      qBn: 'বোনাস রিওয়ার্ড পেলে কী হয়?',
      aEn: 'Bonus rewards are credited to your locked balance and released once you complete the per-segment turnover requirement. The turnover multiplier is shown on the winning wedge and tracked in your bonus history.',
      aBn: 'বোনাস রিওয়ার্ড লকড ব্যালেন্সে যোগ হয় এবং প্রতি সেগমেন্টের টার্নওভার সম্পূর্ণ হলে ছাড়া হয়। টার্নওভার মাল্টিপ্লায়ার বিজয়ী অংশে দেখানো হয়।',
    },
    {
      qEn: 'How are winning wedges decided?',
      qBn: 'বিজয়ী অংশ কীভাবে নির্ধারিত হয়?',
      aEn: 'Each wedge has a weight set by the operator. The server picks a wedge using those weights at spin time. The wheel animation lands on the server-selected wedge - the visual is a presentation of the server result.',
      aBn: 'প্রতিটি অংশের একটি ওজন থাকে। সার্ভার ঐ ওজন অনুযায়ী বিজয়ী অংশ নির্বাচন করে। হুইল অ্যানিমেশন সার্ভারের নির্বাচিত অংশে গিয়ে থামে।',
    },
    {
      qEn: 'Fair play and limits',
      qBn: 'ফেয়ার প্লে ও সীমা',
      aEn: 'A 3-second cooldown applies between spins on the same tier to prevent double-credits. Spin rewards are non-transferable. The operator may pause any tier from the admin console.',
      aBn: 'একই স্তরের স্পিনের মধ্যে ৩ সেকেন্ডের কুলডাউন রয়েছে। স্পিন রিওয়ার্ড হস্তান্তরযোগ্য নয়। অ্যাডমিন যে কোনো স্তর স্থগিত করতে পারেন।',
    },
  ];
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section className="rounded-2xl border border-brand-divider bg-brand-paper p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-brand-ink">
        {bn ? 'নিয়ম ও শর্তাবলী' : 'Terms and conditions'}
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => {
          const open = openIdx === i;
          return (
            <li key={it.qEn} className="rounded-lg border border-brand-divider bg-brand-surface">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="text-xs font-bold text-brand-ink">{bn ? it.qBn : it.qEn}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-brand-inkMute transition-transform', open && 'rotate-180')} />
              </button>
              {open ? (
                <div className="border-t border-brand-divider px-3 py-2 text-[11px] text-brand-inkSoft">
                  {bn ? it.aBn : it.aEn}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
