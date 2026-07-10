// Built by Anointed Coder.
//
// Pasha WinGo game screen. Static UI that mirrors the web WinGo board:
//   four mode tabs (30s / 1m / 3m / 5m) -> a round card (recent-result
//   mini balls, period number, a live mm:ss countdown, Open/Locked pill)
//   -> the betting board (Green / Violet / Red, the glossy 0-9 ball grid,
//   Random + X1..X100 multiplier chips, a Big / Small bar) -> the lower
//   Game history / Chart / My history tabs with sample rows.
//
// Presentation only: the countdown ticks for life, but there is no betting
// logic. All figures come from the local mock arrays below.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen, ChipToggle, Gradient } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { mockWallet } from '@/lib/mock';
import { WingoBall, colorOf, sizeOf } from './_components/WingoBall';

// ---------- Mock data ----------

const MODES = [
  { key: 'wingo_30s', label: '30s' },
  { key: 'wingo_1m', label: '1m' },
  { key: 'wingo_3m', label: '3m' },
  { key: 'wingo_5m', label: '5m' },
];

const MODE_SECONDS: Record<string, number> = {
  wingo_30s: 30,
  wingo_1m: 60,
  wingo_3m: 180,
  wingo_5m: 300,
};

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];

interface Draw {
  period: string;
  n: number;
}

const HISTORY: Draw[] = [
  { period: '20260710104219', n: 7 },
  { period: '20260710104218', n: 2 },
  { period: '20260710104217', n: 5 },
  { period: '20260710104216', n: 9 },
  { period: '20260710104215', n: 0 },
  { period: '20260710104214', n: 4 },
  { period: '20260710104213', n: 3 },
  { period: '20260710104212', n: 8 },
  { period: '20260710104211', n: 1 },
  { period: '20260710104210', n: 6 },
];

interface MyBet {
  id: string;
  label: string;
  n?: number;
  period: string;
  amount: number;
  status: 'WON' | 'LOST' | 'PENDING';
  payout?: number;
}

const MY_BETS: MyBet[] = [
  { id: 'b1', label: 'Green', period: '20260710104219', amount: 50, status: 'WON', payout: 96 },
  { id: 'b2', label: 'Number 7', n: 7, period: '20260710104219', amount: 20, status: 'WON', payout: 180 },
  { id: 'b3', label: 'Big', period: '20260710104218', amount: 100, status: 'LOST' },
  { id: 'b4', label: 'Violet', period: '20260710104217', amount: 10, status: 'PENDING' },
  { id: 'b5', label: 'Small', period: '20260710104216', amount: 30, status: 'WON', payout: 57 },
];

const CURRENT_PERIOD = '20260710104220';

// Glossy button gradients (top -> bottom), matching the web colour system.
const GRAD = {
  green: ['#5cf3bf', '#13c98d', '#054f34'],
  violet: ['#d29bff', '#a855f7', '#4f1687'],
  red: ['#ff8090', '#ec394d', '#6f0c1c'],
  big: ['#ffe08a', '#f5b400', '#a15c0a'],
  small: ['#7cc9ff', '#2f8fe0', '#0a4a8f'],
} as const;

type Tab = 'game' | 'chart' | 'mine';

