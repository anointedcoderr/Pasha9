// Built by Anointed Coder.
//
// VIP Club: the loyalty screen. A dark premium current-tier card with a
// progress bar to the next tier, a horizontal tier ladder (Bronze..Diamond),
// and a benefits comparison table (cashback %, withdrawal priority, gifts).
// Static, driven by mockVipTiers.

import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Gradient, SectionHeader } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { mockUser, mockVipTiers } from '@/lib/mock';
import { cn } from '@/lib/cn';

// The signed-in player's loyalty points (mock). Sits inside the Gold band so
// the progress bar shows a partial climb toward Platinum.
const CURRENT_POINTS = 42_500;

// Per-tier benefit copy for the comparison table. Cashback comes from the
// shared mock; priority and gifts are presentation-only labels.
const BENEFITS: Record<string, { priority: string; gifts: string }> = {
  bronze: { priority: 'Standard', gifts: 'Welcome gift' },
  silver: { priority: 'Faster', gifts: 'Birthday bonus' },
  gold: { priority: 'Priority', gifts: 'Monthly gifts' },
  platinum: { priority: 'VIP lane', gifts: 'Event invites' },
  diamond: { priority: 'Instant', gifts: 'Luxury gifts' },
};

export default function VipScreen() {
  const currentIndex = mockVipTiers.findIndex(
    (t) => t.name.toLowerCase() === mockUser.vipTier.toLowerCase(),
  );
  const current = mockVipTiers[currentIndex] ?? mockVipTiers[0];
  const next = mockVipTiers[currentIndex + 1] ?? null;

  const span = next ? next.minPoints - current.minPoints : 1;
  const progress = next
    ? Math.min(1, Math.max(0, (CURRENT_POINTS - current.minPoints) / span))
    : 1;
  const pointsToNext = next ? Math.max(0, next.minPoints - CURRENT_POINTS) : 0;

  return (
    <Screen header={<BackHeader title="VIP Club" subtitle="Loyalty rewards" />} contentClassName="px-4 pt-4 gap-5">
      {/* Current tier card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-500/30">
        <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gold-500/15" />

        <View className="relative p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5 rounded-pill border border-gold-500/40 bg-gold-500/10 px-3 py-1">
              <Ionicons name="diamond" size={12} color={colors.gold300} />
              <Text className="text-[11px] font-black uppercase tracking-widest" style={{ color: colors.gold300 }}>
                Your tier
              </Text>
            </View>
            <View className="rounded-pill bg-white/10 px-2.5 py-1">
              <Text className="text-[11px] font-black" style={{ color: colors.neon }}>
                {current.cashback} cashback
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row items-center gap-3">
            <View
              className="relative h-14 w-14 items-center justify-center overflow-hidden rounded-2xl"
              style={{ borderWidth: 2, borderColor: current.color }}
            >
              <Gradient colors={gradients.gold} radius={16} />
              <Ionicons name="diamond" size={26} color={colors.ink} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-black text-white">{current.name}</Text>
              <Text className="text-xs font-semibold text-white/60">
                {CURRENT_POINTS.toLocaleString('en-US')} loyalty points
              </Text>
            </View>
          </View>

          {/* Progress to next tier */}
          <View className="mt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                {next ? `Progress to ${next.name}` : 'Top tier reached'}
              </Text>
              <Text className="text-[11px] font-black" style={{ color: colors.gold300 }}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
            <View className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <View className="relative h-full overflow-hidden rounded-full" style={{ width: `${progress * 100}%` }}>
                <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              </View>
            </View>
            <Text className="mt-2 text-[11px] font-semibold text-white/60">
              {next
                ? `${pointsToNext.toLocaleString('en-US')} points to unlock ${next.name}`
                : 'You enjoy every Diamond privilege.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tier ladder */}
      <View className="gap-3">
        <SectionHeader title="Tier ladder" subtitle="Climb from Bronze to Diamond" icon="trending-up" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 8 }}
        >
          {mockVipTiers.map((tier, i) => {
            const active = i === currentIndex;
            const cleared = i < currentIndex;
            return (
              <View
                key={tier.key}
                className={cn(
                  'w-[116px] items-center rounded-2xl border p-3',
                  active ? 'border-gold-500 bg-gold-500/10' : 'border-divider bg-paper',
                )}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${tier.color}22`, borderWidth: 2, borderColor: tier.color }}
                >
                  <Ionicons
                    name={cleared ? 'checkmark' : 'diamond'}
                    size={20}
                    color={tier.color}
                  />
                </View>
                <Text className="mt-2 text-sm font-black text-ink">{tier.name}</Text>
                <Text className="text-[10px] font-semibold text-ink-mute">
                  {tier.minPoints === 0 ? 'Start' : `${(tier.minPoints / 1000).toFixed(0)}k pts`}
                </Text>
                <View className="mt-1.5 rounded-pill bg-gold-500/15 px-2 py-0.5">
                  <Text className="text-[10px] font-black text-gold-700">{tier.cashback}</Text>
                </View>
                {active ? (
                  <View className="mt-1.5 rounded-pill bg-gold-500 px-2 py-0.5">
                    <Text className="text-[9px] font-black uppercase tracking-wider text-ink">You</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Benefits comparison */}
      <View className="gap-3">
        <SectionHeader title="Benefits" subtitle="What each tier unlocks" icon="gift" />
        <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
          {/* Header row */}
          <View className="flex-row items-center border-b border-divider bg-surface px-3 py-2.5">
            <Text className="flex-[1.1] text-[11px] font-black uppercase tracking-wider text-ink-mute">Tier</Text>
            <Text className="flex-1 text-center text-[11px] font-black uppercase tracking-wider text-ink-mute">Cashback</Text>
            <Text className="flex-1 text-center text-[11px] font-black uppercase tracking-wider text-ink-mute">Withdraw</Text>
            <Text className="flex-1 text-right text-[11px] font-black uppercase tracking-wider text-ink-mute">Gifts</Text>
          </View>
          {mockVipTiers.map((tier, i) => {
            const active = i === currentIndex;
            const benefit = BENEFITS[tier.key];
            return (
              <View
                key={tier.key}
                className={cn(
                  'flex-row items-center px-3 py-3',
                  i > 0 && 'border-t border-divider',
                  active && 'bg-gold-500/10',
                )}
              >
                <View className="flex-[1.1] flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
                  <Text className={cn('text-xs font-black', active ? 'text-ink' : 'text-ink-soft')} numberOfLines={1}>
                    {tier.name}
                  </Text>
                </View>
                <Text className="flex-1 text-center text-xs font-black text-gold-700">{tier.cashback}</Text>
                <Text className="flex-1 text-center text-[11px] font-semibold text-ink-soft" numberOfLines={1}>
                  {benefit.priority}
                </Text>
                <Text className="flex-1 text-right text-[11px] font-semibold text-ink-soft" numberOfLines={1}>
                  {benefit.gifts}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

// Slim back header for stack routes.
function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
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
      <View className="flex-1">
        <Text className="text-lg font-black text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
