// Built by Anointed Coder.
'use client';

import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useT, useLang } from '@/lib/i18n/context';
import { Crown, Lock, Star, Zap, Gift } from 'lucide-react';

const TIERS = [
  { level: 1, name: 'Bronze', need: '500 BDT deposited', perks: ['1.0% deposit bonus', 'Weekly free spin'] },
  { level: 2, name: 'Silver', need: '5,000 BDT wagered', perks: ['2.0% deposit bonus', '50 free spins each week', 'Birthday gift'] },
  { level: 3, name: 'Gold', need: '25,000 BDT wagered', perks: ['3.5% deposit bonus', '150 free spins each week', 'Dedicated support'] },
  { level: 4, name: 'Platinum', need: '100,000 BDT wagered', perks: ['Custom cashback', 'VIP host', 'Exclusive tournaments'] },
];

export default function BettingPassPage() {
  const t = useT();
  const { lang } = useLang();

  return (
    <div className="space-y-6">
      <CategoryHero
        kicker={t('bp.title')}
        title={t('bp.title')}
        description={t('bp.subtitle')}
        accent="blue"
      />

      <section className="grid gap-3 md:grid-cols-3">
        <KpiCard icon={<Crown className="h-5 w-5" />} title={lang === 'bn' ? 'বর্তমান স্তর' : 'Current tier'} value={lang === 'bn' ? 'এখনো নেই' : 'Not yet'} />
        <KpiCard icon={<Star className="h-5 w-5" />} title={lang === 'bn' ? 'পাস পয়েন্ট' : 'Pass points'} value="0" />
        <KpiCard icon={<Zap className="h-5 w-5" />} title={lang === 'bn' ? 'পরবর্তী রিওয়ার্ড' : 'Next reward'} value={lang === 'bn' ? 'ব্রোঞ্জ' : 'Bronze'} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <article key={tier.level} className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-blue-500 to-brand-blue-700 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <Crown className="h-7 w-7 text-brand-yellow-400" />
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/80">
                  {lang === 'bn' ? `স্তর ${tier.level}` : `Tier ${tier.level}`}
                </p>
                <p className="text-xl font-extrabold">{tier.name}</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">
                {lang === 'bn' ? 'প্রয়োজন' : 'Requirement'}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-brand-ink">{tier.need}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-brand-inkSoft">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <Gift className="h-3.5 w-3.5 text-brand-yellow-600" /> {perk}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section className="card-light p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="inline-flex items-center gap-2 text-sm text-brand-inkSoft">
            <Lock className="h-4 w-4 text-brand-yellow-700" /> {t('bp.comingSoon')}
          </p>
          <Link href="/?signup=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-5 text-sm">
            {lang === 'bn' ? 'এখনই রেজিস্টার' : 'Register and start'}
          </Link>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="card-light flex items-center gap-3 px-4 py-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue-500/15 text-brand-blue-700">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">{title}</p>
        <p className="text-base font-extrabold text-brand-ink">{value}</p>
      </div>
    </div>
  );
}
