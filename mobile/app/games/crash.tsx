// Built by Anointed Coder.
//
// Crash: a static native-game screen. A rising multiplier curve drawn with
// react-native-svg, a big live multiplier overlay, an auto cash out target,
// a bet row with quick chips, a Bet / Cash Out pair and a recent-crashes
// strip. Presentation only, the curve is a fixed shape.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';
import { Screen, Card, PrimaryButton, GhostButton } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import { cn } from '@/lib/cn';

const VW = 320;
const VH = 180;
const STEPS = 40;

// Fixed rising curve: y falls (rises visually) as x grows.
const points = Array.from({ length: STEPS + 1 }, (_, i) => {
  const t = i / STEPS;
  const x = t * VW;
  const y = VH - (VH - 22) * Math.pow(t, 1.9);
  return [x, y] as const;
});
const linePts = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const areaPts = `0,${VH} ${linePts} ${VW},${VH}`;
const head = points[points.length - 1];

const RECENT = [
  { label: '1.24x', win: false },
  { label: '3.081x', win: true },
  { label: '2.44x', win: true },
  { label: '1.02x', win: false },
  { label: '8.75x', win: true },
  { label: '1.61x', win: true },
  { label: '4.30x', win: true },
  { label: '1.09x', win: false },
];

export default function CrashScreen() {
  const { width } = useWindowDimensions();
  const [amount, setAmount] = useState(100);
  const chartW = Math.min(width - 32, 460) - 32; // minus card padding
  const chartH = chartW * (VH / VW);

  return (
    <Screen header={<GameTopBar title="Crash" subtitle="Pasha Originals" />} contentClassName="px-4 pt-3 gap-4">
      {/* Board */}
      <Card tone="dark" className="overflow-hidden">
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full bg-newg" />
            <Text className="text-[11px] font-black uppercase tracking-widest text-white/55">In Flight</Text>
          </View>
          <Text className="text-[11px] font-bold text-white/50">2,481 players</Text>
        </View>

        <View style={{ width: chartW, height: chartH }} className="relative self-center">
          <Svg width={chartW} height={chartH} viewBox={`0 0 ${VW} ${VH}`}>
            <Defs>
              <LinearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.neon} stopOpacity={0.32} />
                <Stop offset="1" stopColor={colors.neon} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((g) => (
              <Line
                key={g}
                x1={0}
                y1={VH * g}
                x2={VW}
                y2={VH * g}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            ))}

            <Polygon points={areaPts} fill="url(#crashFill)" />
            <Polyline points={linePts} fill="none" stroke={colors.neon} strokeWidth={3} strokeLinejoin="round" />
            <Circle cx={head[0]} cy={head[1]} r={6} fill={colors.neon} />
            <Circle cx={head[0]} cy={head[1]} r={11} fill={colors.neon} fillOpacity={0.22} />
          </Svg>

          {/* Multiplier overlay */}
          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            <Text className="text-5xl font-black" style={{ color: colors.neon }}>
              2.48x
            </Text>
            <Text className="mt-1 text-[11px] font-bold uppercase tracking-widest text-white/50">
              Current Multiplier
            </Text>
          </View>
        </View>
      </Card>

      {/* Auto cash out */}
      <Card className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15">
            <Ionicons name="rocket" size={16} color={colors.gold700} />
          </View>
          <View>
            <Text className="text-xs font-bold text-ink">Auto Cash Out</Text>
            <Text className="text-[11px] text-ink-mute">Locks your win automatically</Text>
          </View>
        </View>
        <View className="rounded-lg border border-divider bg-surface px-3 py-1.5">
          <Text className="text-sm font-black text-ink">2.00x</Text>
        </View>
      </Card>

      <BetControls amount={amount} setAmount={setAmount} />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <PrimaryButton label="Place Bet" icon="rocket" size="lg" fullWidth />
        </View>
        <View className="flex-1">
          <GhostButton label="Cash Out" icon="cash" size="lg" fullWidth />
        </View>
      </View>

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
      <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Crashes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((r, i) => (
          <View
            key={i}
            className={cn(
              'h-10 min-w-[56px] items-center justify-center rounded-lg border px-2.5',
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
