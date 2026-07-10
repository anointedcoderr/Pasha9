// Built by Anointed Coder.
//
// Lucky Spin screen. A colourful eight-segment prize wheel drawn with
// react-native-svg, a gold SPIN button that rotates the wheel to a random
// stop (visual only, no prize logic), a prize legend and a recent-spins
// list. Static premium UI in the same dark language as the WinGo screen.

import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen, PrimaryButton, Gradient, SectionHeader } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { mockWallet } from '@/lib/mock';

// The eight wheel segments. `fill` is the flat segment colour; `text` sits
// on the slice. Prizes are cosmetic only.
interface Segment {
  label: string;
  fill: string;
  edge: string;
  prize: string;
}

const SEGMENTS: Segment[] = [
  { label: '৳500', fill: '#f5b400', edge: '#a15c0a', prize: 'BDT 500 cash' },
  { label: 'x2', fill: '#a855f7', edge: '#4f1687', prize: 'x2 bonus multiplier' },
  { label: '৳100', fill: '#13c98d', edge: '#054f34', prize: 'BDT 100 cash' },
  { label: 'FREE', fill: '#ec394d', edge: '#6f0c1c', prize: 'Free spin token' },
  { label: '৳250', fill: '#2f8fe0', edge: '#0a4a8f', prize: 'BDT 250 cash' },
  { label: 'x5', fill: '#f0abfc', edge: '#701a75', prize: 'x5 bonus multiplier' },
  { label: '৳50', fill: '#fbbf6b', edge: '#7c2d12', prize: 'BDT 50 cash' },
  { label: '৳1000', fill: '#ffd633', edge: '#8a5e00', prize: 'BDT 1,000 jackpot' },
];

interface Spin {
  id: string;
  handle: string;
  prize: string;
  timeAgo: string;
}

const RECENT_SPINS: Spin[] = [
  { id: 's1', handle: 'raf***21', prize: 'BDT 500 cash', timeAgo: '1m' },
  { id: 's2', handle: 'mim***45', prize: 'x2 bonus multiplier', timeAgo: '3m' },
  { id: 's3', handle: 'jub***82', prize: 'BDT 1,000 jackpot', timeAgo: '6m' },
  { id: 's4', handle: 'nas***77', prize: 'Free spin token', timeAgo: '9m' },
  { id: 's5', handle: 'kar***38', prize: 'BDT 100 cash', timeAgo: '12m' },
];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const largeArc = end - start <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} Z`;
}

export default function SpinScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const size = Math.min(width - 48, 320);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 6;
  const seg = 360 / SEGMENTS.length;

  const [spinning, setSpinning] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const target = useRef(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    // Land on a random segment after several full turns.
    target.current += 360 * 4 + Math.floor(Math.random() * 360);
    Animated.timing(rotation, {
      toValue: target.current,
      duration: 3600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setSpinning(false));
  };

  const spinDeg = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const slices = useMemo(
    () =>
      SEGMENTS.map((s, i) => {
        const start = i * seg;
        const end = start + seg;
        const mid = start + seg / 2;
        const labelPos = polar(cx, cy, radius * 0.64, mid);
        return { s, path: slicePath(cx, cy, radius, start, end), labelPos };
      }),
    [cx, cy, radius, seg],
  );

  return (
    <Screen
      className="!bg-darkbg"
      header={<GameHeader onBack={() => router.back()} />}
      contentClassName="px-4 pt-4 gap-5 items-center"
    >
      <StatusBar style="light" />

      <View className="items-center gap-1 self-stretch">
        <Text className="text-2xl font-black text-white">Lucky Spin</Text>
        <Text className="text-center text-xs text-dink-mid">
          One free spin daily. Land a segment to win the prize shown.
        </Text>
      </View>

      {/* Wheel */}
      <View style={{ width: size, height: size + 18 }} className="items-center justify-center">
        {/* Pointer */}
        <View className="absolute -top-1 z-10 items-center">
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 12,
              borderRightWidth: 12,
              borderTopWidth: 20,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: colors.gold400,
            }}
          />
        </View>

        <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="spin-gloss" cx="42%" cy="30%" r="75%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
                <Stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Outer gold ring */}
            <Circle cx={cx} cy={cy} r={radius + 4} fill="#1a0d18" stroke={colors.gold500} strokeWidth={3} />

            {slices.map(({ s, path, labelPos }, i) => (
              <G key={i}>
                <Path d={path} fill={s.fill} stroke={s.edge} strokeWidth={1.5} />
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#ffffff"
                  fontSize={size * 0.058}
                  fontWeight="900"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {s.label}
                </SvgText>
              </G>
            ))}

            {/* Gloss overlay */}
            <Circle cx={cx} cy={cy} r={radius} fill="url(#spin-gloss)" />
          </Svg>
        </Animated.View>

        {/* Center hub */}
        <View className="absolute h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/60">
          <Gradient colors={['#ffe066', '#f5b400', '#d89e00']} radius={999} />
          <Ionicons name="diamond" size={22} color={colors.ink} />
        </View>
      </View>

      {/* Spin button */}
      <View className="w-full max-w-[320px]">
        <PrimaryButton
          label={spinning ? 'Spinning...' : 'SPIN'}
          icon="sync"
          size="lg"
          fullWidth
          loading={spinning}
          onPress={spin}
        />
        <Text className="mt-2 text-center text-[11px] text-dink-lo">1 free spin left today</Text>
      </View>

      {/* Prize legend */}
      <View className="w-full gap-3">
        <SectionHeader title="Prize legend" subtitle="What each segment pays" icon="gift" />
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 10 }}>
          {SEGMENTS.map((s) => (
            <View
              key={s.label}
              style={{ width: '48.5%' }}
              className="flex-row items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 p-2.5"
            >
              <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
                <Gradient colors={[s.fill, s.edge]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={8} />
                <Text className="text-[10px] font-black text-white">{s.label}</Text>
              </View>
              <Text className="flex-1 text-[11px] font-semibold text-dink-mid" numberOfLines={2}>
                {s.prize}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent spins */}
      <View className="w-full gap-3">
        <SectionHeader title="Recent winners" subtitle="Live from the wheel" icon="trophy" />
        <View className="gap-2">
          {RECENT_SPINS.map((s) => (
            <View
              key={s.id}
              className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3"
            >
              <View className="h-9 w-9 items-center justify-center rounded-full border border-gold-600/40 bg-gold-500/15">
                <Ionicons name="person" size={16} color={colors.gold300} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-bold text-white">{s.handle}</Text>
                <Text className="text-[11px] text-dink-lo" numberOfLines={1}>
                  {s.prize}
                </Text>
              </View>
              <Text className="text-[10px] font-semibold text-dink-lo">{s.timeAgo}</Text>
            </View>
          ))}
        </View>
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
        <Text className="text-lg font-black text-white">Lucky Spin</Text>
      </View>
      <View className="flex-row items-center gap-1.5 rounded-pill border border-gold-600/40 bg-gold-500/15 px-2.5 py-1.5">
        <Ionicons name="wallet" size={13} color={colors.gold300} />
        <Text className="text-[11px] font-black text-white">{formatBDT(mockWallet.balance)}</Text>
      </View>
    </View>
  );
}
