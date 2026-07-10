// Built by Anointed Coder.
//
// Mines: a static native-game screen. A 5x5 tile grid with a fixed reveal
// pattern (gems + a hit mine), a mines-count selector, a live multiplier /
// payout readout, a bet row with quick chips, a Cash Out button and a recent
// results strip. Presentation only, no real game logic.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Card, PrimaryButton, GhostButton } from '@/components/ui';
import { Gradient } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors, gradients } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import { cn } from '@/lib/cn';

// Fixed board of 25 cells. gem = revealed safe, mine = revealed bomb,
// hidden = untouched tile.
type Cell = 'gem' | 'mine' | 'hidden';
const BOARD: Cell[] = [
  'gem', 'hidden', 'gem', 'hidden', 'hidden',
  'hidden', 'gem', 'hidden', 'hidden', 'gem',
  'gem', 'hidden', 'hidden', 'mine', 'hidden',
  'hidden', 'hidden', 'gem', 'hidden', 'hidden',
  'gem', 'hidden', 'gem', 'hidden', 'gem',
];

const RECENT = [
  { label: '2.4x', win: true },
  { label: '0.0x', win: false },
  { label: '5.1x', win: true },
  { label: '1.3x', win: true },
  { label: '0.0x', win: false },
  { label: '3.6x', win: true },
  { label: '8.2x', win: true },
];

export default function MinesScreen() {
  const { width } = useWindowDimensions();
  const [amount, setAmount] = useState(100);
  const [mines, setMines] = useState(5);

  const GAP = 8;
  const boardW = Math.min(width - 32, 420) - 32; // minus card padding
  const cell = (boardW - GAP * 4) / 5;

  return (
    <Screen header={<GameTopBar title="Mines" subtitle="Spribe" />} contentClassName="px-4 pt-3 gap-4">
      {/* Board */}
      <Card tone="dark" className="items-center">
        <View className="mb-3 w-full flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="diamond" size={14} color={colors.neon} />
            <Text className="text-xs font-bold text-white/70">6 gems found</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="alert-circle" size={14} color={colors.hot} />
            <Text className="text-xs font-bold text-white/70">{mines} mines</Text>
          </View>
        </View>

        <View className="flex-row flex-wrap" style={{ width: boardW, gap: GAP }}>
          {BOARD.map((c, i) => (
            <MineTile key={i} cell={c} size={cell} />
          ))}
        </View>
      </Card>

      {/* Multiplier readout */}
      <View className="flex-row gap-3">
        <Card className="flex-1 items-center">
          <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">Multiplier</Text>
          <Text className="mt-1 text-2xl font-black" style={{ color: colors.gold700 }}>
            2.44x
          </Text>
        </Card>
        <Card className="flex-1 items-center">
          <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">Cash Out</Text>
          <Text className="mt-1 text-2xl font-black text-ink">{formatBDT(Math.round(amount * 2.44))}</Text>
        </Card>
      </View>

      {/* Mines count */}
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Mines</Text>
        <View className="flex-row gap-2">
          {[1, 3, 5, 10].map((m) => {
            const active = mines === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMines(m)}
                className={cn(
                  'flex-1 items-center rounded-xl border py-2.5 active:opacity-80',
                  active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
                )}
              >
                <Text className={cn('text-sm font-black', active ? 'text-ink' : 'text-ink-soft')}>{m}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <BetControls amount={amount} setAmount={setAmount} />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <PrimaryButton label="Cash Out" icon="cash" size="lg" fullWidth />
        </View>
        <View className="flex-1">
          <GhostButton label="New Game" icon="refresh" size="lg" fullWidth />
        </View>
      </View>

      <ResultsStrip items={RECENT} />
    </Screen>
  );
}

function MineTile({ cell, size }: { cell: Cell; size: number }) {
  if (cell === 'gem') {
    return (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-xl border border-neon/40 bg-neon/10"
      >
        <Ionicons name="diamond" size={size * 0.42} color={colors.neon} />
      </View>
    );
  }
  if (cell === 'mine') {
    return (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-xl border border-hot/50 bg-hot/15"
      >
        <Ionicons name="skull" size={size * 0.42} color={colors.hot} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }} className="relative overflow-hidden rounded-xl">
      <Gradient colors={gradients.darkPanel} radius={12} />
      <View className="absolute inset-0 items-center justify-center">
        <Ionicons name="help" size={size * 0.36} color="rgba(255,255,255,0.22)" />
      </View>
    </View>
  );
}

function GameTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
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
          {subtitle ? <Text className="text-[11px] text-ink-mute">{subtitle}</Text> : null}
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

function BetControls({ amount, setAmount }: { amount: number; setAmount: (n: number) => void }) {
  const chips = [10, 50, 100, 500, 1000];
  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Bet Amount</Text>
        <Text className="text-[11px] text-ink-mute">Bal {formatBDT(mockWallet.balance)}</Text>
      </View>
      <View className="mt-2.5 flex-row items-center gap-2">
        <Pressable
          onPress={() => setAmount(Math.max(10, amount - 10))}
          className="h-11 w-11 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
        >
          <Ionicons name="remove" size={18} color={colors.ink} />
        </Pressable>
        <View className="flex-1 flex-row items-center justify-center rounded-xl border border-divider bg-surface py-3">
          <Text className="text-lg font-black text-ink">{formatBDT(amount)}</Text>
        </View>
        <Pressable
          onPress={() => setAmount(amount + 10)}
          className="h-11 w-11 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
        >
          <Ionicons name="add" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View className="mt-2.5 flex-row gap-2">
        {chips.map((c) => {
          const active = amount === c;
          return (
            <Pressable
              key={c}
              onPress={() => setAmount(c)}
              className={cn(
                'flex-1 items-center rounded-lg border py-2 active:opacity-80',
                active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
              )}
            >
              <Text className={cn('text-xs font-black', active ? 'text-ink' : 'text-ink-soft')}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function ResultsStrip({ items }: { items: { label: string; win: boolean }[] }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Results</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((r, i) => (
          <View
            key={i}
            className={cn(
              'h-10 min-w-[52px] items-center justify-center rounded-lg border px-2.5',
              r.win ? 'border-newg/40 bg-newg/10' : 'border-hot/40 bg-hot/10',
            )}
          >
            <Text className="text-sm font-black" style={{ color: r.win ? colors.newg : colors.hot }}>
              {r.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
