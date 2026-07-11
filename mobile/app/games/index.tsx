// Built by Anointed Coder.
//
// Games lobby. Mirrors the web /games landing surface, adapted for a phone:
//   AppHeader -> a search entry that opens the provider grid -> category chips
//   that route into the grid -> a prominent Pasha WinGo hero -> Pasha Originals
//   native-game tiles -> a real provider brand strip -> a real featured/hot
//   provider games strip. Tapping a provider game runs the shared launch
//   handler (auth-gate + money-gate + in-app browser).
//
// The Pasha Originals + WinGo sections stay in-house; only the provider brand
// strip and the games grid are now wired to the live aggregator catalog.

import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, SectionHeader, GameTile, Pill, Gradient, Badge } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { colors, gradients } from '@/lib/theme';
import { useWingoState, useProviders, useProviderGames } from '@/lib/api/hooks';
import type { ProviderGame } from '@/lib/api/providers';
import type { Game } from '@/lib/mock/games';
import { cn } from '@/lib/cn';
import { WingoBall } from './_components/WingoBall';
import { useGameLaunch } from './_components/useGameLaunch';
import { GameLaunchNotice } from './_components/GameLaunchNotice';

type IconName = keyof typeof Ionicons.glyphMap;

// Category chips route into the provider grid with a deep-link filter (web
// parity). Hot maps to the featured flag; the rest to a category slug.
const CATEGORIES: Array<{ key: string; label: string; href: string }> = [
  { key: 'hot', label: 'Hot', href: '/games/provider?featured=1' },
  { key: 'slots', label: 'Slots', href: '/games/provider?category=slots' },
  { key: 'live_casino', label: 'Live Casino', href: '/games/provider?category=live_casino' },
  { key: 'table', label: 'Table', href: '/games/provider?category=table' },
  { key: 'fishing', label: 'Fishing', href: '/games/provider?category=fishing' },
  { key: 'crash', label: 'Crash', href: '/games/provider?category=crash' },
  { key: 'sportsbook', label: 'Sports', href: '/games/provider?category=sportsbook' },
];

// In-house native games. WinGo routes to its real screen; the rest route to
// their wired native-game screens.
interface Original {
  key: string;
  name: string;
  icon: IconName;
  grad: readonly string[];
  route: string;
  tag?: 'HOT' | 'NEW';
}

const ORIGINALS: Original[] = [
  { key: 'wingo', name: 'WinGo', icon: 'color-palette', grad: ['#ffe08a', '#f5b400', '#a15c0a'], route: '/games/wingo', tag: 'HOT' },
  { key: 'dice', name: 'Dice', icon: 'dice', grad: ['#7cc9ff', '#2f8fe0', '#0a4a8f'], route: '/games/dice' },
  { key: 'mines', name: 'Mines', icon: 'diamond', grad: ['#5cf3bf', '#13c98d', '#054f34'], route: '/games/mines' },
  { key: 'crash', name: 'Crash', icon: 'trending-up', grad: ['#ff8090', '#ec394d', '#6f0c1c'], route: '/games/crash' },
  { key: 'keno', name: 'Keno', icon: 'grid', grad: ['#fbbf6b', '#f97316', '#7c2d12'], route: '/games/keno' },
  { key: 'roulette', name: 'Roulette', icon: 'ellipse', grad: ['#f0abfc', '#c026d3', '#701a75'], route: '/games/roulette' },
];

function toTile(g: ProviderGame, providerName: string): Game {
  return {
    id: g.gameUid,
    name: g.displayName,
    provider: g.brandName ?? providerName,
    imageUrl: g.imageUrl ?? '',
    isHot: g.isFeatured,
    isNew: g.isJackpot,
  };
}

