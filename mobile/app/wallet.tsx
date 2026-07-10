// Built by Anointed Coder.
//
// WALLET overview. A dark premium balance island (main balance, bonus and
// locked sub-stats, Deposit / Withdraw / History strip), a recent-activity
// preview list, and an active-bonus turnover progress card. Static, mock
// only, mirroring the web (site)/wallet page.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Card, SectionHeader, Badge, Gradient } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { mockUser, mockTransactions, type Transaction, type TxnType } from '@/lib/mock';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useBalance } from '@/lib/api/hooks';

type IconName = keyof typeof Ionicons.glyphMap;

// Display metadata per transaction type: icon, colour tint, and whether the
// amount reads as a credit (green +) or a debit (red -).
const TXN_META: Record<TxnType, { label: string; icon: IconName; positive: boolean }> = {
  deposit: { label: 'Deposit', icon: 'arrow-down', positive: true },
  withdraw: { label: 'Withdrawal', icon: 'arrow-up', positive: false },
  bonus: { label: 'Bonus', icon: 'gift', positive: true },
  bet: { label: 'Bet', icon: 'dice', positive: false },
  win: { label: 'Win', icon: 'trophy', positive: true },
};

// Mock turnover progress for the active welcome bonus.
const TURNOVER_WAGERED = 3200;
const TURNOVER_TARGET = 5000;

export default function WalletScreen() {
  const router = useRouter();
  const { data: wallet } = useBalance();
  const balance = wallet?.balance ?? 0;
  const bonusBalance = wallet?.bonusBalance ?? 0;
  const lockedBalance = wallet?.lockedBalance ?? 0;
  const preview = mockTransactions.slice(0, 4);
  const pct = Math.min(100, Math.round((TURNOVER_WAGERED / TURNOVER_TARGET) * 100));

  return (
    <Screen
      header={
        <StackScreenHeader
          title="Wallet"
          subtitle="Balance, bonuses and activity"
          right={
            <Pressable
              onPress={() => router.push('/transactions')}
              hitSlop={6}
              className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
            >
              <Ionicons name="receipt-outline" size={20} color={colors.ink} />
            </Pressable>
          }
        />
      }
      contentClassName="px-4 pt-4 gap-4"
    >
      {/* Dark premium balance island */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gold-500/15" />
        <View className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-neon/10" />

        <View className="relative p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-white/60">
              Total balance
            </Text>
            <View className="flex-row items-center gap-1.5 rounded-pill border border-white/10 bg-white/5 px-2.5 py-1">
              <View className="h-1.5 w-1.5 rounded-full bg-neon" />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                {mockUser.vipTier} VIP
              </Text>
            </View>
          </View>

          <Text className="mt-2 text-4xl font-black" style={{ color: colors.gold300 }}>
            {formatBDT(balance)}
          </Text>
          <Text className="mt-1 text-[11px] text-white/45">Available to play and withdraw</Text>

          {/* Bonus + locked sub-stats */}
          <View className="mt-4 flex-row gap-2">
            <SubStat icon="sparkles" label="Bonus" value={bonusBalance} tint={colors.neon} />
            <SubStat icon="lock-closed" label="Locked" value={lockedBalance} tint={colors.gold300} />
          </View>

          {/* Action strip */}
          <View className="mt-4 flex-row items-stretch gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            <BalanceAction icon="arrow-down" label="Deposit" active onPress={() => router.push('/deposit')} />
            <BalanceAction icon="arrow-up" label="Withdraw" onPress={() => router.push('/withdraw')} />
            <BalanceAction icon="time-outline" label="History" onPress={() => router.push('/transactions')} />
          </View>
        </View>
      </View>

      {/* Recent activity preview */}
      <View className="gap-3">
        <SectionHeader
          title="Recent activity"
          subtitle="Your latest wallet movements"
          icon="pulse"
          onAction={() => router.push('/transactions')}
        />
        <Card padded={false} className="px-4">
          {preview.map((tx, i) => (
            <PreviewRow key={tx.id} tx={tx} first={i === 0} />
          ))}
        </Card>
      </View>

      {/* Active bonus / turnover progress */}
      <View className="gap-3">
        <SectionHeader title="Bonuses" subtitle="Turnover to unlock" icon="gift" />
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 pr-2">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
                <Ionicons name="trophy" size={18} color={colors.gold700} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
                  Welcome Bonus
                </Text>
                <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
                  Wager to release {formatBDT(bonusBalance)}
                </Text>
              </View>
            </View>
            <Badge label="Active" variant="new" />
          </View>

          {/* Progress bar */}
          <View className="mt-4">
            <View className="h-2.5 w-full overflow-hidden rounded-pill bg-surfaceAlt">
              <View style={{ width: `${pct}%` }} className="relative h-full overflow-hidden rounded-pill">
                <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              </View>
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-[11px] text-ink-mute">
                Wagered {formatBDT(TURNOVER_WAGERED)}
              </Text>
              <Text className="text-[11px] font-bold text-ink">
                {pct}% of {formatBDT(TURNOVER_TARGET)}
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

// A bonus/locked sub-stat pill inside the dark balance island.
function SubStat({
  icon,
  label,
  value,
  tint,
}: {
  icon: IconName;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <Ionicons name={icon} size={16} color={tint} />
      <View className="flex-1">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-white/50" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-sm font-black text-white" numberOfLines={1}>
          {formatBDT(value)}
        </Text>
      </View>
    </View>
  );
}

// One tap target in the dark action strip (Deposit / Withdraw / History).
function BalanceAction({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="relative flex-1 flex-row items-center justify-center gap-1.5 overflow-hidden rounded-lg py-2.5 active:opacity-90"
    >
      {active ? <Gradient colors={gradients.gold} radius={8} /> : null}
      <Ionicons name={icon} size={15} color={active ? colors.ink : colors.gold300} />
      <Text className={cn('text-xs font-bold', active ? 'text-ink' : 'text-white/85')}>{label}</Text>
    </Pressable>
  );
}

// Compact transaction row for the wallet preview list.
function PreviewRow({ tx, first }: { tx: Transaction; first: boolean }) {
  const meta = TXN_META[tx.type];
  const tint = meta.positive ? colors.newg : colors.hot;
  return (
    <View
      className={cn(
        'flex-row items-center gap-3 py-3',
        !first && 'border-t border-divider',
      )}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: meta.positive ? 'rgba(35,194,107,0.12)' : 'rgba(255,78,58,0.10)' }}
      >
        <Ionicons name={meta.icon} size={16} color={tint} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-ink" numberOfLines={1}>
          {meta.label}
        </Text>
        <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
          {tx.method}
        </Text>
      </View>
      <Text className="text-sm font-black" style={{ color: tint }}>
        {meta.positive ? '+' : '-'}
        {formatBDT(tx.amount, false)}
      </Text>
    </View>
  );
}
