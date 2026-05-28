// Built by Anointed Coder.
'use client';

import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Crown, Lock, ShieldCheck, Headphones, BadgePercent, Wallet } from 'lucide-react';

const PERKS = [
  { icon: BadgePercent, key: 'cashback' },
  { icon: Wallet, key: 'withdraw' },
  { icon: Headphones, key: 'support' },
  { icon: ShieldCheck, key: 'limits' },
];

const PERK_COPY: Record<string, { bn: { title: string; body: string }; en: { title: string; body: string } }> = {
  cashback: {
    bn: { title: 'কাস্টম ক্যাশব্যাক', body: 'মাসিক প্লে অনুযায়ী বিশেষ ক্যাশব্যাক হার।' },
    en: { title: 'Custom cashback', body: 'Personalised cashback rate based on monthly play.' },
  },
  withdraw: {
    bn: { title: 'দ্রুত উইথড্র', body: 'ভিআইপি অগ্রাধিকার অনুযায়ী দ্রুত পেআউট।' },
    en: { title: 'Faster withdrawals', body: 'VIP-priority payouts pushed ahead of the queue.' },
  },
  support: {
    bn: { title: 'বিশেষ সাপোর্ট', body: '২৪ ঘণ্টা VIP লাইন এবং নির্ধারিত অ্যাকাউন্ট ম্যানেজার।' },
    en: { title: 'Dedicated support', body: '24/7 VIP line with an assigned account manager.' },
  },
  limits: {
    bn: { title: 'বাড়তি সীমা', body: 'উচ্চতর ডিপোজিট এবং উইথড্র সীমা।' },
    en: { title: 'Raised limits', body: 'Higher deposit and withdrawal limits across methods.' },
  },
};

export default function VipPage() {
  const t = useT();
  const { lang } = useLang();
  return (
    <div className="space-y-6">
      <BackBar title={t('vip.title')} />
      <CategoryHero
        kicker="VIP"
        title={t('vip.title')}
        description={t('vip.subtitle')}
        accent="royal"
        category="vip"
        chips={[
          { label: 'Elite', tone: 'gold' },
          { label: 'Invite Only', tone: 'rose' },
          { label: 'Higher Limits', tone: 'sky' },
        ]}
      />

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {PERKS.map((p) => {
          const Icon = p.icon;
          const copy = PERK_COPY[p.key][lang];
          return (
            <article key={p.key} className="card-light px-5 py-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grad-yellow text-brand-ink">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-base font-extrabold text-brand-ink">{copy.title}</p>
              <p className="mt-1 text-sm text-brand-inkSoft">{copy.body}</p>
            </article>
          );
        })}
      </section>

      <section className="card-light p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-extrabold text-brand-ink">
                {lang === 'bn' ? 'ভিআইপি ক্লাবের জন্য আবেদন করুন' : 'Apply for the VIP Club'}
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm text-brand-inkSoft">
                <Lock className="h-4 w-4 text-brand-yellow-700" /> {t('vip.comingSoon')}
              </p>
            </div>
          </div>
          <Link href="/?signup=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-5 text-sm">
            {lang === 'bn' ? 'রেজিস্টার করুন' : 'Register to qualify'}
          </Link>
        </div>
      </section>
    </div>
  );
}
