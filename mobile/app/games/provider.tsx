// Built by Anointed Coder.
//
// Provider grid: a lobby-style screen for one game category (the title comes
// from a route param, defaulting to "Slots"). A brand filter chip row sits
// above a responsive GameTile grid. Data is local mock; filtering is visual.

import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, GameTile, ChipToggle } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import type { Game } from '@/lib/mock/games';

function tile(seed: string): string {
  return `https://picsum.photos/seed/${seed}/300/300`;
}

const GAMES: Game[] = [
  { id: 'pv_1', name: 'Sweet Bonanza', provider: 'Pragmatic', imageUrl: tile('pv-sweet'), isHot: true },
  { id: 'pv_2', name: 'Gates of Olympus', provider: 'Pragmatic', imageUrl: tile('pv-gates'), isHot: true },
  { id: 'pv_3', name: 'Big Bass Bonanza', provider: 'Pragmatic', imageUrl: tile('pv-bass'), isNew: true },
  { id: 'pv_4', name: 'Starlight Princess', provider: 'Pragmatic', imageUrl: tile('pv-starlight') },
  { id: 'pv_5', name: 'Fortune Tiger', provider: 'PG Soft', imageUrl: tile('pv-tiger'), isHot: true },
  { id: 'pv_6', name: 'Fortune Ox', provider: 'PG Soft', imageUrl: tile('pv-ox') },
  { id: 'pv_7', name: 'Mahjong Ways', provider: 'PG Soft', imageUrl: tile('pv-mahjong'), isNew: true },
  { id: 'pv_8', name: 'Wild Bandito', provider: 'PG Soft', imageUrl: tile('pv-bandito') },
  { id: 'pv_9', name: 'Crazy Time', provider: 'Evolution', imageUrl: tile('pv-crazy'), isHot: true },
  { id: 'pv_10', name: 'Lightning Roulette', provider: 'Evolution', imageUrl: tile('pv-lightning') },
  { id: 'pv_11', name: 'Monopoly Live', provider: 'Evolution', imageUrl: tile('pv-monopoly') },
  { id: 'pv_12', name: 'Dragon Tiger', provider: 'Evolution', imageUrl: tile('pv-dragon'), isNew: true },
  { id: 'pv_13', name: 'Aviator', provider: 'Spribe', imageUrl: tile('pv-aviator'), isHot: true },
  { id: 'pv_14', name: 'Mines', provider: 'Spribe', imageUrl: tile('pv-mines') },
  { id: 'pv_15', name: 'Plinko', provider: 'Spribe', imageUrl: tile('pv-plinko') },
  { id: 'pv_16', name: 'Dice', provider: 'Spribe', imageUrl: tile('pv-dice'), isNew: true },
  { id: 'pv_17', name: 'Super Ace', provider: 'JILI', imageUrl: tile('pv-superace'), isHot: true },
  { id: 'pv_18', name: 'Golden Empire', provider: 'JILI', imageUrl: tile('pv-golden') },
  { id: 'pv_19', name: 'Money Coming', provider: 'JILI', imageUrl: tile('pv-money') },
  { id: 'pv_20', name: 'Boxing King', provider: 'JILI', imageUrl: tile('pv-boxing'), isNew: true },
  { id: 'pv_21', name: 'Buffalo Blitz', provider: 'Playtech', imageUrl: tile('pv-buffalo') },
  { id: 'pv_22', name: 'Age of the Gods', provider: 'Playtech', imageUrl: tile('pv-gods'), isHot: true },
  { id: 'pv_23', name: 'Gladiator', provider: 'Playtech', imageUrl: tile('pv-gladiator') },
  { id: 'pv_24', name: 'Panther Moon', provider: 'Playtech', imageUrl: tile('pv-panther') },
];

const BRANDS = [
  { key: 'all', label: 'All' },
  { key: 'Pragmatic', label: 'Pragmatic' },
  { key: 'PG Soft', label: 'PG Soft' },
  { key: 'Evolution', label: 'Evolution' },
  { key: 'Spribe', label: 'Spribe' },
  { key: 'JILI', label: 'JILI' },
  { key: 'Playtech', label: 'Playtech' },
];

export default function ProviderScreen() {
  const { width } = useWindowDimensions();
  const { title } = useLocalSearchParams<{ title?: string }>();
  const [brand, setBrand] = useState('all');

  const heading = title ?? 'Slots';
  const games = useMemo(() => (brand === 'all' ? GAMES : GAMES.filter((g) => g.provider === brand)), [brand]);

  const cols = width >= 720 ? 5 : width >= 520 ? 4 : 3;
  const GAP = 10;
  const tileW = (width - 32 - GAP * (cols - 1)) / cols;

  return (
    <Screen header={<LobbyHeader title={heading} count={games.length} />} contentClassName="px-4 pt-3 gap-4">
      <ChipToggle options={BRANDS} value={brand} onChange={setBrand} scroll />

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
