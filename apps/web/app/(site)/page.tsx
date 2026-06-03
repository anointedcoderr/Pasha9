// Built by Anointed Coder.
//
// Public homepage. M4 Phase B: the game-section grid is now driven by
// PublicSection + HomepageFeaturedGame via /api/content/homepage-sections.
// HeroSlider, JackpotStrip, ProviderGamesSection and the other site
// chrome are unchanged and continue to fetch their own data.
//
// If the homepage-sections endpoint fails or returns an empty list we
// degrade silently: hero + jackpot + provider rail + chrome still
// render, so the page never goes blank.

'use client';

import { useEffect, useState } from 'react';
import { HeroSlider } from '@/components/site/HeroSlider';
import { AnnouncementPopup } from '@/components/site/AnnouncementPopup';
import { FirstVisitAuthPopup } from '@/components/site/FirstVisitAuthPopup';
import { PromoTicker } from '@/components/site/PromoTicker';
import { JackpotStrip } from '@/components/site/JackpotStrip';
import { WalletStrip } from '@/components/site/WalletStrip';
import { CategorySlider } from '@/components/site/CategorySlider';
import { HomeNativeGamesSection } from '@/components/site/HomeNativeGamesSection';
import { ProviderGamesSection } from '@/components/site/ProviderGamesSection';
import { AmbassadorVideoSection } from '@/components/site/AmbassadorVideoSection';
import { SportsCardsCarousel } from '@/components/site/SportsCardsCarousel';
import { PromoPair } from '@/components/site/PromoPair';
import { AppDownloadSection } from '@/components/site/AppDownloadSection';
import { HomeDbGameSection } from '@/components/site/HomeDbGameSection';
import type { HomeSection } from '@/lib/homepage/sections';

// Section keys that the page handles via marker placeholders (no game
// grid). Strip sections fall through to <HomeDbGameSection>. The
// chrome insertions below sit between strips at predictable anchor
// keys so the operator can hide a strip without breaking layout.
const MARKER_SECTIONS = new Set(['homepage_brand', 'homepage_video', 'homepage_upcoming']);

export default function HomePage() {
  const [sections, setSections] = useState<HomeSection[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/homepage-sections', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (Array.isArray(j?.sections)) setSections(j.sections as HomeSection[]);
        else setSections([]);
      })
      .catch(() => { if (alive) setSections([]); });
    return () => { alive = false; };
  }, []);

  const stripSections = (sections ?? []).filter((s) => !MARKER_SECTIONS.has(s.key));
  const ambassadorSection = (sections ?? []).find((s) => s.key === 'homepage_video');
  const upcomingSection = (sections ?? []).find((s) => s.key === 'homepage_upcoming');

  return (
    <div className="space-y-6">
      <HeroSlider />

      <WalletStrip />

      <CategorySlider />

      <PromoTicker />

      <JackpotStrip />

      <HomeNativeGamesSection />

      <ProviderGamesSection />

      {/* First half of the DB-driven strip sections. The operator orders
          them via PublicSection.position, so this maps order 1..N. */}
      {stripSections.slice(0, 3).map((s) => (
        <HomeDbGameSection key={s.id} section={s} />
      ))}

      {ambassadorSection?.isVisible !== false ? <AmbassadorVideoSection /> : null}

      <SportsCardsCarousel />

      {stripSections.slice(3).map((s) => (
        <HomeDbGameSection key={s.id} section={s} />
      ))}

      {upcomingSection?.isVisible ? (
        // upcoming-matches section is hidden by default; render the
        // sports carousel-style placeholder when the operator turns it
        // on so the heading still has matching content.
        <SportsCardsCarousel />
      ) : null}

      <PromoPair />

      <AppDownloadSection />

      <AnnouncementPopup />
      <FirstVisitAuthPopup />
    </div>
  );
}
