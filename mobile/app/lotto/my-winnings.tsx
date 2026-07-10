// Built by Anointed Coder.
//
// My Winnings: a stack screen with a total-won summary card and a list of
// winning rows (draw, matched count, prize, payout status pill). Falls back
// to an empty state when the player has no wins yet. All data is local mock.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Gradient, Badge, EmptyState, type BadgeVariant } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';

type PayoutStatus = 'paid' | 'processing';

interface Winning {
  id: string;
  draw: string;
  matched: number;
  prize: number;
  wonAt: string;
  status: PayoutStatus;
}

const WINNINGS: Winning[] = [
  { id: 'WN-4471', draw: 'Daily Dhamaka', matched: 5, prize: 12500, wonAt: '08 Jul, 18:10', status: 'paid' },
  { id: 'WN-4390', draw: 'Super Six', matched: 4, prize: 3200, wonAt: '05 Jul, 14:22', status: 'paid' },
  { id: 'WN-4288', draw: 'Mega Friday', matched: 3, prize: 900, wonAt: '04 Jul, 15:05', status: 'processing' },
  { id: 'WN-4102', draw: 'Flash Hourly', matched: 4, prize: 1800, wonAt: '02 Jul, 13:40', status: 'paid' },
];

const STATUS: Record<PayoutStatus, { label: string; variant: BadgeVariant }> = {
  paid: { label: 'PAID', variant: 'new' },
  processing: { label: 'PROCESSING', variant: 'gold' },
};

export default function MyWinningsScreen() {
  const router = useRouter();
  const total = WINNINGS.reduce((sum, w) => sum + w.prize, 0);

  return (
    <Screen header={<BackHeader title="My Winnings" />} contentClassName="px-4 pt-3 gap-3">
      {WINNINGS.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No winnings yet"
          message="Your prizes will show here the moment a draw goes your way."
          actionLabel="Enter a draw"
          onAction={() => router.push('/lotto')}
        />
      ) : (
        <>
          {/* Total summary */}
          <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
            <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
            <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-500/15" />
            <View className="relative flex-row items-center justify-between p-4">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                  Total won
                </Text>
                <Text className="mt-1 text-3xl font-black" style={{ color: colors.gold300 }}>
                  {formatBDT(total)}
                </Text>
                <Text className="mt-0.5 text-[11px] text-white/45">
                  Across {WINNINGS.length} winning tickets
                </Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-white/5">
                <Ionicons name="trophy" size={26} color={colors.gold300} />
              </View>
            </View>
          </View>

          {WINNINGS.map((w) => {
            const s = STATUS[w.status];
            return (
              <View
                key={w.id}
                className="flex-row items-center gap-3 rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-newg/15">
                  <Ionicons name="sparkles" size={18} color={colors.newg} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-ink">{w.draw}</Text>
                  <Text className="text-[11px] text-ink-mute">
                    {w.matched} matched - {w.wonAt}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-base font-black text-gold-700">{formatBDT(w.prize)}</Text>
                  <Badge label={s.label} variant={s.variant} />
                </View>
              </View>
            );
          })}
        </>
      )}
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
