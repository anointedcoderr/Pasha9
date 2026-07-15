// Built by Anointed Coder.
//
// Home: the player home screen, rebuilt to mirror the website homepage
// (apps/web/app/(site)/page.tsx) section for section. Every block is a
// self-fetching component under components/home that renders its own live
// content and hides itself while loading, on error, or when empty, so the
// screen never shows mock data.
//
// Render order, matching the web page exactly:
//   HomeHero, WalletStrip, CategoryStrip, PromoTicker, JackpotStrip, the first
//   three live game strips, the ambassador / video block, the remaining live
//   strips, the custom blocks, then PromoPair. The web page's app-download
//   section is intentionally dropped here: prompting a download inside the
//   app itself makes no sense.
//
// A strip whose key is homepage_sportsbook renders the fixtures rail plus the
// sportsbook section instead of a normal game grid, exactly like the web. The
// three marker sections (homepage_brand / homepage_video / homepage_upcoming)
// carry no game grid and are filtered out of the strip list; homepage_video
// only decides whether the ambassador / video block is shown.

import { View } from 'react-native';
import { Screen } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { HomeHero } from '@/components/home/HomeHero';
import { WalletStrip } from '@/components/home/WalletStrip';
import { CategoryStrip } from '@/components/home/CategoryStrip';
import { PromoTicker } from '@/components/home/PromoTicker';
import { JackpotStrip } from '@/components/home/JackpotStrip';
import { HomeGameSection } from '@/components/home/HomeGameSection';
import { SportsFixturesCarousel } from '@/components/home/SportsFixturesCarousel';
import { SportsbookSection } from '@/components/home/SportsbookSection';
import { HomepageVideoCarousel } from '@/components/home/HomepageVideoCarousel';
import { AmbassadorVideoSection } from '@/components/home/AmbassadorVideoSection';
import { PromoPair } from '@/components/home/PromoPair';
import { useHomepageSections, useHomepageVideos } from '@/lib/api/homepage';
import type { HomeBlock, HomeSection } from '@/lib/api/homepage-types';

// Section keys the web page handles via marker placeholders (no game grid):
// they are filtered out of the strip list. homepage_video additionally gates
// the ambassador / video block below.
const MARKER_SECTIONS = new Set(['homepage_brand', 'homepage_video', 'homepage_upcoming']);

// Port of the web page's blockToSection: adapts a custom HomeBlock into a
// HomeSection so it renders through the same HomeGameSection strip.
function blockToSection(b: HomeBlock): HomeSection {
  const iconKey =
    b.sourceType === 'jackpot'
      ? 'sparkles'
      : b.sourceType === 'category'
        ? 'cherry'
        : b.sourceType === 'brand'
          ? 'sparkles'
          : b.sourceType === 'featured'
            ? 'flame'
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

// One live strip. The sportsbook key becomes the fixtures rail + sportsbook
// section (wrapped so the pair keeps the page's vertical rhythm); every other
// key is a normal game grid.
function StripSection({ section }: { section: HomeSection }) {
  if (section.key === 'homepage_sportsbook') {
    return (
      <View className="gap-5">
        <SportsFixturesCarousel />
        <SportsbookSection section={section} />
      </View>
    );
  }
  return <HomeGameSection section={section} />;
}

export default function HomeScreen() {
  const { data } = useHomepageSections();
  const sections = data?.sections ?? [];
  const blocks = data?.blocks ?? [];

  // Videos win over the ambassador fallback, mirroring the web page. This share
  // the same query as HomepageVideoCarousel, so react-query dedupes the fetch.
  const { data: videoData } = useHomepageVideos();
  const hasVideos = (videoData ?? []).length > 0;

  const stripSections = sections.filter((s) => !MARKER_SECTIONS.has(s.key));
  const ambassadorSection = sections.find((s) => s.key === 'homepage_video');
  const showAmbassadorBlock = ambassadorSection?.isVisible !== false;
  const blockSections = blocks.map(blockToSection);

  return (
    <Screen header={<AppHeader />} contentClassName="gap-5">
      <HomeHero />

      <WalletStrip />

      <CategoryStrip />

      <PromoTicker />

      <JackpotStrip />

      {/* The first three live game strips. */}
      {stripSections.slice(0, 3).map((s) => (
        <StripSection key={s.id} section={s} />
      ))}

      {/* Ambassador / video block: prefer the live video deck, else the
          ambassador card. Both self-hide when empty, and the pair is gated on
          the homepage_video marker's visibility exactly like the web. */}
      {showAmbassadorBlock ? (
        hasVideos ? <HomepageVideoCarousel /> : <AmbassadorVideoSection />
      ) : null}

      {/* The remaining live game strips. */}
      {stripSections.slice(3).map((s) => (
        <StripSection key={s.id} section={s} />
      ))}

      {/* Custom homepage blocks, rendered through the same strip component. */}
      {blockSections.map((s) => (
        <HomeGameSection key={s.id} section={s} />
      ))}

      <PromoPair />
    </Screen>
  );
}
