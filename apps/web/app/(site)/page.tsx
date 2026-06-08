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
import { AmbassadorVideoSection } from '@/components/site/AmbassadorVideoSection';
import { HomepageVideoCarousel, type VideoRow } from '@/components/site/HomepageVideoCarousel';
import { PromoPair } from '@/components/site/PromoPair';
import { AppDownloadSection } from '@/components/site/AppDownloadSection';
import { HomeDbGameSection } from '@/components/site/HomeDbGameSection';
import { SportsbookSection } from '@/components/site/SportsbookSection';
import type { HomeSection } from '@/lib/homepage/sections';
import type { HomeBlock } from '@/lib/homepage/blocks';

// Section keys that the page handles via marker placeholders (no game
// grid). Strip sections fall through to <HomeDbGameSection>. The
// chrome insertions below sit between strips at predictable anchor
// keys so the operator can hide a strip without breaking layout.
const MARKER_SECTIONS = new Set(['homepage_brand', 'homepage_video', 'homepage_upcoming']);

function blockToSection(b: HomeBlock): HomeSection {
  const iconKey = b.sourceType === 'jackpot' ? 'sparkles'
    : b.sourceType === 'category' ? 'cherry'
    : b.sourceType === 'brand' ? 'sparkles'
    : b.sourceType === 'featured' ? 'flame'
    : 'sparkles';
  return {
    id: `block:${b.id}`,
    key: `block:${b.key}`,
    group: 'homepage',
    titleEn: b.titleEn,
    titleBn: b.titleBn,
    subtitleEn: b.subtitleEn,
    subtitleBn: b.subtitleBn,
    position: b.position,
    isVisible: true,
    layout: b.layout,
    iconKey,
    iconImageUrl: null,
    href: b.href,
    games: b.games,
  };
}

export default function HomePage() {
  const [sections, setSections] = useState<HomeSection[] | null>(null);
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/homepage-sections', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setSections(Array.isArray(j?.sections) ? (j.sections as HomeSection[]) : []);
        setBlocks(Array.isArray(j?.blocks) ? (j.blocks as HomeBlock[]) : []);
      })
      .catch(() => { if (alive) { setSections([]); setBlocks([]); } });

    fetch('/api/content/homepage-videos', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setVideos(Array.isArray(j?.videos) ? (j.videos as VideoRow[]) : []);
      })
      .catch(() => { if (alive) setVideos([]); });

    return () => { alive = false; };
  }, []);

  const stripSections = (sections ?? []).filter((s) => !MARKER_SECTIONS.has(s.key));
  const ambassadorSection = (sections ?? []).find((s) => s.key === 'homepage_video');
  const blockSections = blocks.map(blockToSection);

  return (
    <div className="space-y-6">
      <HeroSlider />

      <WalletStrip />

      <CategorySlider />

      <PromoTicker />

      <JackpotStrip />

      {/* Pasha Originals (HomeNativeGamesSection) is intentionally
          gated behind the native_games_public_enabled SystemSetting
          flag and OFF by default. Operator flips it on once real
          custom games are ready. Admin tooling at /admin/native-games
          stays available unchanged. */}

      {/* ProviderGamesSection intentionally removed from the homepage.
          Operators curate the visible homepage_hot strip from
          /admin/homepage-sections; the per-provider catalog stays
          reachable via the games lobby. */}

      {/* DB-driven strip sections. Every strip pulls from real
          ExternalGame rows via the section assembler in
          lib/homepage/sections.ts. A strip auto-hides when it has no
          matching games; we never fall back to mock placeholders. */}
      {stripSections.slice(0, 3).map((s) => (
        s.key === 'homepage_sportsbook'
          ? <SportsbookSection key={s.id} section={s} />
          : <HomeDbGameSection key={s.id} section={s} />
      ))}

      {ambassadorSection?.isVisible !== false ? (
        videos.length > 0 ? (
          <HomepageVideoCarousel videos={videos} />
        ) : (
          <AmbassadorVideoSection />
        )
      ) : null}

      {stripSections.slice(3).map((s) => (
        s.key === 'homepage_sportsbook'
          ? <SportsbookSection key={s.id} section={s} />
          : <HomeDbGameSection key={s.id} section={s} />
      ))}

      {blockSections.map((s) => (
        <HomeDbGameSection key={s.id} section={s} />
      ))}

      <PromoPair />

      <AppDownloadSection />

      <AnnouncementPopup />
      <FirstVisitAuthPopup />
    </div>
  );
}
