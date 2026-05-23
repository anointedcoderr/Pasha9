// Built by Anointed Coder.
'use client';

import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { useLang } from '@/lib/i18n/context';
import { Trophy, Lock, Gift, Calendar } from 'lucide-react';

export default function IplBettingPassPage() {
  const { lang } = useLang();
  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'আইপিএল ২০২৬ বেটিং পাস' : 'IPL 2026 Betting Pass'} />
      <CategoryHero
        kicker="IPL 2026"
        title={lang === 'bn' ? 'আইপিএল ২০২৬ বেটিং পাস' : 'IPL 2026 Betting Pass'}
        description={lang === 'bn' ? 'সিজনে বেট করুন, পয়েন্ট জমান, এক্সক্লুসিভ পুরস্কার জিতুন।' : 'Bet through the season, build pass points, unlock exclusive rewards.'}
        accent="red"
      />

      <section className="grid gap-3 md:grid-cols-3">
        <Card
          icon={<Calendar className="h-5 w-5" />}
          title={lang === 'bn' ? 'সিজন' : 'Season'}
          body={lang === 'bn' ? 'মার্চ থেকে মে ২০২৬, সকল ম্যাচে পয়েন্ট অর্জন করুন।' : 'March through May 2026, earn points on every match.'}
        />
        <Card
          icon={<Trophy className="h-5 w-5" />}
          title={lang === 'bn' ? 'বড় পুরস্কার' : 'Mega Prizes'}
          body={lang === 'bn' ? 'মোটরসাইকেল, স্মার্টফোন এবং ফ্রি বেট জিতুন।' : 'Motorbike, smartphone, free bets and more.'}
        />
        <Card
          icon={<Gift className="h-5 w-5" />}
          title={lang === 'bn' ? 'বোনাস' : 'Bonus'}
          body={lang === 'bn' ? 'প্রতিটি লেভেল আপ-এ বোনাস বেট আনলক হয়।' : 'Every level up unlocks a bonus bet drop.'}
        />
      </section>

      <section className="card-light p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="inline-flex items-center gap-2 text-sm text-brand-inkSoft">
            <Lock className="h-4 w-4 text-brand-yellow-700" />
            {lang === 'bn' ? 'আইপিএল ২০২৬ পাস ইঞ্জিন মাইলস্টোন ২-এ সংযুক্ত হবে।' : 'IPL 2026 pass engine connects in Milestone 2.'}
          </p>
          <Link href="/?signup=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-5 text-sm">
            {lang === 'bn' ? 'এখনই রেজিস্টার' : 'Register and start'}
          </Link>
        </div>
      </section>
    </div>
  );
}

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card-light px-5 py-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink">
        {icon}
      </span>
      <p className="mt-3 text-base font-extrabold text-brand-ink">{title}</p>
      <p className="mt-1 text-sm text-brand-inkSoft">{body}</p>
    </div>
  );
}