export default function WingoScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState('wingo_30s');
  const [multiplier, setMultiplier] = useState(1);
  const [tab, setTab] = useState<Tab>('game');
  const [remaining, setRemaining] = useState(MODE_SECONDS.wingo_30s);

  // Live countdown. Resets to the mode length when it reaches zero; no bets
  // are actually placed, this only gives the round card a sense of life.
  useEffect(() => {
    setRemaining(MODE_SECONDS[mode]);
  }, [mode]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((s) => (s <= 1 ? MODE_SECONDS[mode] : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [mode]);

  const locked = remaining <= 5;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  // 0-9 ball grid: 5 columns inside a padded panel. Content padding px-3
  // (24) then the panel p-4 (32); size the balls so five fit per row.
  const ballSize = useMemo(() => {
    const inner = width - 24 - 32;
    return Math.min(58, Math.floor((inner - 10 * 4) / 5));
  }, [width]);

  return (
    <Screen
      className="!bg-darkbg"
      header={<GameHeader onBack={() => router.back()} />}
      contentClassName="px-3 pt-3 gap-4"
    >
      <StatusBar style="light" />

      {/* Mode tabs */}
      <ChipToggle options={MODES} value={mode} onChange={setMode} scroll />

      {/* Round card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/25">
        <Gradient colors={['#2a1608', '#1a0d18', '#05060a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View
          pointerEvents="none"
          className="absolute -right-8 -top-10 h-40 w-40 rounded-full"
          style={{ backgroundColor: 'rgba(255,213,84,0.15)' }}
        />
        <View className="flex-row items-start justify-between gap-3 p-4">
          {/* Left: recent balls + period */}
          <View className="min-w-0 flex-1">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-gold-300">Recent results</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
            >
              {HISTORY.map((d) => (
                <WingoBall key={d.period} n={d.n} size={26} />
              ))}
            </ScrollView>
            <Text className="mt-1 text-[10px] font-bold uppercase tracking-wider text-dink-lo">Period</Text>
            <Text className="font-mono text-sm font-bold text-white">{CURRENT_PERIOD}</Text>
          </View>

          {/* Right: countdown + status */}
          <View className="shrink-0 items-end">
            <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-dink-lo">
              {locked ? 'Draw in' : 'Bet closes in'}
            </Text>
            <View className="flex-row items-center gap-1">
              <DigitCell ch={mm[0]} locked={locked} />
              <DigitCell ch={mm[1]} locked={locked} />
              <Text className={cn('px-0.5 text-lg font-black', locked ? 'text-hot' : 'text-gold-300')}>:</Text>
              <DigitCell ch={ss[0]} locked={locked} />
              <DigitCell ch={ss[1]} locked={locked} />
            </View>
            <View className="mt-2 flex-row items-center gap-1.5 rounded-pill border border-white/10 bg-black/40 px-2.5 py-1">
              <View
                className={cn('h-2 w-2 rounded-full', locked ? 'bg-hot' : 'bg-newg')}
                style={{ shadowColor: locked ? colors.hot : colors.newg, shadowOpacity: 0.8, shadowRadius: 4 }}
              />
              <Text className={cn('text-[10px] font-bold uppercase tracking-wider', locked ? 'text-hot' : 'text-newg')}>
                {locked ? 'Locked' : 'Open'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Board: colour buttons */}
      <View className="flex-row gap-2.5">
        <GlossyBar label="Green" grad={GRAD.green} />
        <GlossyBar label="Violet" grad={GRAD.violet} />
        <GlossyBar label="Red" grad={GRAD.red} />
      </View>

      {/* Board: 0-9 glossy balls */}
      <View className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4">
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 14 }}>
          {Array.from({ length: 10 }, (_, n) => (
            <WingoBall key={n} n={n} size={ballSize} onPress={() => {}} />
          ))}
        </View>
      </View>

      {/* Random + multiplier chips */}
      <View className="flex-row flex-wrap items-center gap-2">
        <Pressable
          className="h-11 flex-row items-center gap-1.5 rounded-xl border border-gold-300/40 bg-gold-500/10 px-3.5 active:opacity-80"
          onPress={() => {}}
        >
          <Ionicons name="shuffle" size={15} color={colors.gold300} />
          <Text className="text-xs font-black uppercase tracking-wider text-gold-300">Random</Text>
        </Pressable>
        {MULTIPLIERS.map((q) => {
          const active = q === multiplier;
          return (
            <Pressable
              key={q}
              onPress={() => setMultiplier(q)}
              className={cn(
                'h-11 min-w-[46px] items-center justify-center rounded-xl border px-2 active:opacity-80',
                active ? 'border-gold-300 bg-gold-500/20' : 'border-white/15 bg-white/5',
              )}
            >
              <Text className={cn('text-xs font-bold', active ? 'text-gold-300' : 'text-dink-mid')}>X{q}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Big / Small bar */}
      <View className="flex-row gap-2.5">
        <GlossyBar label="Big 5-9" grad={GRAD.big} textColor="#3a1f00" />
        <GlossyBar label="Small 0-4" grad={GRAD.small} />
      </View>

      {/* Lower history tabs */}
      <View className="rounded-2xl border border-white/10 bg-black/35 p-3">
        <View className="mb-3 flex-row gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
          <TabButton label="Game history" icon="time" active={tab === 'game'} onPress={() => setTab('game')} />
          <TabButton label="Chart" icon="bar-chart" active={tab === 'chart'} onPress={() => setTab('chart')} />
          <TabButton label="My history" icon="person" active={tab === 'mine'} onPress={() => setTab('mine')} />
        </View>

        {tab === 'game' ? <GameHistory /> : null}
        {tab === 'chart' ? <Chart /> : null}
        {tab === 'mine' ? <MyHistory /> : null}
      </View>
    </Screen>
  );
}

// ---------- Header ----------

function GameHeader({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-row items-center justify-between border-b border-white/10 bg-darkbg px-3 py-2.5">
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onBack}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-white/10"
        >
          <Ionicons name="chevron-back" size={22} color="#ffffff" />
        </Pressable>
        <Text className="text-lg font-black text-white">Pasha WinGo</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="flex-row items-center gap-1.5 rounded-pill border border-gold-600/40 bg-gold-500/15 px-2.5 py-1.5">
          <Ionicons name="wallet" size={13} color={colors.gold300} />
          <Text className="text-[11px] font-black text-white">{formatBDT(mockWallet.balance)}</Text>
        </View>
        <View className="flex-row items-center gap-1 rounded-pill border border-newg/40 bg-newg/10 px-2 py-1.5">
          <Ionicons name="shield-checkmark" size={12} color={colors.neon} />
          <Text className="text-[10px] font-bold uppercase text-white">Fair</Text>
        </View>
      </View>
    </View>
  );
}

// ---------- Pieces ----------

function DigitCell({ ch, locked }: { ch: string; locked: boolean }) {
  return (
    <View
      className={cn(
        'h-8 w-6 items-center justify-center rounded-md border',
        locked ? 'border-hot/60 bg-hot/15' : 'border-gold-300/40 bg-black/50',
      )}
    >
      <Text className={cn('text-lg font-black', locked ? 'text-hot' : 'text-gold-300')}>{ch}</Text>
    </View>
  );
}

function GlossyBar({
  label,
  grad,
  textColor = '#ffffff',
}: {
  label: string;
  grad: readonly string[];
  textColor?: string;
}) {
  return (
    <Pressable
      onPress={() => {}}
      className="relative h-14 flex-1 items-center justify-center overflow-hidden rounded-2xl active:opacity-90"
    >
      <Gradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} radius={16} />
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
      />
      <Text style={{ color: textColor }} className="text-base font-black uppercase tracking-wider">
        {label}
      </Text>
    </Pressable>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg active:opacity-80',
        active ? 'bg-gold-500/20' : '',
      )}
    >
      <Ionicons name={icon} size={13} color={active ? colors.gold300 : colors.dinkLo} />
      <Text
        className={cn('text-[11px] font-bold uppercase tracking-wide', active ? 'text-gold-300' : 'text-dink-lo')}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------- Game history tab ----------

