// Built by Anointed Coder.
//
// TRANSACTIONS history, wired to the live ledger (GET /api/me/transactions).
// A filter chip row maps to the endpoint's server-side `type` filter, each row
// shows a type icon + label, description, date, a signed amount (green credit /
// red debit) and a status pill. The endpoint returns the newest `take` rows
// (no cursor), so "Load more" simply requests a larger take. Loading, error and
// empty states are all handled.

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, ChipToggle, EmptyState } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { useTransactions } from '@/lib/api/hooks';
import {
  type LedgerTransaction,
  type TransactionStatus,
  type TransactionType,
} from '@/lib/api/wallet';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
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

function statusStyle(status: TransactionStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', bg: 'rgba(35,194,107,0.12)', text: colors.newg };
    case 'pending':
      return { label: 'Pending', bg: 'rgba(245,180,0,0.15)', text: colors.gold700 };
    case 'failed':
      return { label: 'Failed', bg: 'rgba(255,78,58,0.12)', text: colors.hot };
    default:
      return {
        label: String(status).charAt(0).toUpperCase() + String(status).slice(1),
        bg: 'rgba(107,114,128,0.14)',
        text: colors.inkMute,
      };
  }
}

const FILTERS: { key: string; label: string; type: TransactionType | null }[] = [
  { key: 'all', label: 'All', type: null },
  { key: 'deposit', label: 'Deposits', type: 'deposit' },
  { key: 'withdraw', label: 'Withdrawals', type: 'withdraw' },
  { key: 'bet', label: 'Bets', type: 'bet' },
  { key: 'win', label: 'Wins', type: 'win' },
  { key: 'bonus', label: 'Bonus', type: 'bonus' },
];

const PAGE_SIZE = 25;

function formatTxnDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [filterKey, setFilterKey] = useState<string>('all');
  const [take, setTake] = useState<number>(PAGE_SIZE);

  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const query = useTransactions({ type: filter.type, take });
  const rows = query.data?.transactions ?? [];
  // Hide "Load more" as soon as every available row is shown (or the 200 cap is
  // hit), using the server-reported total, so we never fire a redundant fetch.
  const total = query.data?.total ?? 0;
  const hasMore = rows.length < total && take < 200;

  function onFilterChange(key: string) {
    setFilterKey(key);
    setTake(PAGE_SIZE);
  }

  return (
    <Screen
      header={<StackScreenHeader title="Transactions" subtitle="Your full wallet history" />}
      contentClassName="px-4 pt-3 gap-3"
    >
      <ChipToggle
        options={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        value={filterKey}
        onChange={onFilterChange}
        scroll
      />

      {query.isLoading ? (
        <View className="overflow-hidden rounded-2xl border border-divider bg-paper">
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              className={cn('flex-row items-center gap-3 px-4 py-3.5', i !== 0 && 'border-t border-divider')}
            >
              <View className="h-10 w-10 rounded-full bg-surfaceAlt" />
              <View className="flex-1 gap-1.5">
                <View className="h-3.5 w-24 rounded bg-surfaceAlt" />
                <View className="h-2.5 w-32 rounded bg-surfaceAlt" />
              </View>
              <View className="h-3.5 w-16 rounded bg-surfaceAlt" />
            </View>
          ))}
        </View>
      ) : query.isError ? (
        <EmptyState
          icon="cloud-offline"
          title="Could not load history"
          message="Something went wrong fetching your transactions. Please try again."
          actionLabel="Retry"
          onAction={() => query.refetch()}
          className="mt-6"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No transactions yet"
          message="When you deposit, withdraw or play, your activity shows up here."
          actionLabel="Make a deposit"
          onAction={() => router.push('/deposit')}
          className="mt-6"
        />
      ) : (
        <>
          <View className="overflow-hidden rounded-2xl border border-divider bg-paper">
            {rows.map((tx, i) => (
              <TxnRow key={tx.id} tx={tx} first={i === 0} />
            ))}
          </View>
          {hasMore ? (
            <Pressable
              onPress={() => setTake((t) => t + PAGE_SIZE)}
              disabled={query.isFetching}
              className="h-11 flex-row items-center justify-center gap-2 rounded-pill border border-divider bg-paper active:bg-surfaceAlt"
            >
              {query.isFetching ? (
                <ActivityIndicator size="small" color={colors.inkMute} />
              ) : (
                <Ionicons name="chevron-down" size={16} color={colors.inkSoft} />
              )}
              <Text className="text-sm font-bold text-ink-soft">
                {query.isFetching ? 'Loading...' : 'Load more'}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function TxnRow({ tx, first }: { tx: LedgerTransaction; first: boolean }) {
  const meta = TXN_META[tx.type] ?? { label: tx.type, icon: 'ellipse' as IconName, credit: true };
  const status = statusStyle(tx.status);
  // The ledger amount sign is the source of truth for credit vs debit; a zero
  // amount (e.g. a rejected deposit) falls back to the type's default tone.
  const isCredit = tx.amount > 0 || (tx.amount === 0 && meta.credit);
  const isZero = tx.amount === 0;
  const tint = isCredit ? colors.newg : colors.hot;
  const label = tx.description && tx.description.trim().length > 0 ? tx.description : meta.label;

  return (
    <View className={cn('flex-row items-center gap-3 px-4 py-3.5', !first && 'border-t border-divider')}>
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: isCredit ? 'rgba(35,194,107,0.12)' : 'rgba(255,78,58,0.10)' }}
      >
        <Ionicons name={meta.icon} size={18} color={tint} />
      </View>

      <View className="flex-1">
        <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
          {meta.label}
        </Text>
        <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
          {label !== meta.label ? `${label}  •  ` : ''}
          {formatTxnDate(tx.createdAt)}
        </Text>
      </View>

      <View className="items-end gap-1">
        <Text
          className="text-sm font-black"
          style={{ color: isZero ? colors.inkMute : tint }}
        >
          {isZero ? '' : isCredit ? '+' : '-'}
          {formatBDT(Math.abs(tx.amount), false)}
        </Text>
        <View className="rounded-md px-1.5 py-0.5" style={{ backgroundColor: status.bg }}>
          <Text
            className="text-[10px] font-black uppercase tracking-wider"
            style={{ color: status.text }}
          >
            {status.label}
          </Text>
        </View>
      </View>
    </View>
  );
}
