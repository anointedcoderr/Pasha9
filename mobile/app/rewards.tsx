// Built by Anointed Coder.
//
// Rewards hub (stack route): a points balance header, a 7-day daily check-in
// strip, a spin-wheel teaser that links to /games/spin, and a rewards-store
// grid of redeemable items. All values are local mock; redeem / check-in are
// visual only.

import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Gradient, PrimaryButton } from '@/components/ui';
import { colors, gradients } from '@/lib/theme';

type DayState = 'claimed' | 'today' | 'locked';

interface CheckinDay {
  day: number;
  reward: number;
  state: DayState;
}

const POINTS = 3200;

const DAYS: CheckinDay[] = [
  { day: 1, reward: 20, state: 'claimed' },
  { day: 2, reward: 30, state: 'claimed' },
  { day: 3, reward: 40, state: 'claimed' },
  { day: 4, reward: 60, state: 'today' },
  { day: 5, reward: 80, state: 'locked' },
  { day: 6, reward: 120, state: 'locked' },
  { day: 7, reward: 300, state: 'locked' },
];

interface StoreItem {
  id: string;
  name: string;
  cost: number;
  icon: keyof typeof Ionicons.glyphMap;
}

const STORE: StoreItem[] = [
  { id: 's1', name: 'BDT 100 Bonus', cost: 1000, icon: 'cash' },
  { id: 's2', name: '10 Free Spins', cost: 800, icon: 'sync' },
  { id: 's3', name: 'BDT 500 Bonus', cost: 4500, icon: 'wallet' },
  { id: 's4', name: 'Mystery Box', cost: 2500, icon: 'cube' },
  { id: 's5', name: 'Cashback Boost', cost: 1500, icon: 'trending-up' },
  { id: 's6', name: 'VIP Fast Track', cost: 6000, icon: 'diamond' },
];

export default function RewardsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const GAP = 12;
  const tileW = (width - 32 - GAP) / 2;

  return (
    <Screen header={<BackHeader title="Rewards" />} contentClassName="px-4 pt-3 gap-4">
      {/* Points balance */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />
        <View className="relative flex-row items-center justify-between p-4">
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
              Reward points
            </Text>
            <Text className="mt-1 text-3xl font-black" style={{ color: colors.gold300 }}>
              {POINTS.toLocaleString()}
            </Text>
            <Text className="mt-0.5 text-[11px] text-white/45">Earn more by playing daily</Text>
          </View>
          <View className="h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-white/5">
            <Ionicons name="star" size={26} color={colors.gold300} />
          </View>
        </View>
      </View>

      {/* Daily check-in */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-extrabold text-ink">Daily check-in</Text>
          <Text className="text-[11px] font-bold text-gold-700">Day 4 of 7</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {DAYS.map((d) => {
            const claimed = d.state === 'claimed';
            const today = d.state === 'today';
            return (
              <View
                key={d.day}
                className={
                  'w-16 items-center rounded-xl border py-3 ' +
                  (today
                    ? 'border-gold-600 bg-gold-500/15'
                    : claimed
                      ? 'border-divider bg-surface'
                      : 'border-divider bg-paper')
                }
              >
                <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">
                  Day {d.day}
                </Text>
                <View
                  className={
                    'my-1.5 h-8 w-8 items-center justify-center rounded-full ' +
                    (claimed ? 'bg-newg/15' : today ? 'bg-gold-500' : 'bg-surfaceAlt')
                  }
                >
                  <Ionicons
                    name={claimed ? 'checkmark' : 'star'}
                    size={15}
                    color={claimed ? colors.newg : today ? colors.ink : colors.inkMute}
                  />
                </View>
                <Text
                  className="text-[11px] font-black"
                  style={{ color: today ? colors.gold700 : colors.inkSoft }}
                >
                  +{d.reward}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <PrimaryButton label="Check in today" icon="calendar" fullWidth className="mt-3" />
      </View>

      {/* Spin-wheel teaser */}
      <Pressable
        onPress={() => router.push('/games/spin')}
        className="relative overflow-hidden rounded-2xl border border-gold-600/20 active:opacity-90"
      >
        <Gradient colors={gradients.hot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -left-6 -bottom-8 h-32 w-32 rounded-full bg-white/10" />
        <View className="relative flex-row items-center gap-3 p-4">
          <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-white/40 bg-white/10">
            <Ionicons name="disc" size={28} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-black text-white">Daily Spin</Text>
            <Text className="mt-0.5 text-xs font-medium text-white/85">
              Spin the wheel for a free reward every day
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </View>
      </Pressable>

      {/* Rewards store */}
      <View className="gap-3">
        <Text className="text-base font-extrabold text-ink">Rewards store</Text>
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: GAP }}>
          {STORE.map((item) => {
            const affordable = POINTS >= item.cost;
            return (
              <View
                key={item.id}
                style={{ width: tileW }}
                className="rounded-2xl border border-divider bg-paper p-3.5 shadow-sm shadow-black/5"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
                  <Ionicons name={item.icon} size={20} color={colors.gold700} />
                </View>
                <Text className="mt-2.5 text-sm font-extrabold text-ink" numberOfLines={1}>
                  {item.name}
                </Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <Ionicons name="star" size={12} color={colors.gold600} />
                  <Text className="text-xs font-bold text-ink-soft">
                    {item.cost.toLocaleString()} pts
                  </Text>
                </View>
                <PrimaryButton
                  label="Redeem"
                  size="sm"
                  fullWidth
                  disabled={!affordable}
                  className="mt-3"
                />
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

function BackHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-2 border-b border-divider bg-paper px-3 py-2.5">
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text className="text-lg font-black text-ink">{title}</Text>
    </View>
  );
}
