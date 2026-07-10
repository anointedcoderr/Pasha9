// Built by Anointed Coder.
//
// Dice: a static native-game screen. Two rolled dice on a dark board, an
// Under / Over prediction with a target slider, a bet row with quick chips,
// a Bet button and a recent-rolls strip. Presentation only. Values come from
// local mock; the light state (bet size, prediction) is visual polish.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Card, PrimaryButton, ChipToggle, StatRow } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';
import { cn } from '@/lib/cn';

// 3x3 pip layout per die value (cell indexes 0..8, row major).
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const RECENT = [
  { label: '7', win: true },
  { label: '11', win: true },
  { label: '4', win: false },
  { label: '9', win: true },
  { label: '2', win: false },
  { label: '6', win: false },
  { label: '10', win: true },
  { label: '8', win: true },
  { label: '5', win: false },
];

export default function DiceScreen() {
  const [amount, setAmount] = useState(100);
  const [side, setSide] = useState('under');
  const target = side === 'under' ? 50 : 50;

  const dice = [4, 3];
  const sum = dice[0] + dice[1];

  return (
    <Screen header={<GameTopBar title="Dice" subtitle="Pasha Originals" />} contentClassName="px-4 pt-3 gap-4">
      {/* Board */}
      <Card tone="dark" className="overflow-hidden">
        <View className="items-center gap-4 py-2">
          <Text className="text-[11px] font-black uppercase tracking-[3px] text-white/45">Last Roll</Text>
          <View className="flex-row items-center gap-5">
            <Die value={dice[0]} />
            <View className="items-center">
              <Text className="text-4xl font-black" style={{ color: colors.neon }}>
                {sum}
              </Text>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-white/50">Total</Text>
            </View>
            <Die value={dice[1]} />
          </View>
        </View>

        {/* Target slider (visual) */}
        <View className="mt-2 gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-white/70">Roll {side === 'under' ? 'Under' : 'Over'}</Text>
            <Text className="text-sm font-black" style={{ color: colors.goldlite }}>
              {target}
            </Text>
          </View>
          <View className="h-3 flex-row overflow-hidden rounded-full bg-white/10">
            <View style={{ width: `${target}%` }} className="rounded-full bg-gold-500" />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[10px] font-bold text-white/40">0</Text>
            <Text className="text-[10px] font-bold text-white/40">100</Text>
          </View>
        </View>
      </Card>

      {/* Prediction */}
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Prediction</Text>
        <ChipToggle
          options={[
            { key: 'under', label: 'Roll Under' },
            { key: 'over', label: 'Roll Over' },
          ]}
          value={side}
          onChange={setSide}
        />
      </View>

      <StatRow
        items={[
          { label: 'Multiplier', value: '1.98x', valueTone: 'gold', icon: 'trending-up' },
          { label: 'Win Chance', value: '49.5%', valueTone: 'green', icon: 'pie-chart' },
          { label: 'Payout', value: formatBDT(Math.round(amount * 1.98)), valueTone: 'blue', icon: 'cash' },
        ]}
      />

      <BetControls amount={amount} setAmount={setAmount} />

      <PrimaryButton label="Roll Dice" icon="dice" size="lg" fullWidth />

      <ResultsStrip items={RECENT} />
    </Screen>
  );
}

function Die({ value }: { value: number }) {
  const on = new Set(PIPS[value] ?? []);
  return (
    <View className="h-[74px] w-[74px] rounded-2xl bg-white p-2.5 shadow-sm shadow-black/30">
      <View className="flex-1 flex-row flex-wrap">
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} className="h-1/3 w-1/3 items-center justify-center">
            {on.has(i) ? <View className="h-2.5 w-2.5 rounded-full bg-ink" /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// Shared game chrome. Kept local so this route stays self contained.
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
              'h-10 min-w-[46px] items-center justify-center rounded-lg border px-2.5',
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
