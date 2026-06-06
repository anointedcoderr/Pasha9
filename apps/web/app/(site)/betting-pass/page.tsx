// Built by Anointed Coder.
//
// Public Betting Pass page. Drives off /api/betting-pass/me. The ladder
// is admin-tunable via /admin/betting-pass; we render every active
// BettingPassRule, mark unlocked tiers in gold and let the player
// claim each one exactly once. The hero KPIs show real lifetime
// points + tier name + points-to-next-tier.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { Crown, Lock, Star, Zap, Gift, CheckCircle2, AlertTriangle, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface BettingPassLadderRow {
  id: string;
  tier: number;
  nameEn: string;
  nameBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  iconUrl: string | null;
  pointsRequired: number;
  rewardKind: 'coins' | 'bonus' | 'freebet' | 'physical';
  rewardAmount: number;
  unlocked: boolean;
  claimed: boolean;
  claimable: boolean;
}

interface BettingPassData {
  enabled: boolean;
  pointsPerBdtDeposit: number;
  pointsPerBdtBet: number;
  progress: {
    pointsTotal: number;
    pointsFromDeposit: number;
    pointsFromBet: number;
    currentTier: number;
    currentTierName: string | null;
    nextTierName: string | null;
    pointsToNextTier: number;
    nextTierRequirement: number | null;
  };
  ladder: BettingPassLadderRow[];
  claims: Array<{ id: string; tier: number; rewardKind: string; rewardAmount: number; status: string; createdAt: string }>;
}

type AuthState = { kind: 'checking' } | { kind: 'guest' } | { kind: 'authed' };

