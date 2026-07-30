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
import { useSearchParams } from 'next/navigation';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Trophy, Gift, Calendar, Disc, Check, AlertCircle, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { type SpinWheelSegment } from '@/components/site/SpinWheel';
import { SpinHowToGetCoins, SpinTermsAccordion, type SpinTierDef } from '@/components/site/SpinSections';
import { formatFreeSpins, isUnlimitedFreeSpins, UNLIMITED_FREE_SPINS } from '@/lib/rewards/free-spins';
import {
  SpinStage,
  SpinTierCardRow,
  SpinPremiumWheel,
  SpinWinCelebration,
  SpinWinnersMarquee,
} from '@/components/site/SpinPremium';

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
  cycleLength: number;
  dayAmounts: number[];
  requireDepositPerCycle: boolean;
  minDepositForNextCycle: number;
  depositGateTextEn: string;
  depositGateTextBn: string;
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
  checkIn: { config: CheckInConfig; claimedToday: boolean; streakDay: number; depositRequiredForNextCycle: boolean };
  spin: {
    config: SpinConfig;
    freeSpinsRemaining: number;
    // Daily allowance only (granted spins excluded), plus the per-tier
    // map of granted (deposit-bonus) free spins so each tier counter
    // can fold them in.
    dailyFreeSpinsRemaining?: number;
    grantedFreeSpinsByTier?: Record<string, number>;
    grantedFreeSpinsTotal?: number;
    lastSpinAt: string | null;
  };
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
  const searchParams = useSearchParams();
  // Resolve the initial tab from the URL so deep links from the
  // floating HomeSpinShortcut (/rewards?tab=spin) and the planned
  // /spin redirect (rewards?tab=spin) land directly on the Spin
  // tab. Default to 'store' for any unrecognised or missing value.
  const initialTab = ((): Tab => {
    const t = searchParams?.get('tab')?.trim().toLowerCase();
    if (t === 'spin' || t === 'checkin' || t === 'store') return t as Tab;
    return 'store';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
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
  // Screen-reader announcement for the spin outcome. The visible win is
  // a modal that only opens on a prize; a loss / no-prize used to be
  // completely silent. This inline polite live region announces EVERY
  // outcome (win amount or no-prize), so assistive tech always hears the
  // result of the spin.
  const [spinAnnouncement, setSpinAnnouncement] = useState('');
  const pendingResultRef = useRef<{ label: string; payoutType: string; payoutAmount: number } | null>(null);

  // Build a bilingual screen-reader sentence for any spin outcome.
  const announceSpinResult = useCallback((settled: { label: string; payoutType: string; payoutAmount: number }) => {
    let message: string;
    if (settled.payoutAmount > 0) {
      if (settled.payoutType === 'bonus') {
        message = bn
          ? `অভিনন্দন। আপনি ${settled.label} জিতেছেন। ${settled.payoutAmount} বোনাস যোগ হয়েছে।`
          : `Congratulations. You won ${settled.label}. ${settled.payoutAmount} bonus added.`;
      } else if (settled.payoutType === 'coins') {
        message = bn
          ? `অভিনন্দন। আপনি ${settled.label} জিতেছেন। ${settled.payoutAmount} কয়েন যোগ হয়েছে।`
          : `Congratulations. You won ${settled.label}. ${settled.payoutAmount} coins added.`;
      } else {
        message = bn
          ? `অভিনন্দন। আপনি ${settled.label} জিতেছেন। পুরস্কার আপনার অ্যাকাউন্টে জমা হয়েছে।`
          : `Congratulations. You won ${settled.label}. The prize has been credited to your account.`;
      }
    } else {
      message = bn
        ? 'এইবার কোনো পুরস্কার নেই। আবার চেষ্টা করুন।'
        : 'No prize this time. Please try again.';
    }
    // Clear first so an identical repeated result is still re-announced.
    setSpinAnnouncement('');
    window.setTimeout(() => setSpinAnnouncement(message), 50);
  }, [bn]);

  const loadMe = useCallback(async () => {
    const r = await fetch('/api/rewards/me', { cache: 'no-store', credentials: 'include' });
    if (r.ok) setMe(await r.json());
  }, []);

  // Pull-everything wrapper so we can re-fetch the spin-wheel data on
  // visibility change + on spin-tab open. The operator complained that
  // after editing a segment label in /admin/spin-segments the /rewards
  // tab kept showing the old label until a hard refresh - that was
  // because the original useEffect only ran once on mount.
  const fetchSpinWheel = useCallback(async () => {
    try {
      // ts query bust intermediate proxy / mobile webview cache so a
      // segment label edit in /admin/spin-segments is reflected on the
      // device immediately. The server also sets no-store on this
      // route; this is defence in depth.
      const r = await fetch(`/api/content/spin-wheel?ts=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const loadedTiers = Array.isArray(j?.tiers) ? (j.tiers as PublicSpinTier[]) : [];
      setTiers(loadedTiers);
      setLegacySegments(Array.isArray(j?.legacySegments) ? (j.legacySegments as SpinWheelSegment[]) : []);
      if (loadedTiers.length > 0 && !selectedTierKey) {
        setSelectedTierKey(loadedTiers[0].key);
      }
    } catch {
      // Silent; page renders with the previous snapshot.
    }
    // selectedTierKey intentionally omitted: we only want to default
    // the selection on first non-empty load, not reset every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/rewards', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive) setItems((j?.items ?? []) as PublicRewardItem[]); })
      .catch(() => {});
    fetchSpinWheel();
    loadMe();
    return () => { alive = false; };
  }, [loadMe, fetchSpinWheel]);

  // Re-fetch the spin wheel when the tab returns to the foreground.
  // Operators frequently flip between /admin/spin-segments and the
  // public /rewards tab; without this the rewards tab keeps showing
  // the snapshot it loaded the first time it was opened.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchSpinWheel();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchSpinWheel]);

  // Re-fetch on every switch INTO the spin tab so a freshly-edited
  // segment label shows up the moment the player taps the tab.
  useEffect(() => {
    if (tab === 'spin') {
      void fetchSpinWheel();
    }
  }, [tab, fetchSpinWheel]);

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
    const granted = me.spin.grantedFreeSpinsByTier ?? {};
    setFreeRemainingByTier((prev) => {
      const next = { ...prev };
      for (const t of tiers) {
        // Seed each tier once with its daily allowance plus any granted
        // (deposit-bonus) free spins for that tier. After the first spin
        // the POST response's freeSpinsRemaining keeps this in sync. An
        // unlimited tier keeps the sentinel so the UI shows "Unlimited".
        if (next[t.key] == null) {
          next[t.key] = isUnlimitedFreeSpins(t.freeSpinsPerDay)
            ? UNLIMITED_FREE_SPINS
            : t.freeSpinsPerDay + (granted[t.key] ?? 0);
        }
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
    if (r.status === 401) { window.location.href = '/?login=1'; return; }
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
      if (r.status === 401) {
        setSpinning(false);
        window.location.href = '/?login=1';
        return;
      }
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const code = j?.code as string | undefined;
        if (code === 'NO_SEGMENTS' || code === 'SPIN_DISABLED' || code === 'TIER_NOT_FOUND') {
          setError(bn ? 'স্পিন এখনও কনফিগার করা হয়নি। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।' : 'Spin is not configured yet. Please try again later.');
        } else if (code === 'SPIN_FALLBACK_REFUND') {
          // HARD_FALLBACK_REFUND from the engine: every wedge on this
          // tier was marked display-only. Operator misconfiguration.
          // Nothing was deducted; player can retry once the operator
          // restores a winnable wedge.
          setError(bn ? 'এই মুহূর্তে কোনো পুরস্কার নেই। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।' : 'No prize is available right now. Please try again later.');
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
        const immediate = { label: j.segmentLabel, payoutType: j.payoutType, payoutAmount: j.payoutAmount };
        setSpinResult(immediate);
        announceSpinResult(immediate);
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
      announceSpinResult(settled);
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
  }, [loadMe, announceSpinResult]);

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
                ? `${formatFreeSpins(me?.spin.freeSpinsRemaining, bn)} টি ফ্রি স্পিন বাকি . ${items.length} টি রিওয়ার্ড উপলব্ধ`
                : `${formatFreeSpins(me?.spin.freeSpinsRemaining, bn)} free spins left . ${items.length} reward(s) available`}
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

              {(() => {
                const cfg = checkInCfg;
                const cycleLength = Math.max(1, Math.min(60, Math.floor(cfg?.cycleLength || 7)));
                const dayAmounts = Array.isArray(cfg?.dayAmounts) ? cfg!.dayAmounts : [];
                const perDay = dayAmounts.length === cycleLength;
                const rewardFor = (day: number) =>
                  perDay
                    ? Math.max(0, Math.floor(Number(dayAmounts[day - 1] ?? (cfg?.dailyCoins ?? 50))))
                    : (cfg?.dailyCoins ?? 50) + (day === cycleLength ? (cfg?.streakBonusDay7 ?? 0) : 0);
                const streak = me?.checkIn.streakDay ?? 0;
                const claimedToday = me?.checkIn.claimedToday ?? false;
                const todayInCycle = claimedToday ? ((streak - 1) % cycleLength) + 1 : (streak % cycleLength) + 1;
                const gated = me?.checkIn.depositRequiredForNextCycle ?? false;
                const gateText = bn ? (cfg?.depositGateTextBn ?? '') : (cfg?.depositGateTextEn ?? '');
                return (
                  <>
                    <div className="mt-5 grid grid-cols-7 gap-2">
                      {Array.from({ length: cycleLength }).map((_, i) => {
                        const day = i + 1;
                        const done = day < todayInCycle || (day === todayInCycle && claimedToday);
                        return (
                          <div key={i} className={cn('flex aspect-square flex-col items-center justify-center rounded-xl border text-xs font-semibold',
                            done ? 'border-brand-yellow-500 bg-brand-yellow-500/10 text-brand-ink' : 'border-brand-divider bg-brand-surface text-brand-inkMute')}>
                            <span>{bn ? `দিন ${day}` : `Day ${day}`}</span>
                            {done ? <Check className="mt-1 h-3.5 w-3.5 text-brand-yellow-700" /> : <span className="mt-1 text-[10px]">+{rewardFor(day)}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {gated ? (
                      <p className="mt-4 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">{gateText}</p>
                    ) : null}

                    <button type="button" onClick={onCheckIn} disabled={claimedToday || gated} className={cn('mt-5 inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold', (claimedToday || gated) ? 'cursor-not-allowed bg-brand-surface text-brand-inkMute' : 'btn-yellow')}>
                      {gated ? (bn ? 'নতুন ডিপোজিট প্রয়োজন' : 'New deposit required') : claimedToday ? (bn ? 'আজকের চেক ইন সম্পন্ন' : 'Checked in today') : (bn ? 'চেক ইন করুন' : 'Check in today')}
                    </button>
                  </>
                );
              })()}
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
          <section className="space-y-5">
            {tiers.length > 0 ? (
              <SpinTierCardRow
                tiers={tiers}
                selectedKey={selectedTierKey}
                onSelect={(k) => { setSelectedTierKey(k); setSpinResult(null); setLandingIndex(null); }}
                coinBalance={coins}
                freeRemainingByTier={freeRemainingByTier}
              />
            ) : null}

            <SpinStage
              coins={coins}
              freeSpinsRemaining={selectedTier
                ? (freeRemainingByTier[selectedTier.key] ?? selectedTier.freeSpinsPerDay)
                : (me?.spin.freeSpinsRemaining ?? 0)}
              costPerSpin={selectedTier ? selectedTier.costPerSpin : (spinCfg?.costPerSpinCoins ?? 100)}
              tierLabel={selectedTier
                ? (bn && selectedTier.nameBn ? selectedTier.nameBn : selectedTier.nameEn)
                : (bn ? (spinCfg?.titleBn ?? 'লাকি স্পিন') : (spinCfg?.titleEn ?? 'Lucky Spin'))}
              tierDescription={selectedTier
                ? ((bn && selectedTier.descriptionBn ? selectedTier.descriptionBn : selectedTier.descriptionEn) ?? '')
                : (bn ? (spinCfg?.rulesBn ?? '') : (spinCfg?.rulesEn ?? ''))}
            >
              <SpinPremiumWheel
                segments={activeSegments}
                spinning={spinning}
                landingIndex={landingIndex}
                onLandingComplete={onWheelLandingComplete}
                disabled={spinning || activeSegments.length === 0}
                onSpinClick={onSpin}
              />
            </SpinStage>

            {/* Visually hidden live region co-located with the wheel so
                every spin outcome (win amount or no-prize) is announced
                to screen readers, including the loss case that never
                opens the celebration modal. */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="pointer-events-none absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]"
            >
              {spinAnnouncement}
            </div>

            <SpinWinnersMarquee tierKey={selectedTierKey} refreshKey={winnersRefreshKey} />

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

      <SpinWinCelebration
        open={celebrationOpen}
        result={spinResult}
        isJackpot={(() => {
          // Detect jackpot: top-tier wedge with the largest payout in
          // the active segments. Falls back to false when the wheel
          // is between tiers.
          if (!spinResult) return false;
          if (activeSegments.length === 0) return false;
          const top = Math.max(...activeSegments.map((s) => s.payoutAmount ?? 0));
          return top > 0 && spinResult.payoutAmount >= top;
        })()}
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

