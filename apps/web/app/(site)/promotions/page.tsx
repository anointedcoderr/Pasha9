'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { mockBonusRules } from '@/lib/mock/bonuses';
import { Gift, Sparkles, Crown, Repeat, Users, Send } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import type { BonusRule } from '@/types';

const iconMap = {
  first_deposit: Sparkles,
  daily: Repeat,
  weekly: Gift,
  referral: Users,
  vip: Crown,
  invite: Send,
} as const;

const tagMap = (lang: 'bn' | 'en', t: (k: string) => string): Record<BonusRule['type'], string> => ({
  first_deposit: t('promotions.firstDeposit'),
  daily: t('promotions.daily'),
  weekly: t('promotions.weekly'),
  referral: t('promotions.referral'),
  vip: t('promotions.vip'),
  invite: t('promotions.invite'),
});

export default function PromotionsPage() {
  const t = useT();
  const { lang } = useLang();
  const tags = tagMap(lang, t);

  return (
    <>
      <PageHeader title={t('promotions.title')} subtitle={t('promotions.subtitle')} icon={<Gift className="h-5 w-5" />} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockBonusRules.map((rule) => {
          const Icon = iconMap[rule.type];
          return (
            <div key={rule.id} className="card-glow flex h-full flex-col p-6">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grad-gold text-base-deep shadow-glow-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <span className={cssStatus(rule.status)}>{rule.status === 'active' ? 'Live' : 'Paused'}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink-hi">{tags[rule.type]}</h3>
              <p className="mt-1 text-sm text-ink-mid">{rule.description}</p>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-ink-lo">Rate</dt>
                  <dd className="mt-1 font-semibold text-ink-hi">
                    {rule.percentage > 0 ? `${rule.percentage}%` : formatBDT(rule.amount)}
                  </dd>
                </div>
                <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-ink-lo">Min Deposit</dt>
                  <dd className="mt-1 font-semibold text-ink-hi">{formatBDT(rule.minDeposit)}</dd>
                </div>
                <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3 col-span-2">
                  <dt className="text-[11px] uppercase tracking-wider text-ink-lo">Max Bonus</dt>
                  <dd className="mt-1 font-semibold text-gradient-gold">{rule.maxBonus ? formatBDT(rule.maxBonus) : 'No cap'}</dd>
                </div>
              </dl>

              <button className="mt-5 btn-gold inline-flex h-10 items-center justify-center rounded-xl font-semibold">
                Claim
              </button>
            </div>
          );
        })}
      </div>

      <section className="card-glow mt-10 p-6">
        <h2 className="text-lg font-semibold text-ink-hi">{t('promotions.termsTitle')}</h2>
        <p className="mt-2 text-sm text-ink-mid">{t('promotions.termsBody')}</p>
      </section>
    </>
  );
}

function cssStatus(status: 'active' | 'paused') {
  return status === 'active'
    ? 'inline-flex items-center gap-1 rounded-md border border-neon/30 bg-neon/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neon'
    : 'inline-flex items-center gap-1 rounded-md border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gold-300';
}
