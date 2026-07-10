// Built by Anointed Coder.
//
// Games lobby. Mirrors the web /games landing surface, adapted for a phone:
//   AppHeader -> search bar (visual) -> category chip row -> a prominent
//   Pasha WinGo hero card -> Pasha Originals native-game tiles -> provider
//   brand pills -> a responsive grid of provider game tiles from mock.
//
// Everything reads from lib/mock and composes the shared kit, following the
// Home screen pattern and quality.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, SectionHeader, GameTile, ChipToggle, TextField, Pill, Gradient, Badge } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { mockHotGames } from '@/lib/mock';
import { colors, gradients } from '@/lib/theme';
import { WingoBall } from './_components/WingoBall';

type IconName = keyof typeof Ionicons.glyphMap;

// Category filter chips (visual only). Defaults to Hot.
const CATEGORIES = [
  { key: 'hot', label: 'Hot' },
  { key: 'slots', label: 'Slots' },
  { key: 'live', label: 'Live Casino' },
  { key: 'table', label: 'Table' },
  { key: 'fishing', label: 'Fishing' },
  { key: 'crash', label: 'Crash' },
  { key: 'sports', label: 'Sports' },
];

// In-house native games. WinGo and Spin route to their real screens; the
// rest stay on the lobby until their screens ship in a later phase.
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
  { key: 'spin', name: 'Lucky Spin', icon: 'sync', grad: ['#d29bff', '#a855f7', '#4f1687'], route: '/games/spin', tag: 'NEW' },
  { key: 'dice', name: 'Dice', icon: 'dice', grad: ['#7cc9ff', '#2f8fe0', '#0a4a8f'], route: '/games/dice' },
  { key: 'mines', name: 'Mines', icon: 'diamond', grad: ['#5cf3bf', '#13c98d', '#054f34'], route: '/games/mines' },
  { key: 'crash', name: 'Crash', icon: 'trending-up', grad: ['#ff8090', '#ec394d', '#6f0c1c'], route: '/games/crash' },
  { key: 'keno', name: 'Keno', icon: 'grid', grad: ['#fbbf6b', '#f97316', '#7c2d12'], route: '/games/keno' },
  { key: 'roulette', name: 'Roulette', icon: 'ellipse', grad: ['#f0abfc', '#c026d3', '#701a75'], route: '/games/roulette' },
];

// Provider brand strip.
const PROVIDERS = ['JILI', 'PG Soft', 'JDB', 'Evolution', 'Pragmatic', 'Spribe', 'Playtech', 'Habanero'];

export default function GamesLobby() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [category, setCategory] = useState('hot');
  const [query, setQuery] = useState('');

  const GAP = 8;
  // Screen content uses px-4 (32) side padding; 3-col grid for both the
  // originals and the provider tiles.
  const tileW = (width - 32 - GAP * 2) / 3;

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      {/* Search (visual only) */}
      <TextField
        icon="search"
        placeholder="Search games, providers"
        value={query}
        onChangeText={setQuery}
      />

      {/* Category chips */}
      <ChipToggle options={CATEGORIES} value={category} onChange={setCategory} scroll />

      {/* Prominent Pasha WinGo hero card */}
      <Pressable
        onPress={() => router.push('/games/wingo')}
        className="relative overflow-hidden rounded-2xl border border-gold-600/30 active:opacity-90"
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
              <Badge label="LIVE" variant="new" />
            </View>
            <Text className="mt-2 text-lg font-black text-white">Pasha WinGo</Text>
            <Text className="mt-0.5 text-xs text-dink-mid">
              Predict the colour and number. New round every 30 seconds.
            </Text>
            <View className="mt-3 flex-row items-center gap-2 self-start overflow-hidden rounded-pill px-4 py-2">
              <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              <Text className="text-xs font-black uppercase tracking-wider text-ink">Play now</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.ink} />
            </View>
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
          {ORIGINALS.map((g) => (
            <Pressable
              key={g.key}
              onPress={() => router.push(g.route as never)}
              style={{ width: tileW, marginBottom: 12 }}
              className="overflow-hidden rounded-2xl border border-white/10 active:opacity-90"
            >
              <View style={{ height: tileW * 0.82 }} className="relative items-center justify-center overflow-hidden">
                <Gradient colors={g.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
                <View
                  pointerEvents="none"
                  className="absolute inset-x-0 top-0 h-1/2"
                  style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
                />
                <Ionicons name={g.icon} size={32} color="#ffffff" />
                {g.tag ? (
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
          ))}
        </View>
      </View>

      {/* Provider brand strip */}
      <View className="gap-2.5">
        <SectionHeader title="Top Providers" subtitle="Trusted studios" icon="ribbon" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {PROVIDERS.map((p) => (
            <Pill key={p} label={p} icon="business" tone="gold" />
          ))}
        </ScrollView>
      </View>

      {/* Provider games grid */}
      <View className="gap-3">
        <SectionHeader title="All Games" subtitle="Slots, live casino and more" icon="grid" />
        <View className="flex-row flex-wrap justify-between">
          {mockHotGames.map((game) => (
            <View key={game.id} style={{ width: tileW, marginBottom: 12 }}>
              <GameTile game={game} className="w-full" />
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