export default function GamesLobby() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Surface the real WinGo gate: if the game (or the 30s mode) is off, the
  // lobby greylists the WinGo surfaces instead of routing into a dead board.
  const wingoState = useWingoState('wingo_30s', false);
  const wingoDisabled = !!wingoState.data && (!wingoState.data.enabled || !wingoState.data.modeEnabled);

  // The main provider drives both the brand strip and the featured games strip.
  const providersQuery = useProviders();
  const mainProvider = providersQuery.data?.[0] ?? null;
  const providerKey = mainProvider?.providerKey ?? '';

  const featuredQuery = useProviderGames({ providerKey, featured: true, limit: 12 });
  const featuredPage = featuredQuery.data?.pages?.[0];
  const featuredGames = featuredPage?.games ?? [];
  const brands = featuredPage?.counts.byBrand ?? [];
  const providerName = featuredPage?.provider.name ?? mainProvider?.name ?? '';
  const launchMinBalance = featuredPage?.provider.launchMinBalance ?? mainProvider?.launchMinBalance ?? 0;

  const launcher = useGameLaunch();

  const GAP = 8;
  const tileW = (width - 32 - GAP * 2) / 3;
  // Featured strip tiles: a touch under half-width so a peek of the next tile
  // hints the row scrolls.
  const stripW = Math.min(150, (width - 32) * 0.42);

  const hasProviders = providersQuery.isSuccess && (providersQuery.data?.length ?? 0) > 0;

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      {/* Search entry: opens the real search in the provider grid. */}
      <Pressable
        onPress={() => router.push('/games/provider')}
        className="h-12 flex-row items-center gap-2 rounded-xl border border-divider bg-paper px-3 active:opacity-90"
      >
        <Ionicons name="search" size={18} color={colors.inkMute} />
        <Text className="text-base text-ink-mute">Search games, providers</Text>
      </Pressable>

      {/* Category chips route into the grid. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => router.push(c.href as never)}
            className="rounded-pill border border-divider bg-paper px-3.5 py-2 active:opacity-80"
          >
            <Text className="text-xs font-bold text-ink-soft">{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Prominent Pasha WinGo hero card */}
      <Pressable
        onPress={() => router.push('/games/wingo')}
        disabled={wingoDisabled}
        className={cn(
          'relative overflow-hidden rounded-2xl border border-gold-600/30',
          wingoDisabled ? 'opacity-60' : 'active:opacity-90',
        )}
      >
        <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View
          pointerEvents="none"
          className="absolute -right-6 -top-8 h-40 w-40 rounded-full"
          style={{ backgroundColor: 'rgba(245,208,97,0.14)' }}
        />
        <View className="flex-row items-center gap-3 p-4">
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Badge label="ORIGINAL" variant="gold" />
              <Badge label={wingoDisabled ? 'PAUSED' : 'LIVE'} variant={wingoDisabled ? 'neutral' : 'new'} />
            </View>
            <Text className="mt-2 text-lg font-black text-white">Pasha WinGo</Text>
            <Text className="mt-0.5 text-xs text-dink-mid">
              {wingoDisabled
                ? 'Temporarily unavailable. Please check back shortly.'
                : 'Predict the colour and number. New round every 30 seconds.'}
            </Text>
            {wingoDisabled ? (
              <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-pill border border-white/15 bg-white/5 px-4 py-2">
                <Ionicons name="pause-circle" size={13} color={colors.dinkLo} />
                <Text className="text-xs font-black uppercase tracking-wider text-dink-lo">Unavailable</Text>
              </View>
            ) : (
              <View className="mt-3 flex-row items-center gap-2 self-start overflow-hidden rounded-pill px-4 py-2">
                <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
                <Text className="text-xs font-black uppercase tracking-wider text-ink">Play now</Text>
                <Ionicons name="arrow-forward" size={13} color={colors.ink} />
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-1.5">
            {[7, 5, 2].map((n, i) => (
              <View key={n} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                <WingoBall n={n} size={40 - i * 3} />
              </View>
            ))}
          </View>
        </View>
      </Pressable>

      {/* Pasha Originals */}
      <View className="gap-3">
        <SectionHeader title="Pasha Originals" subtitle="In-house native games" icon="sparkles" />
        <View className="flex-row flex-wrap justify-between">
          {ORIGINALS.map((g) => {
            const tileDisabled = g.key === 'wingo' && wingoDisabled;
            return (
              <Pressable
                key={g.key}
                onPress={() => router.push(g.route as never)}
                disabled={tileDisabled}
                style={{ width: tileW, marginBottom: 12 }}
                className={cn(
                  'overflow-hidden rounded-2xl border border-white/10',
                  tileDisabled ? 'opacity-50' : 'active:opacity-90',
                )}
              >
                <View style={{ height: tileW * 0.82 }} className="relative items-center justify-center overflow-hidden">
                  <Gradient colors={g.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
                  <View
                    pointerEvents="none"
                    className="absolute inset-x-0 top-0 h-1/2"
                    style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
                  />
                  <Ionicons name={g.icon} size={32} color="#ffffff" />
                  {tileDisabled ? (
                    <View className="absolute left-1.5 top-1.5">
                      <Badge label="PAUSED" variant="neutral" />
                    </View>
                  ) : g.tag ? (
                    <View className="absolute left-1.5 top-1.5">
                      <Badge label={g.tag} variant={g.tag === 'HOT' ? 'hot' : 'new'} />
                    </View>
                  ) : null}
                </View>
                <View className="bg-darkbg px-2 py-2">
                  <Text className="text-xs font-bold text-white" numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text className="text-[10px] text-dink-lo">Pasha Originals</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Launch failure / deposit prompt (shared handler). */}
      <GameLaunchNotice launch={launcher} />

      {/* Real provider brand strip (from the main provider's byBrand counts). */}
      {hasProviders && brands.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeader title="Top Providers" subtitle="Trusted studios" icon="ribbon" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {brands.map((b) => (
              <Pressable
                key={b.brandKey}
                onPress={() =>
                  router.push(`/games/provider?brand=${encodeURIComponent(b.brandKey)}&providerKey=${encodeURIComponent(providerKey)}` as never)
                }
                className="active:opacity-80"
              >
                <Pill label={`${b.brandName} (${b.count})`} icon="business" tone="gold" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Real featured / hot provider games. */}
      {hasProviders ? (
        <View className="gap-3">
          <SectionHeader
            title="Hot Games"
            subtitle="Featured across our providers"
            icon="flame"
            onAction={() => router.push('/games/provider?featured=1')}
          />
          {featuredQuery.isLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GAP, paddingRight: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={{ width: stripW }}
                  className="aspect-square rounded-2xl border border-divider bg-surfaceAlt"
                />
              ))}
            </ScrollView>
          ) : featuredGames.length === 0 ? (
            <Text className="text-sm text-ink-mute">No featured games right now. Browse the full catalog.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GAP, paddingRight: 8 }}>
              {featuredGames.map((g) => {
                const key = `${providerKey}:${g.gameUid}`;
                const busy = launcher.launchingKey === key;
                return (
                  <View key={g.gameUid} style={{ width: stripW }} className="relative">
                    <GameTile
                      game={toTile(g, providerName)}
                      onPress={() =>
                        launcher.launch({ providerKey, gameUid: g.gameUid, displayName: g.displayName, launchMinBalance })
                      }
                    />
                    {busy ? (
                      <View className="absolute inset-x-0 top-0 aspect-square items-center justify-center rounded-2xl bg-black/45">
                        <Ionicons name="hourglass" size={20} color={colors.gold500} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}

      {/* Full catalog entry. */}
      {hasProviders ? (
        <Pressable
          onPress={() => router.push('/games/provider')}
          className="flex-row items-center justify-between rounded-2xl border border-divider bg-paper p-4 active:opacity-90"
        >
          <View>
            <Text className="text-sm font-black text-ink">All Provider Games</Text>
            <Text className="text-[11px] text-ink-mute">Slots, live casino, table, fishing and more</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.gold700} />
        </Pressable>
      ) : null}
    </Screen>
  );
}
