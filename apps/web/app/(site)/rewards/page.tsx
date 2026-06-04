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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Trophy, Gift, Calendar, Disc, Check, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';

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

interface SpinSegment {
  id: string;
  label: string;
  color: string;
  payoutType: string;
  payoutAmount: number;
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
  const [segments, setSegments] = useState<SpinSegment[]>([]);
  const [claimItem, setClaimItem] = useState<PublicRewardItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spinResult, setSpinResult] = useState<{ label: string; payoutType: string; payoutAmount: number } | null>(null);
  const [spinning, setSpinning] = useState(false);

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
      .then((j) => { if (alive) setSegments((j?.segments ?? []) as SpinSegment[]); })
      .catch(() => {});
    loadMe();
    return () => { alive = false; };
  }, [loadMe]);

  const coins = me?.coins ?? 0;
  const checkInCfg = me?.checkIn.config;
  const spinCfg = me?.spin.config;

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
    setError(null); setSpinResult(null);
    setSpinning(true);
    try {
      const r = await fetch('/api/rewards/spin', { method: 'POST', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const code = j?.code as string | undefined;
        if (code === 'NO_SEGMENTS' || code === 'SPIN_DISABLED') {
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
        return;
      }
      // Brief animation pause so the wheel UI feels like it lands on
      // the result instead of flipping instantly.
      await new Promise((resolve) => setTimeout(resolve, 1400));
      setSpinResult({ label: j.segmentLabel, payoutType: j.payoutType, payoutAmount: j.payoutAmount });
      await loadMe();
      triggerWalletRefresh();
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <BackBar title={t('rewards.title')} />

      <section className="rounded-2xl border border-brand-divider bg-brand-paper p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grad-yellow text-brand-ink"><Trophy className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">{t('rewards.yourBalance')}</p>
            <p className="text-xl font-extrabold text-brand-ink tabular-nums">{coins.toLocaleString()} coins</p>
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
        segments.length === 0 ? (
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
          <section className="grid gap-4 md:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-brand-divider bg-brand-paper p-6">
              <h2 className="text-lg font-extrabold text-brand-ink">{bn ? (spinCfg?.titleBn ?? 'লাকি স্পিন') : (spinCfg?.titleEn ?? 'Lucky Spin')}</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-brand-inkSoft">{bn ? (spinCfg?.rulesBn ?? '') : (spinCfg?.rulesEn ?? '')}</p>
              <ul className="mt-4 space-y-2 text-sm text-brand-inkSoft">
                <li>{bn ? `১ স্পিন = ${spinCfg?.costPerSpinCoins ?? 100} কয়েন` : `1 spin costs ${spinCfg?.costPerSpinCoins ?? 100} coins`}</li>
                <li>{bn ? `প্রতিদিন ${spinCfg?.freeSpinsPerDay ?? 3}টি ফ্রি স্পিন` : `${spinCfg?.freeSpinsPerDay ?? 3} free spins every day`}</li>
                <li>{bn ? `টার্নওভার ${spinCfg?.defaultTurnoverX ?? 3}x` : `${spinCfg?.defaultTurnoverX ?? 3}x turnover on wallet credits`}</li>
                <li>{bn ? `অবশিষ্ট ফ্রি স্পিন: ${me?.spin.freeSpinsRemaining ?? 0}` : `Free spins remaining today: ${me?.spin.freeSpinsRemaining ?? 0}`}</li>
              </ul>
              <button
                type="button"
                onClick={onSpin}
                disabled={spinning}
                className={cn('mt-5 inline-flex h-11 items-center rounded-lg btn-yellow px-6 text-sm font-semibold transition', spinning && 'opacity-70')}
              >
                {spinning
                  ? (bn ? 'স্পিন হচ্ছে...' : 'Spinning...')
                  : (bn ? 'এখন স্পিন করুন' : 'Spin now')}
              </button>
              {spinResult ? (
                <div className="mt-3 rounded-lg border border-emerald-400/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <p className="font-bold">
                    {bn ? `অভিনন্দন! আপনি জিতেছেন ${spinResult.label}` : `You won ${spinResult.label}!`}
                  </p>
                  {spinResult.payoutAmount > 0 ? (
                    <p className="mt-0.5 text-xs">
                      {spinResult.payoutType === 'bonus'
                        ? (bn
                            ? `+${spinResult.payoutAmount} বোনাস লকড। উইথড্রয়াল আগে টার্নওভার সম্পূর্ণ করুন।`
                            : `+${spinResult.payoutAmount} bonus locked. Complete turnover before withdrawal.`)
                        : spinResult.payoutType === 'coins'
                          ? (bn ? `+${spinResult.payoutAmount} কয়েন আপনার ব্যালেন্সে যোগ হয়েছে।` : `+${spinResult.payoutAmount} coins added to your balance.`)
                          : (bn ? `+${spinResult.payoutAmount}` : `+${spinResult.payoutAmount}`)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs">
                      {bn ? 'পরের বার শুভকামনা।' : 'Better luck next time.'}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className={cn('flex items-center justify-center rounded-2xl border border-brand-divider bg-brand-paper p-4', spinning && 'animate-pulse')}>
              <SpinWheel segments={segments} />
            </div>
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

function SpinWheel({ segments }: { segments: SpinSegment[] }) {
  const wedges = segments.length > 0
    ? segments
    : [
      { id: 'd1', label: '100', color: '#FFCC00', payoutType: 'coins', payoutAmount: 100 },
      { id: 'd2', label: '50',  color: '#1E73E8', payoutType: 'coins', payoutAmount: 50 },
      { id: 'd3', label: 'X2',  color: '#FF4E3A', payoutType: 'bonus', payoutAmount: 2 },
      { id: 'd4', label: '200', color: '#23C26B', payoutType: 'coins', payoutAmount: 200 },
      { id: 'd5', label: '10',  color: '#0F1115', payoutType: 'coins', payoutAmount: 10 },
      { id: 'd6', label: '500', color: '#F5B400', payoutType: 'coins', payoutAmount: 500 },
      { id: 'd7', label: '25',  color: '#1659C2', payoutType: 'coins', payoutAmount: 25 },
      { id: 'd8', label: 'X3',  color: '#FF7A1A', payoutType: 'bonus', payoutAmount: 3 },
    ];
  const cx = 140; const cy = 140; const r = 130;
  const slice = (2 * Math.PI) / wedges.length;
  return (
    <svg viewBox="0 0 280 280" className="h-[260px] w-[260px]">
      <defs>
        <radialGradient id="rim" cx="50%" cy="50%" r="55%">
          <stop offset="80%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
      </defs>
      {wedges.map((w, i) => {
        const a0 = i * slice - Math.PI / 2;
        const a1 = a0 + slice;
        const x0 = cx + r * Math.cos(a0); const y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
        const labelA = a0 + slice / 2;
        const lx = cx + r * 0.62 * Math.cos(labelA);
        const ly = cy + r * 0.62 * Math.sin(labelA);
        const fill = w.color || '#FFCC00';
        const light = ['#FFCC00', '#F5B400'].includes(fill);
        return (
          <g key={w.id}>
            <path d={`M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={fill} stroke="#FFFFFF" strokeWidth="2" />
            <text x={lx} y={ly} textAnchor="middle" alignmentBaseline="middle" fontSize="14" fontWeight="800" fill={light ? '#0F1115' : '#FFFFFF'}>{w.label}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill="url(#rim)" />
      <circle cx={cx} cy={cy} r="26" fill="#0F1115" />
      <polygon points={`${cx},10 ${cx - 10},36 ${cx + 10},36`} fill="#0F1115" />
    </svg>
  );
}
