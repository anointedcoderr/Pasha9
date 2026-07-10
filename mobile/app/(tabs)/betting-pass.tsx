// Built by Anointed Coder.
//
// Betting Pass: a season header with a level + XP progress bar, then a
// vertical track of reward tiers. Each tier is a node on a connected rail
// with a reward card to the right; unlocked-but-unclaimed tiers show a Claim
// button, claimed tiers show a check, locked tiers show a lock. Static mock.

import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Gradient, Badge, PrimaryButton } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { gradients, colors } from '@/lib/theme';

type TierState = 'claimed' | 'unlocked' | 'locked';

interface Tier {
  level: number;
  reward: string;
  icon: keyof typeof Ionicons.glyphMap;
  xp: number;
  state: TierState;
}

const SEASON = {
  name: 'Season 4',
  level: 3,
  xp: 2450,
  nextXp: 3000,
};

const TIERS: Tier[] = [
  { level: 1, reward: 'BDT 50 Free Bet', icon: 'cash', xp: 500, state: 'claimed' },
  { level: 2, reward: '20 Free Spins', icon: 'sync', xp: 1200, state: 'claimed' },
  { level: 3, reward: 'BDT 150 Bonus', icon: 'gift', xp: 2000, state: 'unlocked' },
  { level: 4, reward: 'Mystery Box', icon: 'cube', xp: 3000, state: 'locked' },
  { level: 5, reward: 'BDT 500 Cashback', icon: 'wallet', xp: 4200, state: 'locked' },
  { level: 6, reward: 'Grand Reward', icon: 'diamond', xp: 6000, state: 'locked' },
];

export default function BettingPassScreen() {
  const pct = Math.min(100, Math.round((SEASON.xp / SEASON.nextXp) * 100));

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      {/* Season header */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />

        <View className="relative p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                Betting Pass
              </Text>
              <Text className="text-xl font-black text-white">{SEASON.name}</Text>
            </View>
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
              <Gradient colors={gradients.gold} radius={16} />
              <Text className="text-lg font-black text-ink">{SEASON.level}</Text>
            </View>
          </View>

          {/* XP bar */}
          <View className="mt-4">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-white/70">Level {SEASON.level}</Text>
              <Text className="text-[11px] font-bold text-white/70">
                {SEASON.xp.toLocaleString()} / {SEASON.nextXp.toLocaleString()} XP
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <View className="relative h-full overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
                <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              </View>
            </View>
            <Text className="mt-1.5 text-[11px] text-white/50">
              {SEASON.nextXp - SEASON.xp} XP to Level {SEASON.level + 1}
            </Text>
          </View>
        </View>
      </View>

      {/* Reward track */}
      <View>
        {TIERS.map((t, i) => (
          <TierRow key={t.level} tier={t} isFirst={i === 0} isLast={i === TIERS.length - 1} />
        ))}
      </View>
    </Screen>
  );
}

function TierRow({ tier, isFirst, isLast }: { tier: Tier; isFirst: boolean; isLast: boolean }) {
  const claimed = tier.state === 'claimed';
  const unlocked = tier.state === 'unlocked';
  const locked = tier.state === 'locked';

  return (
    <View className="flex-row items-stretch gap-3">
      {/* Left rail with connector + node */}
      <View className="w-9 items-center">
        {!isFirst ? <View className="absolute top-0 h-1/2 w-0.5 bg-divider" /> : null}
        {!isLast ? <View className="absolute bottom-0 h-1/2 w-0.5 bg-divider" /> : null}
        <View
          className={
            'mt-4 h-9 w-9 items-center justify-center rounded-full border-2 ' +
            (claimed
              ? 'border-gold-600 bg-gold-500'
              : unlocked
                ? 'border-gold-600 bg-gold-500/15'
                : 'border-divider bg-surfaceAlt')
          }
        >
          <Ionicons
            name={claimed ? 'checkmark' : locked ? 'lock-closed' : tier.icon}
            size={16}
            color={claimed ? colors.ink : unlocked ? colors.gold700 : colors.inkMute}
          />
        </View>
      </View>

      {/* Reward card */}
      <View
        className={
          'mb-3 flex-1 flex-row items-center gap-3 rounded-2xl border p-3.5 ' +
          (locked
            ? 'border-divider bg-surface'
            : 'border-divider bg-paper shadow-sm shadow-black/5')
        }
      >
        <View
          className={
            'h-11 w-11 items-center justify-center rounded-xl ' +
            (locked ? 'bg-surfaceAlt' : 'bg-gold-500/15')
          }
        >
          <Ionicons name={tier.icon} size={20} color={locked ? colors.inkMute : colors.gold700} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className={'text-sm font-extrabold ' + (locked ? 'text-ink-mute' : 'text-ink')}>
              {tier.reward}
            </Text>
            {claimed ? <Badge label="CLAIMED" variant="new" /> : null}
          </View>
          <Text className="mt-0.5 text-[11px] text-ink-mute">
            Level {tier.level} - {tier.xp.toLocaleString()} XP
          </Text>
        </View>

        {unlocked ? (
          <PrimaryButton label="Claim" size="sm" />
        ) : locked ? (
          <Ionicons name="lock-closed" size={16} color={colors.inkMute} />
        ) : null}
      </View>
    </View>
  );
}
