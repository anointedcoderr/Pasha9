// Built by Anointed Coder.
//
// WALLET overview, wired to the live backend. The dark balance island reads
// live main / bonus / locked balances from GET /api/bonuses/me, the recent
// activity preview reads the newest rows from GET /api/me/transactions, and the
// turnover progress card is computed from the active bonus grants returned by
// /api/bonuses/me. Pull-to-refresh refetches both.

import { useCallback } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Card, SectionHeader, Badge, Gradient } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { useAuth } from '@/store/auth';
import { useBonuses, useTransactions } from '@/lib/api/hooks';
import { type BonusGrant, type LedgerTransaction, type TransactionType } from '@/lib/api/wallet';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

const TXN_META: Record<TransactionType, { label: string; icon: IconName; credit: boolean }> = {
  deposit: { label: 'Deposit', icon: 'arrow-down', credit: true },
  withdraw: { label: 'Withdrawal', icon: 'arrow-up', credit: false },
  bonus: { label: 'Bonus', icon: 'gift', credit: true },
  referral: { label: 'Referral', icon: 'people', credit: true },
  bet: { label: 'Bet', icon: 'dice', credit: false },
  win: { label: 'Win', icon: 'trophy', credit: true },
  adjust: { label: 'Adjustment', icon: 'swap-horizontal', credit: true },
};

// Aggregate the active bonus grants into a single turnover progress figure.
function activeTurnover(grants: BonusGrant[]): {
  name: string;
  progress: number;
  required: number;
  pct: number;
} | null {
  const active = grants.filter((g) => g.status === 'active' && g.turnoverRequired > 0);
  if (active.length === 0) return null;
  const progress = active.reduce((s, g) => s + g.turnoverProgress, 0);
  const required = active.reduce((s, g) => s + g.turnoverRequired, 0);
  const pct = required > 0 ? Math.min(100, Math.round((progress / required) * 100)) : 0;
  const name = active[0].rule?.name ?? 'Active bonus';
  return { name, progress, required, pct };
}

export default function WalletScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const bonusesQuery = useBonuses();
  const txQuery = useTransactions({ take: 4 });

  const wallet = bonusesQuery.data?.wallet;
  const balance = wallet?.balance ?? 0;
  const bonusBalance = wallet?.bonusBalance ?? 0;
  const lockedBalance = wallet?.lockedBalance ?? 0;
  const preview = txQuery.data?.transactions ?? [];
  const turnover = activeTurnover(bonusesQuery.data?.grants ?? []);
  const vipLabel = user?.vipTier ? `${user.vipTier} VIP` : 'Member';

  const refreshing = bonusesQuery.isRefetching || txQuery.isRefetching;
  const onRefresh = useCallback(() => {
    bonusesQuery.refetch();
    txQuery.refetch();
  }, [bonusesQuery, txQuery]);

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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold600} />
      }
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
                {vipLabel}
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
        {txQuery.isLoading ? (
          <Card padded={false} className="px-4">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className={cn('flex-row items-center gap-3 py-3', i !== 0 && 'border-t border-divider')}
              >
                <View className="h-9 w-9 rounded-full bg-surfaceAlt" />
                <View className="flex-1 gap-1.5">
                  <View className="h-3 w-24 rounded bg-surfaceAlt" />
                  <View className="h-2.5 w-16 rounded bg-surfaceAlt" />
                </View>
                <View className="h-3 w-14 rounded bg-surfaceAlt" />
              </View>
            ))}
          </Card>
        ) : txQuery.isError ? (
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-ink-mute">Could not load recent activity.</Text>
              <Pressable onPress={() => txQuery.refetch()} hitSlop={8}>
                <Text className="text-sm font-bold text-gold-700">Retry</Text>
              </Pressable>
            </View>
          </Card>
        ) : preview.length === 0 ? (
          <Card>
            <Text className="text-sm text-ink-mute">
              No activity yet. Your deposits, withdrawals and plays will appear here.
            </Text>
          </Card>
        ) : (
          <Card padded={false} className="px-4">
            {preview.map((tx, i) => (
              <PreviewRow key={tx.id} tx={tx} first={i === 0} />
            ))}
          </Card>
        )}
      </View>

      {/* Active bonus / turnover progress */}
      {turnover ? (
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
                    {turnover.name}
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
                <View
                  style={{ width: `${turnover.pct}%` }}
                  className="relative h-full overflow-hidden rounded-pill"
                >
                  <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
                </View>
              </View>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-[11px] text-ink-mute">Wagered {formatBDT(turnover.progress)}</Text>
                <Text className="text-[11px] font-bold text-ink">
                  {turnover.pct}% of {formatBDT(turnover.required)}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      ) : null}
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
function PreviewRow({ tx, first }: { tx: LedgerTransaction; first: boolean }) {
  const meta = TXN_META[tx.type] ?? { label: tx.type, icon: 'ellipse' as IconName, credit: true };
  const isCredit = tx.amount > 0 || (tx.amount === 0 && meta.credit);
  const isZero = tx.amount === 0;
  const tint = isCredit ? colors.newg : colors.hot;
  return (
    <View className={cn('flex-row items-center gap-3 py-3', !first && 'border-t border-divider')}>
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: isCredit ? 'rgba(35,194,107,0.12)' : 'rgba(255,78,58,0.10)' }}
      >
        <Ionicons name={meta.icon} size={16} color={tint} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-ink" numberOfLines={1}>
          {meta.label}
        </Text>
        <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
          {tx.status}
        </Text>
      </View>
      <Text className="text-sm font-black" style={{ color: isZero ? colors.inkMute : tint }}>
        {isZero ? '' : isCredit ? '+' : '-'}
        {formatBDT(Math.abs(tx.amount), false)}
      </Text>
    </View>
  );
}
