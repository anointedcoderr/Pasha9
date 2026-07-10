// Built by Anointed Coder.
//
// My Tickets: a stack screen listing the player's lotto tickets. Each row
// shows the draw, the chosen numbers as chips, the buy date and a status
// pill (open / won / lost). Falls back to an empty state when the list is
// empty. Ticket data is local mock; the draw names mirror mockLottoDraws.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Badge, EmptyState, type BadgeVariant } from '@/components/ui';
import { colors } from '@/lib/theme';

type TicketStatus = 'open' | 'won' | 'lost';

interface Ticket {
  id: string;
  draw: string;
  numbers: number[];
  boughtAt: string;
  status: TicketStatus;
}

const TICKETS: Ticket[] = [
  { id: 'PL-90231', draw: 'Mega Friday', numbers: [4, 11, 23, 27, 38, 45], boughtAt: '10 Jul, 09:12', status: 'open' },
  { id: 'PL-90188', draw: 'Super Six', numbers: [2, 9, 17, 30, 33, 41], boughtAt: '09 Jul, 21:40', status: 'open' },
  { id: 'PL-89904', draw: 'Daily Dhamaka', numbers: [7, 14, 19, 22, 36, 48], boughtAt: '08 Jul, 17:05', status: 'won' },
  { id: 'PL-89710', draw: 'Flash Hourly', numbers: [1, 5, 12, 25, 39, 44], boughtAt: '08 Jul, 13:02', status: 'lost' },
  { id: 'PL-89522', draw: 'Daily Dhamaka', numbers: [3, 8, 16, 21, 34, 49], boughtAt: '07 Jul, 18:30', status: 'lost' },
];

const STATUS: Record<TicketStatus, { label: string; variant: BadgeVariant }> = {
  open: { label: 'OPEN', variant: 'blue' },
  won: { label: 'WON', variant: 'new' },
  lost: { label: 'LOST', variant: 'neutral' },
};

export default function MyTicketsScreen() {
  const router = useRouter();

  return (
    <Screen header={<BackHeader title="My Tickets" />} contentClassName="px-4 pt-3 gap-3">
      {TICKETS.length === 0 ? (
        <EmptyState
          icon="ticket-outline"
          title="No tickets yet"
          message="Pick your numbers on the Lotto screen to enter the next draw."
          actionLabel="Buy a ticket"
          onAction={() => router.push('/lotto')}
        />
      ) : (
        TICKETS.map((t) => {
          const s = STATUS[t.status];
          return (
            <View
              key={t.id}
              className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15">
                    <Ionicons name="ticket" size={16} color={colors.gold700} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-ink">{t.draw}</Text>
                    <Text className="text-[11px] text-ink-mute">
                      #{t.id} - {t.boughtAt}
                    </Text>
                  </View>
                </View>
                <Badge label={s.label} variant={s.variant} />
              </View>

              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {t.numbers.map((n) => (
                  <View
                    key={n}
                    className="h-8 w-8 items-center justify-center rounded-full border border-gold-600/30 bg-gold-500/10"
                  >
                    <Text className="text-xs font-black text-ink">{n}</Text>
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
