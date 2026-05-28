// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Trophy, Gift, Calendar, Disc, Check, Smartphone, Ticket, Sparkles, Lock } from 'lucide-react';

type Tab = 'store' | 'checkin' | 'spin';

interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  accent: 'yellow' | 'blue' | 'red' | 'green';
}

const REWARDS: RewardItem[] = [
  { id: 'r1', title: 'Mobile Recharge 500', description: 'Top up any Bangladesh operator for 500 BDT', cost: 1000, accent: 'yellow' },
  { id: 'r2', title: 'Mobile Recharge 1000', description: 'Top up any Bangladesh operator for 1000 BDT', cost: 2000, accent: 'yellow' },
  { id: 'r3', title: 'Free Spins x30', description: 'Use on selected slot games', cost: 2100, accent: 'red' },
  { id: 'r4', title: 'Free Spins x50', description: 'Use on selected slot games', cost: 3500, accent: 'red' },
  { id: 'r5', title: 'Bluetooth Speaker', description: 'Pasha 9 partner speaker', cost: 4200, accent: 'blue' },
  { id: 'r6', title: 'Free Bet 1000', description: 'Use on sportsbook markets', cost: 2400, accent: 'green' },
];

const ACCENT_GRADIENT: Record<RewardItem['accent'], string> = {
  yellow: 'from-brand-yellow-400 via-amber-500 to-orange-500',
  blue: 'from-brand-blue-500 via-brand-blue-600 to-brand-blue-700',
  red: 'from-rose-500 via-red-600 to-orange-600',
  green: 'from-emerald-500 via-emerald-600 to-teal-700',
};

const ACCENT_ICON: Record<RewardItem['accent'], React.ComponentType<{ className?: string }>> = {
  yellow: Smartphone,
  blue: Disc,
  red: Sparkles,
  green: Ticket,
};

