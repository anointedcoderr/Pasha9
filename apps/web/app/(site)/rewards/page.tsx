// Built by Anointed Coder.
//
// /rewards - Reward Store + Daily Check-in + Spin Wheel.
//
// The Store renders admin-uploaded imageUrl / bannerUrl, real coin
// balance from /api/rewards/me, and dispatches a claim flow that
// branches on item.rewardType (recharge | physical | digital).
// Check-in claims through /api/rewards/check-in; spins through
// /api/rewards/spin. Coin shortages surface a localised error.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Trophy, Gift, Calendar, Disc, Check, AlertCircle, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { SpinWheel, type SpinWheelSegment } from '@/components/site/SpinWheel';
import { SpinTierSelector, SpinWinnersFeed, SpinHowToGetCoins, SpinTermsAccordion, type SpinTierDef } from '@/components/site/SpinSections';
import { SpinResultModal } from '@/components/site/SpinResultModal';

type Tab = 'store' | 'checkin' | 'spin';
type RewardType = 'recharge' | 'physical' | 'digital';
type Operator = 'gp' | 'robi' | 'bl' | 'airtel' | 'teletalk';

interface PublicRewardItem {
  id: string;
  title: string;
  titleBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  cost: number;
  rewardType: RewardType;
  imageUrl: string | null;
  bannerUrl: string | null;
  shortInstructionEn: string | null;
  shortInstructionBn: string | null;
}

interface CheckInConfig {
  enabled: boolean;
  autoCheckIn: boolean;
  titleEn: string; titleBn: string;
  bodyEn: string; bodyBn: string;
  dailyCoins: number;
  streakBonusDay7: number;
  insufficientCoinsTextEn: string;
  insufficientCoinsTextBn: string;
}

interface SpinConfig {
  enabled: boolean;
  titleEn: string; titleBn: string;
  costPerSpinCoins: number;
  freeSpinsPerDay: number;
  defaultTurnoverX: number;
  rulesEn: string; rulesBn: string;
}

interface PublicSpinTier extends SpinTierDef {
  segments: SpinWheelSegment[];
}

interface RewardsMe {
  coins: number;
  checkIn: { config: CheckInConfig; claimedToday: boolean; streakDay: number };
  spin: { config: SpinConfig; freeSpinsRemaining: number; lastSpinAt: string | null };
}

const OPERATORS: Array<{ key: Operator; en: string; bn: string }> = [
  { key: 'gp', en: 'Grameenphone', bn: 'গ্রামীণফোন' },
  { key: 'robi', en: 'Robi', bn: 'রবি' },
  { key: 'bl', en: 'Banglalink', bn: 'বাংলালিংক' },
  { key: 'airtel', en: 'Airtel', bn: 'এয়ারটেল' },
  { key: 'teletalk', en: 'Teletalk', bn: 'টেলিটক' },
];

