// Built by Anointed Coder.
//
// Keno: a static native-game screen. An 8x10 board of numbers 1..80 with a
// fixed set of picks and drawn hits, a payout table, a bet row with quick
// chips, a Bet button and a recent-results strip. Presentation only.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Card, PrimaryButton, GhostButton } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import { cn } from '@/lib/cn';

const PICKS = new Set([4, 7, 12, 23, 31, 44, 58, 66, 70, 77]);
const DRAWN = new Set([3, 4, 12, 17, 23, 26, 31, 38, 41, 44, 49, 52, 58, 61, 63, 66, 70, 72, 75, 79]);

const PAYOUTS = [
  { m: '3', x: '1x' },
  { m: '5', x: '4x' },
  { m: '7', x: '25x' },
  { m: '8', x: '120x' },
  { m: '10', x: '1000x' },
];

const RECENT = [
  { label: '6 hits', win: true },
  { label: '2 hits', win: false },
  { label: '8 hits', win: true },
  { label: '4 hits', win: true },
  { label: '1 hit', win: false },
  { label: '7 hits', win: true },
];

export default function KenoScreen() {
  const { width } = useWindowDimensions();
  const [amount, setAmount] = useState(100);

  const GAP = 6;
  const boardW = Math.min(width - 32, 460) - 32; // minus card padding
  const cell = (boardW - GAP * 7) / 8;

  return (
    <Screen header={<GameTopBar title="Keno" subtitle="Pasha Originals" />} contentClassName="px-4 pt-3 gap-4">
      {/* Board */}
      <Card tone="dark" className="items-center">
        <View className="mb-3 w-full flex-row items-center justify-between">
          <Text className="text-xs font-bold text-white/70">10 picks</Text>
          <View className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-full bg-newg" />
            <Text className="text-xs font-bold text-white/70">6 hits</Text>
          </View>
        </View>

        <View className="flex-row flex-wrap" style={{ width: boardW, gap: GAP }}>
          {Array.from({ length: 80 }, (_, idx) => {
            const n = idx + 1;
            const picked = PICKS.has(n);
            const drawn = DRAWN.has(n);
            const hit = picked && drawn;
            return (
              <View
                key={n}
                style={{ width: cell, height: cell }}
                className={cn(
                  'items-center justify-center rounded-lg border',
                  hit
                    ? 'border-newg bg-newg/25'
                    : picked
                      ? 'border-gold-500 bg-gold-500/20'
                      : drawn
                        ? 'border-white/25 bg-white/10'
                        : 'border-white/10 bg-white/5',
                )}
              >
                <Text
                  className="text-xs font-black"
                  style={{
                    color: hit
                      ? colors.neon
                      : picked
                        ? colors.goldlite
                        : drawn
                          ? '#ffffff'
                          : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {n}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Payout table */}
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Payout Table</Text>
        <View className="flex-row gap-2">
          {PAYOUTS.map((p) => (
            <Card key={p.m} className="flex-1 items-center" padded={false}>
              <View className="items-center py-2.5">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{p.m} hit</Text>
                <Text className="mt-0.5 text-sm font-black" style={{ color: colors.gold700 }}>
                  {p.x}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <GhostButton label="Quick Pick" icon="shuffle" fullWidth />
        </View>
        <View className="flex-1">
          <GhostButton label="Clear" icon="close" fullWidth />
        </View>
      </View>

      <BetControls amount={amount} setAmount={setAmount} />

      <PrimaryButton label="Play Keno" icon="ticket" size="lg" fullWidth />

      <ResultsStrip items={RECENT} />
    </Screen>
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
              'h-10 min-w-[64px] items-center justify-center rounded-lg border px-2.5',
              r.win ? 'border-newg/40 bg-newg/10' : 'border-hot/40 bg-hot/10',
            )}
          >
            <Text className="text-xs font-black" style={{ color: r.win ? colors.newg : colors.hot }}>
              {r.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
