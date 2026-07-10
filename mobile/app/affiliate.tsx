// Built by Anointed Coder.
//
// Affiliate (stack route): a hero with an apply CTA, an affiliate stats row,
// a commission-tiers table and a closing call to action. All values are
// local mock; the Apply button is visual only. Static screen.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Gradient, StatRow, Badge, PrimaryButton } from '@/components/ui';
import { colors, gradients } from '@/lib/theme';

interface CommissionTier {
  name: string;
  players: string;
  rate: string;
  current?: boolean;
}

const TIERS: CommissionTier[] = [
  { name: 'Starter', players: '1 - 10', rate: '25%' },
  { name: 'Pro', players: '11 - 50', rate: '35%', current: true },
  { name: 'Elite', players: '51 - 150', rate: '40%' },
  { name: 'Legend', players: '151+', rate: '45%' },
];

const PERKS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'cash-outline', label: 'Lifetime revenue share' },
  { icon: 'time-outline', label: 'Weekly on-time payouts' },
  { icon: 'stats-chart-outline', label: 'Real-time dashboard' },
];

export default function AffiliateScreen() {
  const router = useRouter();

  return (
    <Screen header={<BackHeader title="Affiliate" />} contentClassName="px-4 pt-3 gap-4">
      {/* Hero */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gold-500/15" />

        <View className="relative p-5">
          <View className="self-start">
            <Badge label="EARN WITH US" variant="gold" />
          </View>
          <Text className="mt-3 text-2xl font-black leading-tight text-white">
            Become a Pasha9 Affiliate
          </Text>
          <Text className="mt-2 text-sm text-white/70">
            Refer players and earn up to 45% lifetime revenue share. No caps, no hidden cuts.
          </Text>

          <View className="mt-4 gap-2">
            {PERKS.map((p) => (
              <View key={p.label} className="flex-row items-center gap-2">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-gold-500/20">
                  <Ionicons name={p.icon} size={13} color={colors.gold300} />
                </View>
                <Text className="text-[13px] font-medium text-white/85">{p.label}</Text>
              </View>
            ))}
          </View>

          <PrimaryButton label="Apply now" icon="rocket" fullWidth className="mt-5" />
        </View>
      </View>

      {/* Stats */}
      <StatRow
        items={[
          { label: 'Clicks', value: '1,240', icon: 'link' },
          { label: 'Sign-ups', value: '86', icon: 'person-add', valueTone: 'blue' },
          { label: 'Commission', value: 'BDT 24,500', icon: 'cash', valueTone: 'gold' },
        ]}
      />

      {/* Commission tiers table */}
      <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
        <View className="flex-row items-center border-b border-divider bg-surface px-4 py-2.5">
          <Text className="flex-1 text-[11px] font-black uppercase tracking-wider text-ink-mute">
            Tier
          </Text>
          <Text className="w-24 text-center text-[11px] font-black uppercase tracking-wider text-ink-mute">
            Players
          </Text>
          <Text className="w-20 text-right text-[11px] font-black uppercase tracking-wider text-ink-mute">
            Rate
          </Text>
        </View>

        {TIERS.map((t, i) => (
          <View
            key={t.name}
            className={
              'flex-row items-center px-4 py-3 ' +
              (i > 0 ? 'border-t border-divider ' : '') +
              (t.current ? 'bg-gold-500/10' : '')
            }
          >
            <View className="flex-1 flex-row items-center gap-2">
              <Text className="text-sm font-extrabold text-ink">{t.name}</Text>
              {t.current ? <Badge label="YOU" variant="gold" /> : null}
            </View>
            <Text className="w-24 text-center text-sm font-medium text-ink-soft">{t.players}</Text>
            <Text className="w-20 text-right text-sm font-black text-gold-700">{t.rate}</Text>
          </View>
        ))}
      </View>

      {/* Closing CTA */}
      <View className="items-center rounded-2xl border border-divider bg-paper p-5 shadow-sm shadow-black/5">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-gold-500/15">
          <Ionicons name="megaphone" size={24} color={colors.gold700} />
        </View>
        <Text className="mt-3 text-center text-base font-extrabold text-ink">
          Ready to grow your income?
        </Text>
        <Text className="mt-1 max-w-[280px] text-center text-sm text-ink-mute">
          Join the Pasha9 partner network and start earning from every player you bring in.
        </Text>
        <View className="mt-4 w-full flex-row gap-2">
          <PrimaryButton label="Apply now" className="flex-1" />
          <Pressable
            onPress={() => router.push('/legal')}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-pill border border-divider bg-paper py-3 active:bg-surfaceAlt"
          >
            <Text className="text-sm font-bold text-ink-soft">Terms</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.inkMute} />
          </Pressable>
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
