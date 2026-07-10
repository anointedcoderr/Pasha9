// Built by Anointed Coder.
//
// Dynamic category grid: reads the route param (e.g. /games/casino) and shows
// a titled, responsive GameTile grid with a light sort chip row. Data is
// local mock; the title is derived from the param.

import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, GameTile, ChipToggle, SectionHeader } from '@/components/ui';
import { formatBDT, titleCase } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import type { Game } from '@/lib/mock/games';

function tile(seed: string): string {
  return `https://picsum.photos/seed/${seed}/300/300`;
}

const POOL: Game[] = [
  { id: 'cat_1', name: 'Crazy Time', provider: 'Evolution', imageUrl: tile('cat-crazy'), isHot: true },
  { id: 'cat_2', name: 'Lightning Roulette', provider: 'Evolution', imageUrl: tile('cat-lightning') },
  { id: 'cat_3', name: 'Speed Baccarat', provider: 'Evolution', imageUrl: tile('cat-baccarat') },
  { id: 'cat_4', name: 'Dragon Tiger', provider: 'Evolution', imageUrl: tile('cat-dragon'), isNew: true },
  { id: 'cat_5', name: 'Blackjack VIP', provider: 'Evolution', imageUrl: tile('cat-blackjack') },
  { id: 'cat_6', name: 'Mega Wheel', provider: 'Pragmatic', imageUrl: tile('cat-wheel'), isHot: true },
  { id: 'cat_7', name: 'Sweet Bonanza', provider: 'Pragmatic', imageUrl: tile('cat-sweet') },
  { id: 'cat_8', name: 'Gates of Olympus', provider: 'Pragmatic', imageUrl: tile('cat-gates'), isHot: true },
  { id: 'cat_9', name: 'Aviator', provider: 'Spribe', imageUrl: tile('cat-aviator'), isHot: true },
  { id: 'cat_10', name: 'Mines', provider: 'Spribe', imageUrl: tile('cat-mines'), isNew: true },
  { id: 'cat_11', name: 'Plinko', provider: 'Spribe', imageUrl: tile('cat-plinko') },
  { id: 'cat_12', name: 'Fortune Tiger', provider: 'PG Soft', imageUrl: tile('cat-tiger') },
  { id: 'cat_13', name: 'Mahjong Ways', provider: 'PG Soft', imageUrl: tile('cat-mahjong'), isNew: true },
  { id: 'cat_14', name: 'Super Ace', provider: 'JILI', imageUrl: tile('cat-superace'), isHot: true },
  { id: 'cat_15', name: 'Boxing King', provider: 'JILI', imageUrl: tile('cat-boxing') },
  { id: 'cat_16', name: 'Buffalo Blitz', provider: 'Playtech', imageUrl: tile('cat-buffalo') },
  { id: 'cat_17', name: 'Big Bass Bonanza', provider: 'Pragmatic', imageUrl: tile('cat-bass'), isNew: true },
  { id: 'cat_18', name: 'Fortune Ox', provider: 'PG Soft', imageUrl: tile('cat-ox') },
];

const SORTS = [
  { key: 'popular', label: 'Popular' },
  { key: 'new', label: 'New' },
  { key: 'az', label: 'A to Z' },
];

export default function CategoryScreen() {
  const { width } = useWindowDimensions();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [sort, setSort] = useState('popular');

  const heading = category ? titleCase(category) : 'Games';

  const games = useMemo(() => {
    const list = [...POOL];
    if (sort === 'az') return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'new') return list.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
    return list.sort((a, b) => Number(Boolean(b.isHot)) - Number(Boolean(a.isHot)));
  }, [sort]);

  const cols = width >= 720 ? 5 : width >= 520 ? 4 : 3;
  const GAP = 10;
  const tileW = (width - 32 - GAP * (cols - 1)) / cols;

  return (
    <Screen header={<LobbyHeader title={heading} count={games.length} />} contentClassName="px-4 pt-3 gap-4">
      <SectionHeader title={heading} subtitle="Hand picked for you" icon="grid" />

      <ChipToggle options={SORTS} value={sort} onChange={setSort} scroll />

      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {games.map((g) => (
          <View key={g.id} style={{ width: tileW }}>
            <GameTile game={g} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

function LobbyHeader({ title, count }: { title: string; count: number }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between border-b border-divider bg-paper px-3 py-2.5">
      <View className="flex-row items-center gap-1.5">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View>
          <Text className="text-base font-black tracking-tight text-ink">{title}</Text>
          <Text className="text-[11px] text-ink-mute">{count} games</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-1 rounded-pill border border-gold-600/30 bg-gold-500/15 py-1.5 pl-2 pr-1.5">
        <Ionicons name="wallet" size={14} color={colors.gold700} />
        <Text className="text-[11px] font-black text-ink">{formatBDT(mockWallet.balance)}</Text>
        <View className="h-5 w-5 items-center justify-center rounded-full bg-gold-500">
          <Ionicons name="add" size={14} color={colors.ink} />
        </View>
      </View>
    </View>
  );
}