function GameHistory() {
  return (
    <View className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <View className="flex-row items-center border-b border-white/10 px-4 py-2.5">
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-gold-300/60">Period</Text>
        <Text className="w-12 text-center text-[10px] font-bold uppercase tracking-widest text-gold-300/60">No.</Text>
        <Text className="w-20 text-right text-[10px] font-bold uppercase tracking-widest text-gold-300/60">Result</Text>
      </View>
      {HISTORY.map((d, i) => (
        <View
          key={d.period}
          className={cn(
            'flex-row items-center px-4 py-2.5',
            i % 2 === 1 && 'bg-white/[0.02]',
            i < HISTORY.length - 1 && 'border-b border-white/[0.06]',
          )}
        >
          <Text className="flex-1 font-mono text-xs text-dink-mid">{d.period}</Text>
          <View className="w-12 items-center">
            <WingoBall n={d.n} size={30} />
          </View>
          <View className="w-20 flex-row items-center justify-end gap-1.5">
            <SizePill n={d.n} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Chart tab ----------

function Chart() {
  const stats = useMemo(() => {
    let big = 0;
    let small = 0;
    let red = 0;
    let green = 0;
    let violet = 0;
    for (const d of HISTORY) {
      if (sizeOf(d.n) === 'big') big++;
      else small++;
      const id = colorOf(d.n);
      if (id === 'red' || id === 'red_violet') red++;
      if (id === 'green' || id === 'green_violet') green++;
      if (id === 'red_violet' || id === 'green_violet') violet++;
    }
    return { big, small, red, green, violet, total: HISTORY.length };
  }, []);

  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap justify-between" style={{ rowGap: 10 }}>
        <StatCard label="Big" value={stats.big} total={stats.total} grad={GRAD.big} text="#ffdf9a" />
        <StatCard label="Small" value={stats.small} total={stats.total} grad={GRAD.small} text="#a9dcff" />
        <StatCard label="Violet" value={stats.violet} total={stats.total} grad={GRAD.violet} text="#d9b8ff" />
        <StatCard label="Red" value={stats.red} total={stats.total} grad={GRAD.red} text="#ffb4bf" />
        <StatCard label="Green" value={stats.green} total={stats.total} grad={GRAD.green} text="#8ff5d0" />
        <StatCard label="Draws" value={stats.total} total={stats.total} grad={GRAD.big} text="#f1e2b2" />
      </View>

      {/* Number frequency rail */}
      <View className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <Text className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gold-300/70">Number trend</Text>
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 10 }}>
          {HISTORY.map((d) => (
            <WingoBall key={d.period} n={d.n} size={26} />
          ))}
        </View>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  total,
  grad,
  text,
}: {
  label: string;
  value: number;
  total: number;
  grad: readonly string[];
  text: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ width: '31.5%' }} className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2.5">
      <View className="flex-row items-center justify-between">
        <View className="h-2.5 w-2.5 overflow-hidden rounded-full">
          <Gradient colors={grad} radius={999} />
        </View>
        <Text className="rounded-pill bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-dink-mid">{pct}%</Text>
      </View>
      <Text className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-dink-lo">{label}</Text>
      <Text className="text-xl font-black" style={{ color: text }}>
        {value}
      </Text>
      <View className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <View className="h-full overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
          <Gradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
        </View>
      </View>
    </View>
  );
}