export default function RewardsPage() {
  const t = useT();
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [tab, setTab] = useState<Tab>('store');
  const [items, setItems] = useState<PublicRewardItem[]>([]);
  const [me, setMe] = useState<RewardsMe | null>(null);
  const [tiers, setTiers] = useState<PublicSpinTier[]>([]);
  const [legacySegments, setLegacySegments] = useState<SpinWheelSegment[]>([]);
  const [selectedTierKey, setSelectedTierKey] = useState<string | null>(null);
  const [freeRemainingByTier, setFreeRemainingByTier] = useState<Record<string, number>>({});
  const [claimItem, setClaimItem] = useState<PublicRewardItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spinResult, setSpinResult] = useState<{ label: string; payoutType: string; payoutAmount: number } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [landingIndex, setLandingIndex] = useState<number | null>(null);
  const [winnersRefreshKey, setWinnersRefreshKey] = useState(0);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const pendingResultRef = useRef<{ label: string; payoutType: string; payoutAmount: number } | null>(null);

  const loadMe = useCallback(async () => {
    const r = await fetch('/api/rewards/me', { cache: 'no-store', credentials: 'include' });
    if (r.ok) setMe(await r.json());
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/rewards', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive) setItems((j?.items ?? []) as PublicRewardItem[]); })
      .catch(() => {});
    fetch('/api/content/spin-wheel', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const loadedTiers = Array.isArray(j?.tiers) ? (j.tiers as PublicSpinTier[]) : [];
        setTiers(loadedTiers);
        setLegacySegments(Array.isArray(j?.legacySegments) ? (j.legacySegments as SpinWheelSegment[]) : []);
        if (loadedTiers.length > 0 && !selectedTierKey) {
          setSelectedTierKey(loadedTiers[0].key);
        }
      })
      .catch(() => {});
    loadMe();
    return () => { alive = false; };
  }, [loadMe]);

  const coins = me?.coins ?? 0;
  const checkInCfg = me?.checkIn.config;
  const spinCfg = me?.spin.config;

  const selectedTier = useMemo(
    () => tiers.find((t) => t.key === selectedTierKey) ?? null,
    [tiers, selectedTierKey],
  );
  const activeSegments: SpinWheelSegment[] = useMemo(() => {
    if (selectedTier) return selectedTier.segments;
    // No tiers configured at all -> show legacy untiered segments
    // so an operator that has not yet seeded tiers still has a wheel.
    if (tiers.length === 0) return legacySegments;
    return [];
  }, [selectedTier, tiers.length, legacySegments]);

  // Seed the per-tier free-spin counter from the global RewardsMe
  // response: when only one tier exists, the global counter applies.
  // For multi-tier, each tier's value is updated after each spin via
  // the POST response's freeSpinsRemaining field.
  useEffect(() => {
    if (!me) return;
    if (tiers.length === 0) return;
    setFreeRemainingByTier((prev) => {
      const next = { ...prev };
      for (const t of tiers) {
        if (next[t.key] == null) next[t.key] = t.freeSpinsPerDay;
      }
      return next;
    });
  }, [me, tiers]);

  const insufficientText = useMemo(() => {
    return bn
      ? (checkInCfg?.insufficientCoinsTextBn ?? 'এই রিওয়ার্ড দাবি করার জন্য আপনার পর্যাপ্ত কয়েন নেই।')
      : (checkInCfg?.insufficientCoinsTextEn ?? 'You do not have enough coins to claim this reward.');
  }, [bn, checkInCfg]);

  const onClaim = async (item: PublicRewardItem, payload: Record<string, string>) => {
    setError(null);
    if (coins < item.cost) { setError(insufficientText); return; }
    const r = await fetch(`/api/rewards/${item.id}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      if (j?.code === 'INSUFFICIENT_COINS') {
        const short = Number(j?.coinsShort ?? 0);
        setError(bn
          ? `এই রিওয়ার্ড দাবি করতে আপনার আরও ${short} কয়েন প্রয়োজন।`
          : `You need ${short} more coins to claim this reward.`);
        return;
      }
      setError(j?.message ?? j?.code ?? 'Claim failed');
      return;
    }
    setClaimItem(null);
    setToast(bn ? 'দাবি জমা হয়েছে। অ্যাডমিন প্রক্রিয়া করবে।' : 'Claim submitted. Admin will process it shortly.');
    await loadMe();
    triggerWalletRefresh();
  };

  const onCheckIn = async () => {
    setError(null);
    const r = await fetch('/api/rewards/check-in', { method: 'POST', credentials: 'include' });
    const j = await r.json().catch(() => null);
    if (!r.ok) { setError(j?.message ?? j?.code ?? 'Check-in failed'); return; }
    setToast(bn ? `+${j.coinsAwarded} কয়েন` : `+${j.coinsAwarded} coins`);
    await loadMe();
    triggerWalletRefresh();
  };

  const onSpin = async () => {
    if (spinning) return;
    setError(null); setSpinResult(null); setLandingIndex(null);
    setSpinning(true);
    try {
      const r = await fetch('/api/rewards/spin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(selectedTierKey ? { tierKey: selectedTierKey } : {}),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const code = j?.code as string | undefined;
        if (code === 'NO_SEGMENTS' || code === 'SPIN_DISABLED' || code === 'TIER_NOT_FOUND') {
          setError(bn ? 'স্পিন এখনও কনফিগার করা হয়নি। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।' : 'Spin is not configured yet. Please try again later.');
        } else if (code === 'INSUFFICIENT_COINS') {
          const need = Number(j?.coinsNeeded ?? 0);
          const have = Number(j?.coinsHave ?? 0);
          setError(bn ? `যথেষ্ট কয়েন নেই। প্রয়োজন ${need}, আছে ${have}।` : `Not enough coins. Need ${need}, have ${have}.`);
        } else if (code === 'SPIN_COOLDOWN' || r.status === 429) {
          setError(bn ? 'একটু পরে আবার স্পিন করুন।' : 'Please wait a moment before spinning again.');
        } else {
          setError(j?.message ?? code ?? 'Spin failed');
        }
        setSpinning(false);
        return;
      }
      // Set the landing index BEFORE flipping spinning so the SpinWheel
      // animates straight to the server-selected wedge. The wheel's
      // onLandingComplete callback flips spinning back to false and
      // surfaces the result card.
      const idx: number | null = typeof j?.segmentIndex === 'number' ? j.segmentIndex : null;
      if (idx == null) {
        // Server returned no index (extremely defensive); just resolve
        // immediately so the user is not stuck.
        setSpinResult({ label: j.segmentLabel, payoutType: j.payoutType, payoutAmount: j.payoutAmount });
        setSpinning(false);
        await loadMe();
        triggerWalletRefresh();
        setWinnersRefreshKey((k) => k + 1);
        return;
      }
      setLandingIndex(idx);
      const tierK: string | null = typeof j?.tierKey === 'string' ? j.tierKey : selectedTierKey;
      const freeRemaining: number = typeof j?.freeSpinsRemaining === 'number' ? j.freeSpinsRemaining : 0;
      if (tierK) {
        setFreeRemainingByTier((prev) => ({ ...prev, [tierK]: freeRemaining }));
      }
      // Stash the result for the onLandingComplete handler.
      pendingResultRef.current = {
        label: j.segmentLabel,
        payoutType: j.payoutType,
        payoutAmount: j.payoutAmount,
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
    }
  };

  const onWheelLandingComplete = useCallback(() => {
    if (pendingResultRef.current) {
      const settled = pendingResultRef.current;
      setSpinResult(settled);
      // Surface the celebration modal only when there was an actual
      // prize. The inline emerald pill (rendered next to the wheel)
      // still covers the no-prize case so the user is not
      // left wondering whether the spin completed.
      if (settled.payoutAmount > 0) setCelebrationOpen(true);
      pendingResultRef.current = null;
    }
    setSpinning(false);
    loadMe();
    triggerWalletRefresh();
    setWinnersRefreshKey((k) => k + 1);
  }, [loadMe]);

  return (
    <div className="space-y-6 pb-24">
      <BackBar title={t('rewards.title')} />

      {/* Premium hero band: dark, gold glow, coin balance pinned to
          the right so the user feels the "casino lobby" weight the
          rest of the page builds on. Mobile collapses to a tight
          stacked card while keeping the gold accents readable. */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-400/25 bg-[linear-gradient(135deg,#1a1107_0%,#241608_55%,#0f0805_100%)] p-5 text-amber-50 shadow-[0_18px_44px_-22px_rgba(245,180,0,0.45)] md:p-7">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-amber-400/30 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-brand-blue-500/25 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/55 to-transparent" />

        <div className="relative grid gap-5 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
              <Sparkles className="h-3 w-3" /> {bn ? 'রিওয়ার্ড সেন্টার' : 'Reward Center'}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold leading-tight md:text-3xl">
              {bn ? 'কয়েন কামান, স্পিন করুন, পুরস্কার জিতুন' : 'Earn coins, spin the wheel, claim prizes'}
            </h1>
            <p className="mt-2 max-w-md text-sm text-amber-200/80">
              {bn
                ? 'ডিপোজিট, প্রতিদিন চেক ইন এবং রেফারেল থেকে কয়েন জমা করুন। এরপর লাকি স্পিন বা রিওয়ার্ড স্টোরে রূপান্তর করুন।'
                : 'Stack coins from deposits, daily check-ins and referrals. Then convert them into spins or claim rewards from the store.'}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/85">
              {t('rewards.yourBalance')}
            </p>
            <p className="mt-1 inline-flex items-baseline gap-2 text-3xl font-extrabold tabular-nums text-amber-100 drop-shadow-[0_2px_10px_rgba(245,180,0,0.35)] md:text-4xl">
              {coins.toLocaleString()}
              <span className="text-xs font-bold uppercase tracking-wider text-amber-200/80">
                {bn ? 'কয়েন' : 'coins'}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-amber-200/70">
              {bn
                ? `${me?.spin.freeSpinsRemaining ?? 0} টি ফ্রি স্পিন বাকি . ${items.length} টি রিওয়ার্ড উপলব্ধ`
                : `${me?.spin.freeSpinsRemaining ?? 0} free spins left . ${items.length} reward(s) available`}
            </p>
          </div>
        </div>
      </section>

      {toast ? <div className="rounded-lg border border-emerald-400/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</div> : null}
      {error ? <div className="rounded-lg border border-rose-400/60 bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertCircle className="mr-1 inline h-4 w-4" />{error}</div> : null}

      <div role="tablist" className="flex flex-wrap gap-2 border-b border-brand-divider">
        {[
          { key: 'store' as Tab, label: t('rewards.tabStore'), icon: Gift },
          { key: 'checkin' as Tab, label: t('rewards.tabCheckIn'), icon: Calendar },
          { key: 'spin' as Tab, label: t('rewards.tabSpin'), icon: Disc },
        ].map((entry) => {
          const Icon = entry.icon;
          const active = tab === entry.key;
          return (
            <button key={entry.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(entry.key)} className={cn(
              'inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition',
              active ? 'border-brand-yellow-500 text-brand-ink' : 'border-transparent text-brand-inkMute hover:text-brand-ink',
            )}>
              <Icon className="h-4 w-4" /> {entry.label}
            </button>
          );
        })}
      </div>

      {tab === 'store' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <p className="col-span-full text-sm text-brand-inkMute">{bn ? 'কোনো রিওয়ার্ড নেই।' : 'No rewards available right now.'}</p>
          ) : null}
          {items.map((r) => {
            const title = bn && r.titleBn ? r.titleBn : r.title;
            const desc = bn && r.descriptionBn ? r.descriptionBn : r.description;
            const canClaim = coins >= r.cost;
            return (
              <article key={r.id} className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
                <div className="relative aspect-[16/9] overflow-hidden bg-brand-surface">
                  {r.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.bannerUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-yellow-400 via-amber-500 to-orange-500" />
                  )}
                </div>
                <div className="px-5 py-4">
                  <h3 className="text-base font-extrabold text-brand-ink">{title}</h3>
                  {desc ? <p className="mt-1 text-sm text-brand-inkSoft">{desc}</p> : null}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-extrabold text-brand-ink tabular-nums">{r.cost.toLocaleString()} <span className="text-xs font-medium text-brand-inkMute">coins</span></span>
                    <button type="button" onClick={() => setClaimItem(r)} className={cn('inline-flex h-9 items-center rounded-lg px-4 text-xs font-semibold', canClaim ? 'btn-yellow' : 'cursor-not-allowed bg-brand-surface text-brand-inkMute')} disabled={!canClaim}>
                      {t('rewards.claim')}
                    </button>
                  </div>
                  {!canClaim ? (
                    <p className="mt-2 text-[11px] text-rose-600">{bn ? `আরও ${(r.cost - coins).toLocaleString()} কয়েন প্রয়োজন।` : `${(r.cost - coins).toLocaleString()} more coins needed.`}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === 'checkin' ? (
        <section className="rounded-2xl border border-brand-divider bg-brand-paper p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink"><Calendar className="h-5 w-5" /></span>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-brand-ink">{bn ? (checkInCfg?.titleBn ?? 'ডেইলি চেক ইন') : (checkInCfg?.titleEn ?? 'Daily Check-in')}</h2>
              <p className="mt-1 text-sm text-brand-inkSoft">{bn ? (checkInCfg?.bodyBn ?? '') : (checkInCfg?.bodyEn ?? '')}</p>

              <div className="mt-5 grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => {
                  const day = i + 1;
                  const done = (me?.checkIn.streakDay ?? 0) >= day;
                  const bonus = day === 7 ? checkInCfg?.streakBonusDay7 ?? 0 : 0;
                  return (
                    <div key={i} className={cn('flex aspect-square flex-col items-center justify-center rounded-xl border text-xs font-semibold',
                      done ? 'border-brand-yellow-500 bg-brand-yellow-500/10 text-brand-ink' : 'border-brand-divider bg-brand-surface text-brand-inkMute')}>
                      <span>{bn ? `দিন ${day}` : `Day ${day}`}</span>
                      {done ? <Check className="mt-1 h-3.5 w-3.5 text-brand-yellow-700" /> : <span className="mt-1 text-[10px]">+{(checkInCfg?.dailyCoins ?? 50) + bonus}</span>}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={onCheckIn} disabled={me?.checkIn.claimedToday} className={cn('mt-5 inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold', me?.checkIn.claimedToday ? 'cursor-not-allowed bg-brand-surface text-brand-inkMute' : 'btn-yellow')}>
                {me?.checkIn.claimedToday ? (bn ? 'আজকের চেক ইন সম্পন্ন' : 'Checked in today') : (bn ? 'চেক ইন করুন' : 'Check in today')}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'spin' ? (
        activeSegments.length === 0 && tiers.length === 0 ? (
          <section className="rounded-2xl border border-amber-300/60 bg-amber-50 p-6 text-amber-900">
            <p className="text-sm font-bold">
              {bn ? 'স্পিন হুইল কনফিগার করা হয়নি।' : 'Spin wheel is not configured yet.'}
            </p>
            <p className="mt-1 text-xs">
              {bn
                ? 'অ্যাডমিন শীঘ্রই সেগমেন্ট যোগ করবেন। পরে আবার আসুন।'
                : 'The operator will add segments shortly. Please check back later.'}
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {tiers.length > 0 ? (
              <SpinTierSelector
                tiers={tiers}
                selectedKey={selectedTierKey}
                onSelect={(k) => { setSelectedTierKey(k); setSpinResult(null); setLandingIndex(null); }}
                coinBalance={coins}
                freeRemainingByTier={freeRemainingByTier}
              />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border border-brand-divider bg-gradient-to-b from-[#1a1107] to-[#0c0805] p-5 text-amber-50 shadow-[inset_0_1px_0_rgba(255,200,90,0.18),0_20px_50px_-30px_rgba(245,180,0,0.55)]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-extrabold uppercase tracking-wider text-amber-200">
                    {selectedTier
                      ? (bn && selectedTier.nameBn ? selectedTier.nameBn : selectedTier.nameEn)
                      : (bn ? (spinCfg?.titleBn ?? 'লাকি স্পিন') : (spinCfg?.titleEn ?? 'Lucky Spin'))}
                  </h2>
                  <p className="text-[11px] text-amber-300/80">
                    {bn ? 'কয়েন ব্যালেন্স' : 'Coin balance'}: <span className="font-bold text-amber-100">{coins.toLocaleString()}</span>
                  </p>
                </div>
                <p className="mt-1 text-[11px] text-amber-200/70">
                  {selectedTier
                    ? (bn && selectedTier.descriptionBn ? selectedTier.descriptionBn : selectedTier.descriptionEn)
                    : (bn ? (spinCfg?.rulesBn ?? '') : (spinCfg?.rulesEn ?? ''))}
                </p>

                <div className="mt-5 flex flex-col items-center gap-4">
                  <SpinWheel
                    segments={activeSegments}
                    spinning={spinning}
                    landingIndex={landingIndex}
                    onLandingComplete={onWheelLandingComplete}
                    size={320}
                    disabled={spinning || activeSegments.length === 0}
                    onSpinClick={onSpin}
                    centerLabel={bn ? 'স্পিন' : 'SPIN'}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
                    <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 font-bold uppercase tracking-wider text-amber-200">
                      {selectedTier
                        ? (bn ? `প্রতি স্পিন ${selectedTier.costPerSpin} কয়েন` : `${selectedTier.costPerSpin} coins / spin`)
                        : (bn ? `প্রতি স্পিন ${spinCfg?.costPerSpinCoins ?? 100} কয়েন` : `${spinCfg?.costPerSpinCoins ?? 100} coins / spin`)}
                    </span>
                    <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2.5 py-1 font-bold uppercase tracking-wider text-emerald-200">
                      {selectedTier
                        ? (bn ? `${freeRemainingByTier[selectedTier.key] ?? selectedTier.freeSpinsPerDay} ফ্রি স্পিন বাকি` : `${freeRemainingByTier[selectedTier.key] ?? selectedTier.freeSpinsPerDay} free spins left`)
                        : (bn ? `${me?.spin.freeSpinsRemaining ?? 0} ফ্রি স্পিন বাকি` : `${me?.spin.freeSpinsRemaining ?? 0} free spins left`)}
                    </span>
                  </div>

                  {spinResult ? (
                    <div className="w-full max-w-md rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-emerald-100">
                      <p className="text-sm font-extrabold">
                        {bn ? `অভিনন্দন! আপনি জিতেছেন ${spinResult.label}` : `You won ${spinResult.label}!`}
                      </p>
                      {spinResult.payoutAmount > 0 ? (
                        <p className="mt-1 text-[11px] text-emerald-200/90">
                          {spinResult.payoutType === 'bonus'
                            ? (bn
                                ? `+${spinResult.payoutAmount} বোনাস লকড। উইথড্রয়াল আগে টার্নওভার সম্পূর্ণ করুন।`
                                : `+${spinResult.payoutAmount} bonus locked. Complete turnover before withdrawal.`)
                            : spinResult.payoutType === 'coins'
                              ? (bn ? `+${spinResult.payoutAmount} কয়েন আপনার ব্যালেন্সে যোগ হয়েছে।` : `+${spinResult.payoutAmount} coins added to your balance.`)
                              : `+${spinResult.payoutAmount}`}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-emerald-200/90">
                          {bn ? 'পরের বার শুভকামনা।' : 'Better luck next time.'}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <SpinWinnersFeed tierKey={selectedTierKey} refreshKey={winnersRefreshKey} />
              </div>
            </div>

            <SpinHowToGetCoins />
            <SpinTermsAccordion />
          </section>
        )
      ) : null}

      {claimItem ? (
        <ClaimModal
          item={claimItem}
          insufficientText={insufficientText}
          coins={coins}
          onClose={() => setClaimItem(null)}
          onConfirm={(payload) => onClaim(claimItem, payload)}
        />
      ) : null}

      <SpinResultModal
        open={celebrationOpen}
        result={spinResult}
        onClose={() => setCelebrationOpen(false)}
      />
    </div>
  );
}

function ClaimModal({ item, coins, insufficientText, onClose, onConfirm }: {
  item: PublicRewardItem;
  coins: number;
  insufficientText: string;
  onClose: () => void;
  onConfirm: (payload: Record<string, string>) => void;
}) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [operator, setOperator] = useState<Operator>('gp');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const enough = coins >= item.cost;
  const title = bn && item.titleBn ? item.titleBn : item.title;
  const instr = bn ? (item.shortInstructionBn ?? '') : (item.shortInstructionEn ?? '');

  const submit = () => {
    if (item.rewardType === 'recharge') onConfirm({ operator, phone });
    else if (item.rewardType === 'physical') onConfirm({ fullName, phone, address, notes });
    else onConfirm({});
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
        <div className="flex items-center justify-between border-b border-brand-divider px-4 py-3">
          <p className="text-sm font-bold text-brand-ink">{title}</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-brand-inkMute hover:bg-brand-surface"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {!enough ? <p className="rounded-lg border border-rose-400/60 bg-rose-50 px-3 py-2 text-sm text-rose-700">{insufficientText}</p> : null}
          {instr ? <p className="text-xs text-brand-inkSoft whitespace-pre-line">{instr}</p> : null}

          {item.rewardType === 'recharge' ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'অপারেটর নির্বাচন করুন' : 'Choose operator'}</p>
              <div className="grid grid-cols-5 gap-2">
                {OPERATORS.map((o) => (
                  <button key={o.key} type="button" onClick={() => setOperator(o.key)} className={cn('aspect-square rounded-xl border-2 p-2 text-[10px] font-bold uppercase', operator === o.key ? 'border-brand-yellow-500 bg-brand-yellow-500/10' : 'border-brand-divider bg-brand-paper')}>{bn ? o.bn : o.en}</button>
                ))}
              </div>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'মোবাইল নম্বর' : 'Phone number'}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm" placeholder="01XXXXXXXXX" />
              </label>
            </>
          ) : null}

          {item.rewardType === 'physical' ? (
            <>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'পূর্ণ নাম' : 'Full name'}</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'মোবাইল নম্বর' : 'Phone'}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'ঠিকানা' : 'Address'}</span>
                <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'অতিরিক্ত নোট (ঐচ্ছিক)' : 'Notes (optional)'}</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm" />
              </label>
            </>
          ) : null}

          {item.rewardType === 'digital' ? (
            <p className="text-sm text-brand-inkSoft">{bn ? 'নিশ্চিত করুন এবং আপনার অ্যাকাউন্টে রিওয়ার্ড পান।' : 'Confirm to send the request. The reward lands on your account once admin processes it.'}</p>
          ) : null}
        </div>
        <div className="border-t border-brand-divider px-4 py-3">
          <button type="button" onClick={submit} disabled={!enough} className={cn('inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-bold', enough ? 'btn-yellow' : 'cursor-not-allowed bg-brand-surface text-brand-inkMute')}>
            {bn ? `${item.cost.toLocaleString()} কয়েন দিয়ে নিশ্চিত করুন` : `Confirm for ${item.cost.toLocaleString()} coins`}
          </button>
        </div>
      </div>
    </div>
  );
}

