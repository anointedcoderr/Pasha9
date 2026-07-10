// Built by Anointed Coder.
//
// Slots grid: a slots-themed lobby. A theme filter chip row (Popular, New,
// Jackpot, Megaways) sits above a responsive GameTile grid. Data is local
// mock; filtering is visual.

import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, GameTile, ChipToggle, SectionHeader } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import type { Game } from '@/lib/mock/games';

type SlotTheme = 'popular' | 'new' | 'jackpot' | 'megaways';
interface SlotGame extends Game {
  theme: SlotTheme;
}

function tile(seed: string): string {
  return `https://picsum.photos/seed/${seed}/300/300`;
}

const SLOTS: SlotGame[] = [
  { id: 'sl_1', name: 'Sweet Bonanza', provider: 'Pragmatic', imageUrl: tile('sl-sweet'), theme: 'popular', isHot: true },
  { id: 'sl_2', name: 'Gates of Olympus', provider: 'Pragmatic', imageUrl: tile('sl-gates'), theme: 'popular', isHot: true },
  { id: 'sl_3', name: 'Fortune Tiger', provider: 'PG Soft', imageUrl: tile('sl-tiger'), theme: 'popular' },
  { id: 'sl_4', name: 'Super Ace', provider: 'JILI', imageUrl: tile('sl-superace'), theme: 'popular' },
  { id: 'sl_5', name: 'Wild West Gold', provider: 'Pragmatic', imageUrl: tile('sl-west'), theme: 'new', isNew: true },
  { id: 'sl_6', name: 'Neon City', provider: 'PG Soft', imageUrl: tile('sl-neon'), theme: 'new', isNew: true },
  { id: 'sl_7', name: 'Lucky Koi', provider: 'JILI', imageUrl: tile('sl-koi'), theme: 'new', isNew: true },
  { id: 'sl_8', name: 'Aztec Blaze', provider: 'Pragmatic', imageUrl: tile('sl-aztec'), theme: 'new', isNew: true },
  { id: 'sl_9', name: 'Mega Fortune', provider: 'NetEnt', imageUrl: tile('sl-mega'), theme: 'jackpot', isHot: true },
  { id: 'sl_10', name: 'Divine Fortune', provider: 'NetEnt', imageUrl: tile('sl-divine'), theme: 'jackpot' },
  { id: 'sl_11', name: 'Hall of Gods', provider: 'NetEnt', imageUrl: tile('sl-hall'), theme: 'jackpot' },
  { id: 'sl_12', name: 'Jackpot Rise', provider: 'Playtech', imageUrl: tile('sl-rise'), theme: 'jackpot' },
  { id: 'sl_13', name: 'Bonanza Megaways', provider: 'Big Time', imageUrl: tile('sl-bonanza'), theme: 'megaways', isHot: true },
  { id: 'sl_14', name: 'Extra Chilli', provider: 'Big Time', imageUrl: tile('sl-chilli'), theme: 'megaways' },
  { id: 'sl_15', name: 'White Rabbit', provider: 'Big Time', imageUrl: tile('sl-rabbit'), theme: 'megaways' },
  { id: 'sl_16', name: 'Gold Blitz Megaways', provider: 'Blueprint', imageUrl: tile('sl-blitz'), theme: 'megaways', isNew: true },
];

const THEMES = [
  { key: 'all', label: 'All' },
  { key: 'popular', label: 'Popular' },
  { key: 'new', label: 'New' },
  { key: 'jackpot', label: 'Jackpot' },
  { key: 'megaways', label: 'Megaways' },
];

export default function SlotsScreen() {
  const { width } = useWindowDimensions();
  const [theme, setTheme] = useState('all');

  const games = useMemo(() => (theme === 'all' ? SLOTS : SLOTS.filter((g) => g.theme === theme)), [theme]);

  const cols = width >= 720 ? 5 : width >= 520 ? 4 : 3;
  const GAP = 10;
  const tileW = (width - 32 - GAP * (cols - 1)) / cols;

  return (
    <Screen header={<LobbyHeader title="Slots" count={games.length} />} contentClassName="px-4 pt-3 gap-4">
      <ChipToggle options={THEMES} value={theme} onChange={setTheme} scroll />

      <SectionHeader title="Slot Machines" subtitle="Spin the reels and hit the jackpot" icon="apps" />

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