export default function RewardsPage() {
  const t = useT();
  const { lang } = useLang();
  const [tab, setTab] = useState<Tab>('store');
  const [coins] = useState(0); // M2: load from /api/auth/me wallet.bonusBalance or a dedicated coins ledger
  const [list, setList] = useState<RewardItem[]>(REWARDS);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/rewards')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const items = Array.isArray(data?.items) ? (data.items as Array<{ id: string; title: string; description?: string | null; cost: number; accent: RewardItem['accent']; }>) : [];
        if (alive && items.length) {
          setList(items.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description ?? '',
            cost: Number(i.cost),
            accent: i.accent,
          })));
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const tabs: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'store', label: t('rewards.tabStore'), icon: Gift },
    { key: 'checkin', label: t('rewards.tabCheckIn'), icon: Calendar },
    { key: 'spin', label: t('rewards.tabSpin'), icon: Disc },
  ];

  return (
    <div className="space-y-6">
      <BackBar title={t('rewards.title')} />
      <CategoryHero
        kicker={t('rewards.title')}
        title={t('rewards.title')}
        description={t('rewards.subtitle')}
        accent="yellow"
        category="rewards"
        chips={[
          { label: 'Loyalty', tone: 'gold' },
          { label: 'Coin Shop', tone: 'sky' },
        ]}
      />

      <section className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-brand-divider bg-brand-paper px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grad-yellow text-brand-ink">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">
              {t('rewards.yourBalance')}
            </p>
            <p className="text-xl font-extrabold text-brand-ink tabular-nums">{coins.toLocaleString()} coins</p>
          </div>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-yellow-500/15 px-3 py-1 text-[11px] font-semibold text-brand-yellow-700">
          <Lock className="h-3.5 w-3.5" /> {t('rewards.comingSoon')}
        </p>
      </section>

      <div role="tablist" className="flex flex-wrap gap-2 border-b border-brand-divider">
        {tabs.map((entry) => {
          const Icon = entry.icon;
          const active = tab === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.key)}
              className={
                'inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ' +
                (active
                  ? 'border-brand-yellow-500 text-brand-ink'
                  : 'border-transparent text-brand-inkMute hover:text-brand-ink')
              }
            >
              <Icon className="h-4 w-4" />
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === 'store' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => {
            const Icon = ACCENT_ICON[r.accent];
            const canClaim = coins >= r.cost;
            return (
              <article key={r.id} className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
                <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${ACCENT_GRADIENT[r.accent]}`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
                  <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="px-5 py-4">
                  <h3 className="text-base font-extrabold text-brand-ink">{r.title}</h3>
                  <p className="mt-1 text-sm text-brand-inkSoft">{r.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-extrabold text-brand-ink tabular-nums">
                      {r.cost.toLocaleString()} <span className="text-xs font-medium text-brand-inkMute">coins</span>
                    </span>
                    <button
                      type="button"
                      disabled={!canClaim}
                      className={
                        'inline-flex h-9 items-center rounded-lg px-4 text-xs font-semibold ' +
                        (canClaim ? 'btn-yellow' : 'cursor-not-allowed bg-brand-surface text-brand-inkMute')
                      }
                      title={!canClaim ? t('rewards.comingSoon') : undefined}
                    >
                      {t('rewards.claim')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === 'checkin' ? (
        <section className="card-light p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink">
              <Calendar className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-brand-ink">{t('rewards.checkInTitle')}</h2>
              <p className="mt-1 text-sm text-brand-inkSoft">{t('rewards.checkInBody')}</p>

              <div className="mt-5 grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => {
                  const done = i < 0;
                  return (
                    <div
                      key={i}
                      className={
                        'flex aspect-square flex-col items-center justify-center rounded-xl border text-xs font-semibold ' +
                        (done
                          ? 'border-brand-yellow-500 bg-brand-yellow-500/10 text-brand-ink'
                          : 'border-brand-divider bg-brand-surface text-brand-inkMute')
                      }
                    >
                      <span>{lang === 'bn' ? `দিন ${i + 1}` : `Day ${i + 1}`}</span>
                      {done ? <Check className="mt-1 h-3.5 w-3.5 text-brand-yellow-700" /> : <span className="mt-1 text-[10px]">+50</span>}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  className="btn-outline-ink inline-flex h-10 items-center rounded-lg px-5 text-sm"
                  title={t('rewards.comingSoon')}
                >
                  {lang === 'bn' ? 'চেক ইন করুন' : 'Check in today'}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'spin' ? (
        <section className="grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="card-light p-6">
            <h2 className="text-lg font-extrabold text-brand-ink">{t('rewards.spinTitle')}</h2>
            <p className="mt-1 text-sm text-brand-inkSoft">{t('rewards.spinBody')}</p>

            <ul className="mt-4 space-y-2 text-sm text-brand-inkSoft">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-yellow-500" />{lang === 'bn' ? '১ স্পিন = ১০০ কয়েন' : '1 spin costs 100 coins'}</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-yellow-500" />{lang === 'bn' ? 'প্রতিদিন ৩টি ফ্রি স্পিন' : '3 free spins every day'}</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-yellow-500" />{lang === 'bn' ? 'বোনাস কয়েন, ফ্রি স্পিন এবং রিচার্জ জিতুন' : 'Win bonus coins, free spins and recharges'}</li>
            </ul>

            <button
              type="button"
              disabled
              title={t('rewards.comingSoon')}
              className="mt-5 inline-flex h-11 cursor-not-allowed items-center rounded-lg bg-brand-surface px-6 text-sm font-semibold text-brand-inkMute"
            >
              {t('rewards.spinCta')}
            </button>
          </div>

          <div className="card-light flex items-center justify-center p-4">
            <SpinWheelMock />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SpinWheelMock() {
  const wedges = [
    { color: '#FFCC00', label: '100' },
    { color: '#1E73E8', label: '50' },
    { color: '#FF4E3A', label: 'X2' },
    { color: '#23C26B', label: '200' },
    { color: '#0F1115', label: '10' },
    { color: '#F5B400', label: '500' },
    { color: '#1659C2', label: '25' },
    { color: '#FF7A1A', label: 'X3' },
  ];
  const cx = 140;
  const cy = 140;
  const r = 130;
  const slice = (2 * Math.PI) / wedges.length;

  return (
    <svg viewBox="0 0 280 280" className="h-[260px] w-[260px]">
      {wedges.map((w, i) => {
        const a0 = i * slice - Math.PI / 2;
        const a1 = a0 + slice;
        const x0 = cx + r * Math.cos(a0);
        const y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const labelA = a0 + slice / 2;
        const lx = cx + r * 0.62 * Math.cos(labelA);
        const ly = cy + r * 0.62 * Math.sin(labelA);
        return (
          <g key={i}>
            <path d={`M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={w.color} stroke="#FFFFFF" strokeWidth="2" />
            <text x={lx} y={ly} textAnchor="middle" alignmentBaseline="middle" fontSize="14" fontWeight="800" fill={w.color === '#FFCC00' || w.color === '#F5B400' ? '#0F1115' : '#FFFFFF'}>
              {w.label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="26" fill="#0F1115" />
      <polygon points={`${cx},10 ${cx - 10},36 ${cx + 10},36`} fill="#0F1115" />
    </svg>
  );
}