// ---------- My history tab ----------

function MyHistory() {
  return (
    <View className="gap-2">
      {MY_BETS.map((b) => {
        const won = b.status === 'WON';
        const pending = b.status === 'PENDING';
        return (
          <View key={b.id} className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
            {b.n != null ? (
              <WingoBall n={b.n} size={34} />
            ) : (
              <View className="h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <Text className="text-[10px] font-black uppercase text-white">{b.label.slice(0, 3)}</Text>
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text className="text-xs font-bold text-white" numberOfLines={1}>
                {b.label}
              </Text>
              <Text className="font-mono text-[10px] text-dink-lo">{b.period}</Text>
            </View>
            <View className="items-end">
              <Text className="text-xs font-bold text-dink-mid">{formatBDT(b.amount)}</Text>
              <Text
                className={cn(
                  'text-[11px] font-black uppercase tracking-wider',
                  won ? 'text-newg' : pending ? 'text-gold-300' : 'text-hot',
                )}
              >
                {pending ? 'Pending' : won ? `+${formatBDT(b.payout ?? 0)}` : 'Lost'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// A small Big / Small pill for the history rows.
function SizePill({ n }: { n: number }) {
  const big = sizeOf(n) === 'big';
  return (
    <View className="relative overflow-hidden rounded-pill px-2 py-0.5">
      <Gradient colors={big ? GRAD.big : GRAD.small} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} radius={999} />
      <Text className="text-[10px] font-black uppercase" style={{ color: big ? '#3a2800' : '#052436' }}>
        {big ? 'Big' : 'Small'}
      </Text>
    </View>
  );
}
