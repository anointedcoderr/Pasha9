// Built by Anointed Coder.
//
// Lotto: a live draw card (draw id, live countdown, jackpot), a pick-your-
// numbers grid (1-49, choose 6) with a quick-pick + clear, quick links to My
// Tickets and My Winnings, and a sticky ticket-price + buy bar footer. The
// draw reads from mockLottoDraws; everything else is visual state only.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Gradient, Badge, GhostButton, PrimaryButton } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { mockLottoDraws } from '@/lib/mock';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';

const POOL = Array.from({ length: 49 }, (_, i) => i + 1);
const MAX_PICKS = 6;

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

// Live countdown to an ISO draw time. Returns a { d, h, m, s, done } shape.
function useCountdown(iso: string) {
  const target = useMemo(() => new Date(iso).getTime(), [iso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const s = Math.floor(diff / 1000) % 60;
  const m = Math.floor(diff / 60000) % 60;
  const h = Math.floor(diff / 3600000) % 24;
  const d = Math.floor(diff / 86400000);
  return { d, h, m, s, done: diff === 0 };
}

export default function LottoScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const draw = mockLottoDraws[0];
  const time = useCountdown(draw.drawTime);

  const [picks, setPicks] = useState<number[]>([]);

  // 7-column grid sizing (screen px-4 both sides, 6 gaps of 8).
  const GAP = 8;
  const cell = (width - 32 - GAP * 6) / 7;

  function toggle(n: number) {
    setPicks((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : prev.length >= MAX_PICKS
          ? prev
          : [...prev, n].sort((a, b) => a - b),
    );
  }

  function quickPick() {
    const next = new Set<number>();
    while (next.size < MAX_PICKS) next.add(Math.floor(Math.random() * 49) + 1);
    setPicks([...next].sort((a, b) => a - b));
  }

  const full = picks.length === MAX_PICKS;

  return (
    <Screen
      header={<AppHeader />}
      contentClassName="px-4 pt-3 gap-4"
      footer={
        <View className="border-t border-divider bg-paper px-4 pb-6 pt-3">
          <View className="flex-row items-center gap-3">
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">
                Ticket price
              </Text>
              <Text className="text-lg font-black text-ink">{formatBDT(draw.ticketPrice)}</Text>
            </View>
            <PrimaryButton
              label={full ? 'Buy Ticket' : `Pick ${MAX_PICKS - picks.length} more`}
              icon="ticket"
              className="flex-1"
              disabled={!full}
              onPress={() => router.push('/lotto/my-tickets')}
            />
          </View>
        </View>
      }
    >
      {/* Live draw card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-500/15" />

        <View className="relative p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-neon" />
              <Text className="text-xs font-black uppercase tracking-widest text-white/70">
                {draw.name}
              </Text>
            </View>
            <Badge label={draw.status === 'open' ? 'LIVE' : draw.status.toUpperCase()} variant="new" />
          </View>

          <Text className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
            Jackpot
          </Text>
          <Text className="text-3xl font-black" style={{ color: colors.goldlite }}>
            {formatBDT(draw.jackpot)}
          </Text>
          <Text className="mt-0.5 text-[11px] text-white/40">Draw #{draw.id.toUpperCase()}</Text>

          {/* Countdown */}
          <View className="mt-4 flex-row gap-2">
            {[
              { label: 'Days', value: time.d },
              { label: 'Hrs', value: time.h },
              { label: 'Min', value: time.m },
              { label: 'Sec', value: time.s },
            ].map((u) => (
              <View
                key={u.label}
                className="flex-1 items-center rounded-xl border border-white/10 bg-white/5 py-2"
              >
                <Text className="text-xl font-black" style={{ color: colors.dinkHi }}>
                  {pad(u.value)}
                </Text>
                <Text className="text-[9px] font-bold uppercase tracking-widest text-white/45">
                  {u.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Number pick grid */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-base font-extrabold text-ink">Pick your numbers</Text>
            <Text className="text-xs text-ink-mute">Choose {MAX_PICKS} from 1 to 49</Text>
          </View>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-gold-500/15">
            <Text className="text-xs font-black text-gold-700">{picks.length}</Text>
          </View>
        </View>

        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {POOL.map((n) => {
            const active = picks.includes(n);
            return (
              <Pressable
                key={n}
                onPress={() => toggle(n)}
                style={{ width: cell, height: cell }}
                className={
                  'items-center justify-center rounded-xl border active:opacity-80 ' +
                  (active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-surface')
                }
              >
                <Text className={'text-sm font-black ' + (active ? 'text-ink' : 'text-ink-soft')}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-4 flex-row gap-2">
          <GhostButton label="Quick Pick" icon="flash" size="sm" className="flex-1" onPress={quickPick} />
          <GhostButton
            label="Clear"
            icon="refresh"
            size="sm"
            className="flex-1"
            onPress={() => setPicks([])}
          />
        </View>
      </View>

      {/* Quick links */}
      <View className="flex-row gap-3">
        <LinkTile
          icon="receipt-outline"
          label="My Tickets"
          hint="Active and past"
          onPress={() => router.push('/lotto/my-tickets')}
        />
        <LinkTile
          icon="trophy-outline"
          label="My Winnings"
          hint="Prizes and payouts"
          onPress={() => router.push('/lotto/my-winnings')}
        />
      </View>
    </Screen>
  );
}

function LinkTile({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center gap-3 rounded-2xl border border-divider bg-paper p-3.5 shadow-sm shadow-black/5 active:opacity-90"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
        <Ionicons name={icon} size={20} color={colors.gold700} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.inkMute} />
    </Pressable>
  );
}