export default function BettingPassPage() {
  const t = useT();
  const { lang } = useLang();
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' });
  const [data, setData] = useState<BettingPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setAuth(j?.user?.username ? { kind: 'authed' } : { kind: 'guest' });
      })
      .catch(() => { if (alive) setAuth({ kind: 'guest' }); });
    return () => { alive = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (auth.kind !== 'authed') return;
    setLoading(true);
    try {
      const r = await fetch('/api/betting-pass/me', { cache: 'no-store', credentials: 'include' });
      if (r.status === 401) { setAuth({ kind: 'guest' }); return; }
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? 'Failed to load');
      setData(j as BettingPassData);
    } catch (e) {
      setFlash({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, [auth.kind]);

  useEffect(() => { refresh(); }, [refresh]);

  const claim = async (ruleId: string) => {
    setClaimingId(ruleId);
    setFlash(null);
    try {
      const r = await fetch(`/api/betting-pass/claim/${encodeURIComponent(ruleId)}`, { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) {
        // Server is the source of truth. We do NOT flip any local
        // state to "claimed" before this check returns ok, so a
        // failed claim leaves the button live for retry / diagnosis.
        const code = j?.code as string | undefined;
        let msg = j?.message ?? code ?? 'Claim failed';
        if (code === 'INSUFFICIENT_POINTS' || code === 'TIER_LOCKED') {
          msg = lang === 'bn' ? 'যথেষ্ট পয়েন্ট নেই। আরও খেলে পয়েন্ট অর্জন করুন।' : 'You need more points to claim this reward.';
        } else if (code === 'ALREADY_CLAIMED') {
          msg = lang === 'bn' ? 'আপনি ইতিমধ্যে এই রিওয়ার্ড দাবি করেছেন।' : 'You have already claimed this reward.';
        }
        throw new Error(msg);
      }
      const pointsAfter = Number(j?.pointsTotalAfter ?? 0);
      const spent = Number(j?.pointsSpent ?? 0);
      const turnover = Number(j?.turnoverRequired ?? 0);
      const ok = lang === 'bn'
        ? `রিওয়ার্ড দাবি সম্পন্ন। +${Number(j.rewardAmount).toLocaleString()} ${j.rewardKind}. পয়েন্ট: ${pointsAfter.toLocaleString()} (খরচ ${spent.toLocaleString()})${turnover > 0 ? `. টার্নওভার প্রয়োজন ৳${turnover.toLocaleString()}` : ''}.`
        : `Reward claimed. +${Number(j.rewardAmount).toLocaleString()} ${j.rewardKind}. Points: ${pointsAfter.toLocaleString()} (spent ${spent.toLocaleString()})${turnover > 0 ? `. Turnover required ৳${turnover.toLocaleString()}` : ''}.`;
      setFlash({ kind: 'ok', text: ok });
      triggerWalletRefresh();
      await refresh();
    } catch (e) {
      setFlash({ kind: 'err', text: e instanceof Error ? e.message : 'Claim failed' });
    } finally {
      setClaimingId(null);
    }
  };

  const progressPct = data?.progress.nextTierRequirement
    ? Math.min(100, (data.progress.pointsTotal / data.progress.nextTierRequirement) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <BackBar title={t('bp.title')} />
      <CategoryHero
        kicker={t('bp.title')}
        title={t('bp.title')}
        description={t('bp.subtitle')}
        accent="blue"
        category="bettingPass"
        chips={[
          { label: 'Hot', tone: 'rose' },
          { label: 'Tier Rewards', tone: 'gold' },
        ]}
      />

      {flash ? (
        <div className={cn(
          'rounded-lg border px-3 py-2 text-sm',
          flash.kind === 'ok'
            ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900'
            : 'border-rose-300/60 bg-rose-50 text-rose-900',
        )}>
          {flash.text}
        </div>
      ) : null}

      {auth.kind === 'guest' ? (
        <div className="card-light flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-brand-yellow-700" />
            <div>
              <p className="text-sm font-bold text-brand-ink">
                {lang === 'bn' ? 'বেটিং পাস দেখতে লগইন করুন।' : 'Log in to see your Betting Pass.'}
              </p>
              <p className="text-xs text-brand-inkMute">
                {lang === 'bn'
                  ? 'প্রতিটি ডিপোজিট এবং প্রভাইডার বেট আপনাকে পয়েন্ট দেয়।'
                  : 'Every approved deposit and provider bet earns points.'}
              </p>
            </div>
          </div>
          <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-5 text-sm">
            <LogIn className="mr-1.5 h-4 w-4" />
            {lang === 'bn' ? 'লগইন' : 'Log in'}
          </Link>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <KpiCard
          icon={<Crown className="h-5 w-5" />}
          title={lang === 'bn' ? 'বর্তমান স্তর' : 'Current tier'}
          value={data?.progress.currentTierName ?? (lang === 'bn' ? 'এখনো নেই' : 'Not yet')}
        />
        <KpiCard
          icon={<Star className="h-5 w-5" />}
          title={lang === 'bn' ? 'পাস পয়েন্ট' : 'Pass points'}
          value={data ? data.progress.pointsTotal.toLocaleString() : '0'}
        />
        <KpiCard
          icon={<Zap className="h-5 w-5" />}
          title={lang === 'bn' ? 'পরবর্তী রিওয়ার্ড' : 'Next reward'}
          value={data?.progress.nextTierName ?? (lang === 'bn' ? 'সর্বোচ্চ স্তর' : 'Top tier reached')}
        />
      </section>

      {data?.progress.nextTierRequirement && data.progress.pointsToNextTier > 0 ? (
        <section className="card-light p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
              {lang === 'bn' ? 'পরবর্তী স্তরের অগ্রগতি' : 'Progress to next tier'}
            </p>
            <p className="text-[11px] font-bold text-brand-ink">
              {data.progress.pointsTotal.toLocaleString()} / {data.progress.nextTierRequirement.toLocaleString()}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-surface">
            <div className="h-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-brand-inkMute">
            {lang === 'bn'
              ? `${data.progress.pointsToNextTier.toLocaleString()} পয়েন্ট বাকি`
              : `${data.progress.pointsToNextTier.toLocaleString()} points to go`}
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {(data?.ladder ?? []).length === 0 && !loading ? (
          <div className="col-span-full rounded-2xl border border-brand-divider bg-brand-paper p-4 text-sm text-brand-inkMute">
            {lang === 'bn'
              ? 'অপারেটর এখনো কোনো স্তর কনফিগার করেননি।'
              : 'No tiers configured yet. Check back soon.'}
          </div>
        ) : null}
        {(data?.ladder ?? []).map((row) => (
          <article key={row.id} className={cn(
            'overflow-hidden rounded-2xl border bg-brand-paper transition',
            row.unlocked ? 'border-brand-yellow-500/60 shadow-[0_8px_24px_-12px_rgba(245,180,0,0.45)]' : 'border-brand-divider',
          )}>
            <div className={cn(
              'relative aspect-[4/3] overflow-hidden text-white',
              row.unlocked
                ? 'bg-gradient-to-br from-amber-400 to-amber-700'
                : 'bg-gradient-to-br from-brand-blue-500 to-brand-blue-700',
            )}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
              {row.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.iconUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              ) : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {row.unlocked ? <CheckCircle2 className="h-7 w-7 text-white" /> : <Crown className="h-7 w-7 text-brand-yellow-300" />}
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/80">
                  {lang === 'bn' ? `স্তর ${row.tier}` : `Tier ${row.tier}`}
                </p>
                <p className="text-xl font-extrabold">{lang === 'bn' && row.nameBn ? row.nameBn : row.nameEn}</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">
                {lang === 'bn' ? 'প্রয়োজন' : 'Requirement'}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-brand-ink">
                {row.pointsRequired.toLocaleString()} {lang === 'bn' ? 'পয়েন্ট' : 'points'}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">
                {lang === 'bn' ? 'পুরস্কার' : 'Reward'}
              </p>
              <p className="text-sm font-semibold text-brand-ink">
                <Gift className="mr-1.5 inline h-3.5 w-3.5 text-brand-yellow-600" />
                {row.rewardAmount.toLocaleString()} {row.rewardKind}
              </p>
              {row.descriptionEn || row.descriptionBn ? (
                <p className="mt-2 text-[11px] text-brand-inkMute">
                  {lang === 'bn' && row.descriptionBn ? row.descriptionBn : row.descriptionEn}
                </p>
              ) : null}
              <div className="mt-3">
                {row.claimed ? (
                  <button type="button" disabled className="btn-ghost inline-flex h-9 w-full items-center justify-center rounded-lg px-3 text-xs uppercase tracking-wider opacity-70">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {lang === 'bn' ? 'দাবি করা হয়েছে' : 'Claimed'}
                  </button>
                ) : row.claimable ? (
                  <button
                    type="button"
                    onClick={() => claim(row.id)}
                    disabled={claimingId === row.id}
                    className="btn-yellow inline-flex h-9 w-full items-center justify-center rounded-lg px-3 text-xs uppercase tracking-wider"
                  >
                    {claimingId === row.id
                      ? (lang === 'bn' ? 'প্রসেসিং...' : 'Claiming...')
                      : (lang === 'bn' ? 'দাবি করুন' : 'Claim reward')}
                  </button>
                ) : (
                  <button type="button" disabled className="btn-ghost inline-flex h-9 w-full items-center justify-center rounded-lg px-3 text-xs uppercase tracking-wider opacity-70">
                    <Lock className="mr-1.5 h-3.5 w-3.5" />
                    {lang === 'bn' ? 'লক করা' : 'Locked'}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>

      {data?.enabled === false ? (
        <section className="card-light p-4">
          <p className="flex items-center gap-2 text-sm text-brand-inkSoft">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {lang === 'bn'
              ? 'বেটিং পাস বর্তমানে অস্থায়ীভাবে নিষ্ক্রিয়।'
              : 'Betting Pass is temporarily disabled by the operator.'}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function KpiCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="card-light flex items-center gap-3 px-4 py-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue-500/15 text-brand-blue-700">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">{title}</p>
        <p className="truncate text-base font-extrabold text-brand-ink">{value}</p>
      </div>
    </div>
  );
}
