'use client';

import { HeroSlider } from '@/components/site/HeroSlider';
import { GameSection } from '@/components/site/GameSection';
import { PromoTicker } from '@/components/site/PromoTicker';
import { JackpotTicker } from '@/components/site/JackpotTicker';
import { mockGames } from '@/lib/mock/games';
import { useT } from '@/lib/i18n/context';
import { Cherry, Flame, Fish, Tv2 } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';

export default function HomePage() {
  const t = useT();
  const featured = mockGames.filter((g) => g.isFeatured).slice(0, 12);
  const slots = mockGames.filter((g) => g.categoryId === 'c_slots');
  const live = mockGames.filter((g) => g.categoryId === 'c_live');
  const fish = mockGames.filter((g) => g.categoryId === 'c_fish');

  return (
    <div className="space-y-10">
      <HeroSlider />

      <div className="grid gap-3 md:grid-cols-3">
        <JackpotTicker />
        <div className="md:col-span-2">
          <PromoTicker />
        </div>
      </div>

      <GameSection title={t('home.sectionHot')} description={t('home.sectionHotDesc')} games={featured} icon={Flame} href={ROUTES.games} />
      <GameSection title={t('home.sectionSlots')} description={t('home.sectionSlotsDesc')} games={slots} icon={Cherry} href={ROUTES.slots} />
      <GameSection title={t('home.sectionLive')} description={t('home.sectionLiveDesc')} games={live} icon={Tv2} href={ROUTES.liveCasino} />
      <GameSection title={t('home.sectionFish')} description={t('home.sectionFishDesc')} games={fish} icon={Fish} href={ROUTES.fishing} />

      <PromoStrip />
    </div>
  );
}

function PromoStrip() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Link href="/promotions" className="card-glow group p-6 transition hover:-translate-y-0.5">
        <p className="text-xs uppercase tracking-wider text-gold-300">First Deposit</p>
        <h3 className="mt-1 text-xl font-bold text-ink-hi">100% Match Bonus</h3>
        <p className="mt-2 text-sm text-ink-mid">Start with 500 BDT, claim up to 10,000 BDT free play.</p>
        <span className="mt-3 inline-block text-sm text-neon group-hover:translate-x-1 transition">Claim now →</span>
      </Link>
      <Link href="/referral" className="card-glow group p-6 transition hover:-translate-y-0.5">
        <p className="text-xs uppercase tracking-wider text-gold-300">Referral</p>
        <h3 className="mt-1 text-xl font-bold text-ink-hi">3-Level Commission</h3>
        <p className="mt-2 text-sm text-ink-mid">Earn 8 / 4 / 2 percent across your network, payouts daily.</p>
        <span className="mt-3 inline-block text-sm text-neon group-hover:translate-x-1 transition">Share now →</span>
      </Link>
      <Link href="/promotions" className="card-glow group p-6 transition hover:-translate-y-0.5">
        <p className="text-xs uppercase tracking-wider text-gold-300">VIP</p>
        <h3 className="mt-1 text-xl font-bold text-ink-hi">Royal VIP Rewards</h3>
        <p className="mt-2 text-sm text-ink-mid">Hit the VIP tier and unlock a flat 5,000 BDT credit.</p>
        <span className="mt-3 inline-block text-sm text-neon group-hover:translate-x-1 transition">See tiers →</span>
      </Link>
    </section>
  );
}
