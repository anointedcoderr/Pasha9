// Built by Anointed Coder.
//
// HomeGameSection: one admin-curated homepage strip, ported from the web
// HomeDbGameSection (apps/web/components/site/HomeDbGameSection.tsx). Renders
// the section header (a gold gradient icon chip from section.iconKey / an
// uploaded iconImageUrl, the title with a gold accent bar, an optional
// subtitle, and a bordered "View All" pill) over the section's games.
//
// The games render as HomeGameTile in the layout the section asks for: a
// horizontal rail when section.layout reads as a rail/carousel, otherwise the
// web-parity 3-column grid. One useGameLaunch() instance is created here,
// shared to every tile through HomeLaunchContext, and surfaced once by a single
// GameLaunchNotice, so every launch shows the same auth / deposit / error gate.
//
// Auto-hides when the section carries no games (matches the web `return null`).

import { useWindowDimensions, View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Play,
  Sparkles,
  Flame,
  Cherry,
  Tv2,
  Fish,
  Zap,
  Ticket,
  Calendar,
  type LucideIcon,
} from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useGameLaunch } from '@/app/games/_components/useGameLaunch';
import { GameLaunchNotice } from '@/app/games/_components/GameLaunchNotice';
import { HomeGameTile, HomeLaunchContext } from './HomeGameTile';
import type { HomeSection } from '@/lib/api/homepage-types';

// section.iconKey -> lucide glyph, mirroring the web ICON_MAP 1:1.
const ICON_MAP: Record<string, LucideIcon> = {
  flame: Flame,
  cherry: Cherry,
  tv: Tv2,
  fish: Fish,
  zap: Zap,
  ticket: Ticket,
  sparkles: Sparkles,
  play: Play,
  calendar: Calendar,
};

// Gold section-chip gradient (web from-amber-300 to-amber-500) + its ink text.
const CHIP_GRADIENT = ['#FCD34D', '#F59E0B'] as const;
const CHIP_INK = '#3A1F00';

// Layout hints that request a horizontal rail instead of the default grid.
const RAIL_LAYOUTS = new Set(['rail', 'carousel', 'horizontal', 'scroll', 'row', 'slider']);

const GRID_GAP = 8;
const RAIL_TILE_W = 116;

export function HomeGameSection({ section }: { section: HomeSection }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const launcher = useGameLaunch();

  // Auto-hide: an empty strip renders nothing, exactly like the web component.
  if (section.games.length === 0) return null;

  const Icon = ICON_MAP[section.iconKey] ?? Sparkles;
  const isRail = section.layout != null && RAIL_LAYOUTS.has(section.layout.toLowerCase());
  // 3 columns inside the Screen's px-4 (32px), two inner gaps between tiles.
  const gridTileW = (width - 32 - GRID_GAP * 2) / 3;

  return (
    <HomeLaunchContext.Provider value={launcher}>
      <View className="gap-3">
        {/* Header: gold chip + title + accent bar + subtitle + View All pill. */}
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <Gradient colors={CHIP_GRADIENT} radius={12} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
              {section.iconImageUrl ? (
                <Image
                  source={{ uri: section.iconImageUrl }}
                  style={{ width: '100%', height: '100%', padding: 6 }}
                  contentFit="contain"
                />
              ) : (
                <Icon size={16} color={CHIP_INK} strokeWidth={2.25} />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="shrink text-lg font-extrabold text-brand-ink" numberOfLines={1}>
                  {section.titleEn || section.titleBn || 'Games'}
                </Text>
                <View className="h-[2px] w-10 overflow-hidden rounded-full">
                  <Gradient colors={['rgba(255,204,0,0.8)', 'rgba(255,204,0,0)']} />
                </View>
              </View>
              {section.subtitleEn ? (
                <Text className="text-xs text-brand-inkMute" numberOfLines={1}>
                  {section.subtitleEn}
                </Text>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={() => router.push(section.href as never)}
            className="h-9 flex-row items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 active:opacity-80"
          >
            <Text className="text-xs font-bold uppercase tracking-wider text-brand-ink">View All</Text>
            <ChevronRight size={14} color={colors.ink} strokeWidth={2.25} />
          </Pressable>
        </View>

        {/* Games. */}
        {isRail ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: GRID_GAP, paddingRight: GRID_GAP }}
          >
            {section.games.map((g) => (
              <View key={g.key} style={{ width: RAIL_TILE_W }}>
                <HomeGameTile game={g} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
            {section.games.map((g) => (
              <View key={g.key} style={{ width: gridTileW }}>
                <HomeGameTile game={g} />
              </View>
            ))}
          </View>
        )}

        {/* Shared launch gate: one notice for every tile in this strip. */}
        <GameLaunchNotice launch={launcher} />
      </View>
    </HomeLaunchContext.Provider>
  );
}
