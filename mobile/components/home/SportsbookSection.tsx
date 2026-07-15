// Built by Anointed Coder.
//
// SportsbookSection: the homepage sportsbook strip, ported from the web
// SportsbookSection (apps/web/components/site/SportsbookSection.tsx). Keeps the
// sportsbook's emerald visual language (an emerald Flag chip, an emerald accent
// bar and an "All sports" pill) and renders the section's games as HomeGameTile
// in a horizontal rail, reusing the same money-gated / auth-gated launch flow
// as every other strip.
//
// One useGameLaunch() instance is created here, shared to the tiles through
// HomeLaunchContext, and surfaced once by a single GameLaunchNotice.
// Auto-hides when the section carries no games.

import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Flag } from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { resolveHref } from '@/lib/nav';
import { useGameLaunch } from '@/app/games/_components/useGameLaunch';
import { GameLaunchNotice } from '@/app/games/_components/GameLaunchNotice';
import { HomeGameTile, HomeLaunchContext } from './HomeGameTile';
import type { HomeSection } from '@/lib/api/homepage-types';

// Emerald sportsbook chip (web from-emerald-400 to-emerald-600) + white icon.
const CHIP_GRADIENT = ['#34D399', '#059669'] as const;
const RAIL_TILE_W = 128;

export function SportsbookSection({ section }: { section: HomeSection }) {
  const router = useRouter();
  const launcher = useGameLaunch();

  // Auto-hide: an empty sportsbook strip renders nothing, like the web.
  if (section.games.length === 0) return null;

  return (
    <HomeLaunchContext.Provider value={launcher}>
      <View className="gap-3">
        {/* Header: emerald Flag chip + title + emerald accent bar + All sports. */}
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <Gradient colors={CHIP_GRADIENT} radius={12} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
              <Flag size={16} color="#FFFFFF" strokeWidth={2.25} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="shrink text-lg font-extrabold text-brand-ink" numberOfLines={1}>
                  {section.titleEn || section.titleBn || 'Sportsbook'}
                </Text>
                <View className="h-[2px] w-10 overflow-hidden rounded-full">
                  <Gradient colors={['rgba(16,185,129,0.8)', 'rgba(16,185,129,0)']} />
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
            onPress={() => router.push(resolveHref(section.href) as never)}
            className="h-9 flex-row items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 active:opacity-80"
          >
            <Text className="text-xs font-bold uppercase tracking-wider text-brand-ink">All sports</Text>
            <ChevronRight size={14} color="#059669" strokeWidth={2.25} />
          </Pressable>
        </View>

        {/* Games as a horizontal rail of tiles, reusing HomeGameTile. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {section.games.map((g) => (
            <View key={g.key} style={{ width: RAIL_TILE_W }}>
              <HomeGameTile game={g} />
            </View>
          ))}
        </ScrollView>

        {/* Shared launch gate: one notice for every tile in this strip. */}
        <GameLaunchNotice launch={launcher} />
      </View>
    </HomeLaunchContext.Provider>
  );
}
