// Built by Anointed Coder.
//
// Roulette: a static native-game screen. An SVG European wheel, a red/black
// number layout with outside bets, a chip selector, a bet row with quick
// chips, a Spin button and a recent-results strip. Presentation only.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { Screen, Card, PrimaryButton } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import { cn } from '@/lib/cn';

// European wheel sequence and the red pocket set.
const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEG = 360 / WHEEL.length;
const CX = 100;
const CY = 100;
const RO = 96;
const RI = 58;
const RT = 79;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}
function segPath(a0: number, a1: number) {
  const p1 = polar(RO, a1);
  const p2 = polar(RO, a0);
  const p3 = polar(RI, a0);
  const p4 = polar(RI, a1);
  const large = a1 - a0 <= 180 ? 0 : 1;
  return `M ${p1.x} ${p1.y} A ${RO} ${RO} 0 ${large} 0 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${RI} ${RI} 0 ${large} 1 ${p4.x} ${p4.y} Z`;
}
function pocketFill(n: number) {
  return n === 0 ? '#1FA15A' : RED.has(n) ? '#D4342E' : '#181b22';
}

const OUTSIDE = ['1-18', 'EVEN', 'RED', 'BLACK', 'ODD', '19-36'];
const DOZENS = ['1st 12', '2nd 12', '3rd 12'];
const CHIPS = [10, 50, 100, 500];

const RECENT: { n: number }[] = [{ n: 17 }, { n: 0 }, { n: 32 }, { n: 8 }, { n: 21 }, { n: 4 }, { n: 26 }, { n: 11 }];

export default function RouletteScreen() {
  const { width } = useWindowDimensions();
  const [amount, setAmount] = useState(100);
  const [chip, setChip] = useState(100);

  const wheelSize = Math.min(width - 32 - 32, 300);
  const gridW = width - 32 - 32; // inside a padded card
  const NG = 6;
  const numCell = (gridW - NG * 5) / 6;

  return (
    <Screen header={<GameTopBar title="Roulette" subtitle="Evolution" />} contentClassName="px-4 pt-3 gap-4">
      {/* Wheel */}
      <Card tone="dark" className="items-center overflow-hidden">
        <View style={{ width: wheelSize, height: wheelSize }}>
          <Svg width={wheelSize} height={wheelSize} viewBox="0 0 200 200">
            {/* Gold rim */}
            <Circle cx={CX} cy={CY} r={RO + 2} fill={colors.gold600} />
            {WHEEL.map((n, i) => {
              const a0 = i * SEG;
              const a1 = (i + 1) * SEG;
              const mid = polar(RT, a0 + SEG / 2);
              return (
                <G key={n}>
                  <Path d={segPath(a0, a1)} fill={pocketFill(n)} stroke="#00000030" strokeWidth={0.4} />
                  <SvgText x={mid.x} y={mid.y + 2.4} fontSize={6.4} fontWeight="bold" fill="#ffffff" textAnchor="middle">
                    {n}
                  </SvgText>
                </G>
              );
            })}
            {/* Hub */}
            <Circle cx={CX} cy={CY} r={RI - 2} fill={colors.darkbg} stroke={colors.gold600} strokeWidth={1.5} />
            <SvgText x={CX} y={CY + 4} fontSize={16} fontWeight="bold" fill={colors.goldlite} textAnchor="middle">
              P9
            </SvgText>
            {/* Ball */}
            <Circle cx={polar(RO - 7, 12).x} cy={polar(RO - 7, 12).y} r={4} fill="#ffffff" />
            {/* Pointer */}
            <Polygon points="100,2 94,14 106,14" fill={colors.goldlite} />
          </Svg>
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-white/50">Last</Text>
          <Text className="text-lg font-black" style={{ color: colors.goldlite }}>
            17 Black
          </Text>
        </View>
      </Card>

      {/* Number layout */}
      <Card className="gap-2">
        {/* Zero */}
        <View
          className="items-center justify-center rounded-lg py-2.5"
          style={{ backgroundColor: '#1FA15A' }}
        >
          <Text className="text-sm font-black text-white">0</Text>
        </View>

        <View className="flex-row flex-wrap" style={{ gap: NG }}>
          {Array.from({ length: 36 }, (_, i) => {
            const n = i + 1;
            const red = RED.has(n);
            return (
              <View
                key={n}
                style={{ width: numCell, height: numCell, backgroundColor: red ? '#D4342E' : '#181b22' }}
                className="items-center justify-center rounded-lg"
              >
                <Text className="text-xs font-black text-white">{n}</Text>
              </View>
            );
          })}
        </View>

        {/* Dozens */}
        <View className="mt-1 flex-row gap-2">
          {DOZENS.map((d) => (
            <View key={d} className="flex-1 items-center rounded-lg border border-divider bg-surface py-2.5">
              <Text className="text-[11px] font-black text-ink-soft">{d}</Text>
            </View>
          ))}
        </View>

        {/* Outside bets */}
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {OUTSIDE.map((o) => {
            const isRed = o === 'RED';
            const isBlack = o === 'BLACK';
            return (
              <View
                key={o}
                style={{
                  width: (gridW - 16) / 3,
                  backgroundColor: isRed ? '#D4342E' : isBlack ? '#181b22' : undefined,
                }}
                className={cn(
                  'items-center rounded-lg border py-2.5',
                  isRed || isBlack ? 'border-transparent' : 'border-divider bg-surface',
                )}
              >
                <Text className={cn('text-[11px] font-black', isRed || isBlack ? 'text-white' : 'text-ink-soft')}>
                  {o}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Chip selector */}
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Chip Value</Text>
        <View className="flex-row gap-3">
          {CHIPS.map((c) => {
            const active = chip === c;
            return (
              <Pressable
                key={c}
                onPress={() => setChip(c)}
                className={cn(
                  'h-14 w-14 items-center justify-center rounded-full border-2 active:opacity-80',
                  active ? 'border-gold-700 bg-gold-500' : 'border-divider bg-paper',
                )}
              >
                <Text className={cn('text-xs font-black', active ? 'text-ink' : 'text-ink-soft')}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <BetControls amount={amount} setAmount={setAmount} />

      <PrimaryButton label="Spin" icon="sync" size="lg" fullWidth />

      {/* Recent results */}
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Numbers</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {RECENT.map((r, i) => (
            <View
              key={i}
              style={{ backgroundColor: pocketFill(r.n) }}
              className="h-10 w-10 items-center justify-center rounded-full"
            >
              <Text className="text-sm font-black text-white">{r.n}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
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
