// Built by Anointed Coder.
//
// My Tickets, wired to the live backend. Reads the player's real lottery
// tickets from GET /api/lotto/me (tickets[]). Each row shows the draw, the
// ticket number, how it was earned (deposit vs granted), the issue date and a
// status pill (active / won / lost / void). A ticket is "active" while its
// draw has not been settled. Loading / error / empty states are all handled.

import { useCallback, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Badge, EmptyState, type BadgeVariant } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { useLottoMe, type LottoTicket } from '@/lib/api/lotto';
import { ApiError } from '@/lib/api/client';
import { colors } from '@/lib/theme';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// A ticket is active while its draw has not been settled. Map the raw ticket
// status + draw settlement into a single display pill.
function ticketPill(t: LottoTicket): { label: string; variant: BadgeVariant } {
  if (t.status === 'won') return { label: 'WON', variant: 'new' };
  if (t.status === 'void') return { label: 'VOID', variant: 'neutral' };
  if (t.status === 'lost') return { label: 'LOST', variant: 'neutral' };
  const settled = t.draw?.settledAt != null;
  if (settled) return { label: 'SETTLED', variant: 'neutral' };
  return { label: 'ACTIVE', variant: 'blue' };
}

function sourceLabel(source: string | null): string {
  if (source === 'deposit') return 'From deposit';
  if (source === 'admin' || source === 'grant') return 'Bonus ticket';
  return 'Ticket';
}

export default function MyTicketsScreen() {
  const router = useRouter();
  const meQuery = useLottoMe();
  const tickets = meQuery.data?.tickets ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await meQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [meQuery]);

  if (meQuery.isLoading) {
    return (
      <Screen header={<StackScreenHeader title="My Tickets" />} contentClassName="px-4 pt-3 gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-24 rounded-2xl border border-divider bg-surfaceAlt/40" />
        ))}
      </Screen>
    );
  }

  if (meQuery.isError) {
    const msg =
      meQuery.error instanceof ApiError ? meQuery.error.message : 'We could not load your tickets.';
    return (
      <Screen header={<StackScreenHeader title="My Tickets" />} contentClassName="px-4 pt-3 gap-3">
        <EmptyState
          icon="alert-circle-outline"
          title="Could not load tickets"
          message={msg}
          actionLabel="Try again"
          onAction={() => meQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<StackScreenHeader title="My Tickets" />}
      contentClassName="px-4 pt-3 gap-3"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold600} />
      }
    >
      {tickets.length === 0 ? (
        <EmptyState
          icon="ticket-outline"
          title="No tickets yet"
          message="Tickets are issued automatically from your approved deposits. Make a deposit to enter the next draw."
          actionLabel="Go to Lotto"
          onAction={() => router.replace('/lotto')}
        />
      ) : (
        tickets.map((t) => {
          const s = ticketPill(t);
          const drawName = t.draw?.name ?? 'Daily Draw';
          return (
            <View
              key={t.id}
              className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15">
                    <Icon name="ticket" size={16} color={colors.gold700} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-ink">{drawName}</Text>
                    <Text className="text-[11px] text-ink-mute">
                      {sourceLabel(t.source)} - {formatDate(t.generatedAt)}
                    </Text>
                  </View>
                </View>
                <Badge label={s.label} variant={s.variant} />
              </View>

              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {t.number.split('').map((digit, idx) => (
                  <View
                    key={`${t.id}-${idx}`}
                    className="h-9 w-9 items-center justify-center rounded-full border border-gold-600/30 bg-gold-500/10"
                  >
                    <Text className="text-sm font-black text-ink">{digit}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}
