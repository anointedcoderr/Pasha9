// Built by Anointed Coder.
//
// TRANSACTIONS history. A filter chip row (All / Deposits / Withdrawals /
// Bets / Bonus) over a list of transaction rows: type icon, label, method,
// date, signed amount (green credit / red debit) and a status pill. Falls
// back to a designed empty state when a filter has no matches. Mock only.

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, ChipToggle, EmptyState } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import {
  mockTransactions,
  type Transaction,
  type TxnType,
  type TxnStatus,
} from '@/lib/mock';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

const TXN_META: Record<TxnType, { label: string; icon: IconName; positive: boolean }> = {
  deposit: { label: 'Deposit', icon: 'arrow-down', positive: true },
  withdraw: { label: 'Withdrawal', icon: 'arrow-up', positive: false },
  bonus: { label: 'Bonus', icon: 'gift', positive: true },
  bet: { label: 'Bet', icon: 'dice', positive: false },
  win: { label: 'Win', icon: 'trophy', positive: true },
};

const STATUS_STYLE: Record<TxnStatus, { label: string; bg: string; text: string }> = {
  completed: { label: 'Completed', bg: 'rgba(35,194,107,0.12)', text: colors.newg },
  pending: { label: 'Pending', bg: 'rgba(245,180,0,0.15)', text: colors.gold700 },
  failed: { label: 'Failed', bg: 'rgba(255,78,58,0.12)', text: colors.hot },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposits' },
  { key: 'withdraw', label: 'Withdrawals' },
  { key: 'bet', label: 'Bets' },
  { key: 'bonus', label: 'Bonus' },
];

// Maps a filter key to the transaction types it should show.
const FILTER_TYPES: Record<string, TxnType[]> = {
  deposit: ['deposit'],
  withdraw: ['withdraw'],
  bet: ['bet', 'win'],
  bonus: ['bonus'],
};

function formatTxnDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');

  const rows = useMemo(() => {
    if (filter === 'all') return mockTransactions;
    const types = FILTER_TYPES[filter] ?? [];
    return mockTransactions.filter((t) => types.includes(t.type));
  }, [filter]);

  return (
    <Screen
      header={<StackScreenHeader title="Transactions" subtitle="Your full wallet history" />}
      contentClassName="px-4 pt-3 gap-3"
    >
      {/* Filter chips */}
      <ChipToggle options={FILTERS} value={filter} onChange={setFilter} scroll />

      {rows.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No transactions yet"
          message="When you deposit, withdraw or play, your activity shows up here."
          actionLabel="Make a deposit"
          onAction={() => router.push('/deposit')}
          className="mt-6"
        />
      ) : (
        <View className="overflow-hidden rounded-2xl border border-divider bg-paper">
          {rows.map((tx, i) => (
            <TxnRow key={tx.id} tx={tx} first={i === 0} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TxnRow({ tx, first }: { tx: Transaction; first: boolean }) {
  const meta = TXN_META[tx.type];
  const status = STATUS_STYLE[tx.status];
  const tint = meta.positive ? colors.newg : colors.hot;

  return (
    <View className={cn('flex-row items-center gap-3 px-4 py-3.5', !first && 'border-t border-divider')}>
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: meta.positive ? 'rgba(35,194,107,0.12)' : 'rgba(255,78,58,0.10)' }}
      >
        <Ionicons name={meta.icon} size={18} color={tint} />
      </View>

      <View className="flex-1">
        <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
          {meta.label}
        </Text>
        <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
          {tx.method}  •  {formatTxnDate(tx.at)}
        </Text>
      </View>

      <View className="items-end gap-1">
        <Text className="text-sm font-black" style={{ color: tint }}>
          {meta.positive ? '+' : '-'}
          {formatBDT(tx.amount, false)}
        </Text>
        <View className="rounded-md px-1.5 py-0.5" style={{ backgroundColor: status.bg }}>
          <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: status.text }}>
            {status.label}
          </Text>
        </View>
      </View>
    </View>
  );
}
