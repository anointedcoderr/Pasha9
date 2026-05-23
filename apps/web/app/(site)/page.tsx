// Built by Anointed Coder.
'use client';

import { Flame, Cherry, Tv2, Fish, Zap, Ticket } from 'lucide-react';
import { HeroSlider } from '@/components/site/HeroSlider';
import { AnnouncementPopup } from '@/components/site/AnnouncementPopup';
import { FirstVisitAuthPopup } from '@/components/site/FirstVisitAuthPopup';
import { PromoTicker } from '@/components/site/PromoTicker';
import { JackpotStrip } from '@/components/site/JackpotStrip';
import { WalletStrip } from '@/components/site/WalletStrip';
import { CategorySlider } from '@/components/site/CategorySlider';
import { HomeGameSection } from '@/components/site/HomeGameSection';
import { AmbassadorVideoSection } from '@/components/site/AmbassadorVideoSection';
import { SportsCardsCarousel } from '@/components/site/SportsCardsCarousel';
import { PromoPair } from '@/components/site/PromoPair';
import { AppDownloadSection } from '@/components/site/AppDownloadSection';
import { mockGames } from '@/lib/mock/games';
import { useT } from '@/lib/i18n/context';
import { ROUTES } from '@/lib/constants/routes';

export default function HomePage() {
  const t = useT();

  const featured = mockGames.filter((g) => g.isFeatured).slice(0, 12);
  const slots = mockGames.filter((g) => g.categoryId === 'c_slots');
  const live = mockGames.filter((g) => g.categoryId === 'c_live');
  const fish = mockGames.filter((g) => g.categoryId === 'c_fish');
  // Map placeholder crash/lotto rails from existing seeded games until those
  // categories ship their own catalog.
  const crash = mockGames.filter((g) => ['c_hot', 'c_slots'].includes(g.categoryId)).slice(0, 12);
  const lotto = mockGames.filter((g) => g.categoryId === 'c_lottery');

  return (
    <div className="space-y-6">
      <HeroSlider />

      <WalletStrip />

      <CategorySlider />

      <PromoTicker />

      <JackpotStrip />

      <HomeGameSection
        title={t('home.sectionHot')}
        description={t('home.sectionHotDesc')}
        games={featured}
        icon={Flame}
        href={ROUTES.games}
        featuredMarker="hot"
      />

      <HomeGameSection
        title={t('home.sectionSlots')}
        description={t('home.sectionSlotsDesc')}
        games={slots}
        icon={Cherry}
        href={ROUTES.slots}
      />

      <HomeGameSection
        title={t('home.sectionLive')}
        description={t('home.sectionLiveDesc')}
        games={live}
        icon={Tv2}
        href={ROUTES.liveCasino}
      />

      <AmbassadorVideoSection />

      <SportsCardsCarousel />

      <HomeGameSection
        title={t('home.sectionFish')}
        description={t('home.sectionFishDesc')}
        games={fish}
        icon={Fish}
        href={ROUTES.fishing}
      />

      <HomeGameSection
        title={t('home.sectionCrash')}
        description={t('home.sectionCrashDesc')}
        games={crash}
        icon={Zap}
        href="/games/crash"
        featuredMarker="new"
      />

      <HomeGameSection
        title={t('home.sectionLotto')}
        description={t('home.sectionLottoDesc')}
        games={lotto}
        icon={Ticket}
        href="/lotto"
        featuredMarker="new"
      />

      <PromoPair />

      <AppDownloadSection />

      <AnnouncementPopup />
      <FirstVisitAuthPopup />
    </div>
  );
}
