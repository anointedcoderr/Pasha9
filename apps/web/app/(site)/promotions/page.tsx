// Built by Anointed Coder.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Gift, Sparkles, Crown, Repeat, Users, Send, Ticket, Star, BadgePlus } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

type PromoType = 'first_deposit' | 'daily' | 'weekly' | 'referral' | 'vip' | 'invite' | 'reload' | 'manual' | 'promo';
type Filter = 'all' | PromoType;

interface Promo {
  id: string;
  name: string;
  type: PromoType;
  description: string | null;
  percentage: number;
  amount: number;
  minDeposit: number;
  maxBonus: number;
  turnoverX: number;
  validityDays: number;
  effective: string;
}

const ICON: Record<PromoType, React.ComponentType<{ className?: string }>> = {
  first_deposit: Sparkles,
  daily: Repeat,
  weekly: Gift,
  referral: Users,
  vip: Crown,
  invite: Send,
  reload: Repeat,
  manual: BadgePlus,
  promo: Star,
};

const ACCENT_GRADIENT: Record<PromoType, string> = {
  first_deposit: 'from-brand-yellow-400 via-amber-500 to-orange-500',
  daily: 'from-emerald-400 via-emerald-600 to-teal-700',
  weekly: 'from-brand-blue-500 via-brand-blue-600 to-brand-blue-700',
  referral: 'from-fuchsia-500 via-indigo-600 to-indigo-800',
  vip: 'from-amber-400 via-orange-500 to-rose-600',
  invite: 'from-rose-400 via-rose-600 to-orange-600',
  reload: 'from-cyan-400 via-cyan-600 to-blue-700',
  manual: 'from-slate-500 via-slate-700 to-slate-900',
  promo: 'from-pink-400 via-rose-500 to-red-600',
};

export default function PromotionsPage() {
  const t = useT();
  const { lang } = useLang();
  const [filter, setFilter] = useState<Filter>('all');
  const [list, setList] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/promotions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data?.promotions)) setList(data.promotions as Promo[]);
      })
      .catch(() => { /* keep empty */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return list;
    return list.filter((r) => r.type === filter);
  }, [filter, list]);

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t('common.all') },
    { key: 'first_deposit', label: t('promotions.firstDeposit') },
    { key: 'daily', label: t('promotions.daily') },
    { key: 'weekly', label: t('promotions.weekly') },
    { key: 'referral', label: t('promotions.referral') },
    { key: 'vip', label: t('promotions.vip') },
    { key: 'invite', label: t('promotions.invite') },
  ];

  return (
    <div className="space-y-6">
      <BackBar title={t('promotions.title')} />
      <CategoryHero
        kicker={t('promotions.title')}
        title={t('promotions.title')}
        description={t('promotions.subtitle')}
        accent="yellow"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="pill-provider"
              data-active={filter === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-inkMute">
          {filtered.length} {t('cat.results')}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-brand-inkSoft">Loading promotions...</p>
      ) : filtered.length === 0 ? (
        <div className="card-light p-6 text-center text-sm text-brand-inkSoft">
          {lang === 'bn' ? 'এখন কোনো প্রোমো নেই। শিগগিরই আবার দেখুন।' : 'No live promotions right now. Check back soon.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rule) => {
            const Icon = ICON[rule.type] ?? Ticket;
            const tagLabel =
              rule.type === 'first_deposit' ? t('promotions.firstDeposit') :
              rule.type === 'daily' ? t('promotions.daily') :
              rule.type === 'weekly' ? t('promotions.weekly') :
              rule.type === 'referral' ? t('promotions.referral') :
              rule.type === 'vip' ? t('promotions.vip') :
              rule.type === 'invite' ? t('promotions.invite') :
              rule.type === 'reload' ? (lang === 'bn' ? 'রিলোড' : 'Reload') :
              rule.type === 'manual' ? (lang === 'bn' ? 'বিশেষ' : 'Special') :
              (lang === 'bn' ? 'প্রোমো' : 'Promo');
            const headlineValue = rule.percentage > 0
              ? `${rule.percentage}%`
              : rule.amount > 0 ? formatBDT(rule.amount) : '-';
            return (
              <article key={rule.id} className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
                <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${ACCENT_GRADIENT[rule.type] ?? ACCENT_GRADIENT.promo}`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 py-3 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{tagLabel}</span>
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{headlineValue}</span>
                  </div>
                  <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <div className="px-5 py-4">
                  <h3 className="text-base font-extrabold text-brand-ink">{rule.name}</h3>
                  {rule.description ? <p className="mt-1.5 text-sm text-brand-inkSoft">{rule.description}</p> : null}
                  <p className="mt-2 text-xs text-brand-inkMute">{rule.effective}</p>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <Cell label={lang === 'bn' ? 'সর্বনিম্ন' : 'Min Deposit'} value={rule.minDeposit > 0 ? formatBDT(rule.minDeposit) : '-'} />
                    <Cell label={lang === 'bn' ? 'সর্বোচ্চ' : 'Max Bonus'} value={rule.maxBonus > 0 ? formatBDT(rule.maxBonus) : (lang === 'bn' ? 'কোনো সীমা নেই' : 'No cap')} />
                    <Cell label={lang === 'bn' ? 'টার্নওভার' : 'Turnover'} value={rule.turnoverX > 0 ? `${rule.turnoverX}x` : (lang === 'bn' ? 'নেই' : 'None')} />
                    <Cell label={lang === 'bn' ? 'মেয়াদ' : 'Validity'} value={rule.validityDays > 0 ? `${rule.validityDays} d` : (lang === 'bn' ? 'মেয়াদহীন' : 'No expiry')} />
                  </dl>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700">{lang === 'bn' ? 'চলছে' : 'Live'}</span>
                    <Link href="/?signup=1" className="btn-yellow inline-flex h-9 items-center rounded-lg px-4 text-xs">
                      {lang === 'bn' ? 'দাবি করুন' : 'Claim'}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="card-light p-6">
        <h2 className="text-lg font-extrabold text-brand-ink">{t('promotions.termsTitle')}</h2>
        <p className="mt-2 text-sm text-brand-inkSoft">{t('promotions.termsBody')}</p>
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-divider bg-brand-surface p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-inkMute">{label}</dt>
      <dd className="mt-0.5 font-semibold text-brand-ink tabular-nums">{value}</dd>
    </div>
  );
}
