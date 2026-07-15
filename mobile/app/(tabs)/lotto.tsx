// Built by Anointed Coder.
//
// Lotto, wired to the live backend (GET /api/lotto/me). Pasha9 lotto tickets
// are ACCRUED from approved deposits (ticketsPerBlock per blockAmount), not
// bought with a number pick, so there is no buy-ticket / draw-purchase
// endpoint. This screen therefore shows: the live next-draw countdown, the
// player's lotto wallet with a real transfer-to-main-wallet action (money
// movement, guarded + balance-invalidated), the deposit-accrual progress
// toward the next ticket block, per-player stats, and quick links to My
// Tickets / My Winnings. The old number-pick + buy flow is surfaced as a
// clear "coming soon" note because no server endpoint backs it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Gradient, Badge, PrimaryButton, EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { AppHeader } from '@/components/AppHeader';
import { useLottoMe, useTransferLotto, MIN_LOTTO_TRANSFER, type LottoMe } from '@/lib/api/lotto';
import { ApiError } from '@/lib/api/client';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

// Live countdown to an ISO draw time. Returns { d, h, m, s, done, none }.
function useCountdown(iso: string | null) {
  const target = useMemo(() => (iso ? new Date(iso).getTime() : null), [iso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (target == null) return { d: 0, h: 0, m: 0, s: 0, done: true, none: true };
  const diff = Math.max(0, target - now);
  const s = Math.floor(diff / 1000) % 60;
  const m = Math.floor(diff / 60000) % 60;
  const h = Math.floor(diff / 3600000) % 24;
  const d = Math.floor(diff / 86400000);
  return { d, h, m, s, done: diff === 0, none: false };
}

export default function LottoScreen() {
  const router = useRouter();
  const meQuery = useLottoMe();
  const transfer = useTransferLotto();
  const me = meQuery.data;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await meQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [meQuery]);

  // Synchronous double-submit guard: the disabled prop only updates on the
  // next render, so a fast double-tap could fire two transfers before React
  // re-renders. The ref flips instantly and blocks the second press.
  const transferInFlight = useRef(false);
  const onTransfer = useCallback(() => {
    if (!me) return;
    const amount = Math.floor(me.lottoBalance);
    if (amount < MIN_LOTTO_TRANSFER) {
      Alert.alert(
        'Nothing to transfer',
        `You need at least ${formatBDT(MIN_LOTTO_TRANSFER)} in your lotto balance to move it to your main wallet.`,
      );
      return;
    }
    Alert.alert(
      'Transfer to main wallet',
      `Move ${formatBDT(amount)} from your lotto balance to your main wallet? You can then withdraw it from Wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => {
            if (transferInFlight.current || transfer.isPending) return;
            transferInFlight.current = true;
            transfer.mutate(amount, {
              onSuccess: (res) => {
                Alert.alert('Transfer complete', `${formatBDT(res.amount)} is now in your main wallet.`);
              },
              onError: (err) => {
                const msg = err instanceof ApiError ? err.message : 'Transfer failed. Please try again.';
                Alert.alert('Transfer failed', msg);
              },
              onSettled: () => {
                transferInFlight.current = false;
              },
            });
          },
        },
      ],
    );
  }, [me, transfer]);

  // Loading / error gates.
  if (meQuery.isLoading) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  if (meQuery.isError || !me) {
    const msg =
      meQuery.error instanceof ApiError ? meQuery.error.message : 'We could not load the lotto right now.';
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
        <EmptyState
          icon="alert-circle-outline"
          title="Lotto unavailable"
          message={msg}
          actionLabel="Try again"
          onAction={() => meQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<AppHeader />}
      contentClassName="px-4 pt-3 gap-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold600} />
      }
    >
      <DrawCard me={me} />
      <LottoWalletCard
        balance={me.lottoBalance}
        onTransfer={onTransfer}
        transferring={transfer.isPending}
      />
      <ProgressCard me={me} />
      <StatsGrid me={me} />
      <ComingSoonPick drawTimeLabel={me.rules.drawTimeLabel} />

      {/* Quick links */}
      <View className="flex-row gap-3">
        <LinkTile
          icon="receipt-outline"
          label="My Tickets"
          hint={`${me.summary.activeTicketsCount} active`}
          onPress={() => router.push('/lotto/my-tickets')}
        />
        <LinkTile
          icon="trophy-outline"
          label="My Winnings"
          hint={me.summary.winningCount > 0 ? `${me.summary.winningCount} wins` : 'Prizes'}
          onPress={() => router.push('/lotto/my-winnings')}
        />
      </View>
    </Screen>
  );
}

function DrawCard({ me }: { me: LottoMe }) {
  const time = useCountdown(me.nextDrawAt);
  return (
    <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
      <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
      <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-500/15" />

      <View className="relative p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-neon" />
            <Text className="text-xs font-black uppercase tracking-widest text-white/70">
              Next Lotto Draw
            </Text>
          </View>
          <Badge
            label={me.rules.enabled ? 'LIVE' : 'PAUSED'}
            variant={me.rules.enabled ? 'new' : 'neutral'}
          />
        </View>

        <Text className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
          {me.rules.drawTimeLabel}
        </Text>

        {time.none ? (
          <Text className="mt-2 text-lg font-black text-white/80">No draw scheduled yet</Text>
        ) : (
          <View className="mt-3 flex-row gap-2">
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
        )}
      </View>
    </View>
  );
}

function LottoWalletCard({
  balance,
  onTransfer,
  transferring,
}: {
  balance: number;
  onTransfer: () => void;
  transferring: boolean;
}) {
  const canTransfer = Math.floor(balance) >= MIN_LOTTO_TRANSFER;
  return (
    <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
      <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
      <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />
      <View className="relative p-4">
        <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
          Lotto balance
        </Text>
        <Text className="mt-1 text-3xl font-black" style={{ color: colors.gold300 }}>
          {formatBDT(balance)}
        </Text>
        <Text className="mt-0.5 text-[11px] text-white/45">
          Prize winnings land here. Move them to your main wallet to withdraw.
        </Text>
        <PrimaryButton
          label={transferring ? 'Transferring...' : 'Transfer to main wallet'}
          icon="swap-horizontal"
          fullWidth
          className="mt-3"
          loading={transferring}
          disabled={!canTransfer || transferring}
          onPress={onTransfer}
        />
        {!canTransfer ? (
          <Text className="mt-2 text-center text-[10px] text-white/40">
            Minimum transfer is {formatBDT(MIN_LOTTO_TRANSFER)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ProgressCard({ me }: { me: LottoMe }) {
  const { earnedTickets, toNextBlock, blockAmount, ticketsPerBlock, totalApprovedDeposits } = me.progress;
  const filled =
    blockAmount > 0 ? Math.max(0, Math.min(1, (blockAmount - toNextBlock) / blockAmount)) : 0;
  return (
    <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-base font-extrabold text-ink">Earn tickets</Text>
        <View className="flex-row items-center gap-1.5">
          <Icon name="ticket" size={14} color={colors.gold700} />
          <Text className="text-sm font-black text-gold-700">{earnedTickets}</Text>
        </View>
      </View>
      <Text className="text-xs text-ink-mute">
        Every {formatBDT(blockAmount)} deposited earns you {ticketsPerBlock}{' '}
        {ticketsPerBlock === 1 ? 'ticket' : 'tickets'} automatically.
      </Text>

      <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-surfaceAlt">
        <View className="h-full rounded-full bg-gold-500" style={{ width: `${filled * 100}%` }} />
      </View>
      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="text-[11px] text-ink-mute">{formatBDT(totalApprovedDeposits)} deposited</Text>
        <Text className="text-[11px] font-bold text-ink-soft">
          {formatBDT(toNextBlock)} to next{' '}
          {ticketsPerBlock === 1 ? 'ticket' : `${ticketsPerBlock} tickets`}
        </Text>
      </View>
    </View>
  );
}

function StatsGrid({ me }: { me: LottoMe }) {
  const cells = [
    {
      label: 'Active tickets',
      value: String(me.summary.activeTicketsCount),
      icon: 'ticket-outline' as const,
    },
    { label: 'Won today', value: formatBDT(me.summary.wonToday, false), icon: 'sparkles-outline' as const },
    {
      label: 'Won lifetime',
      value: formatBDT(me.summary.wonLifetime, false),
      icon: 'trophy-outline' as const,
    },
    {
      label: 'Last draw wins',
      value: String(me.summary.lastDrawWinningTicketsCount),
      icon: 'flame-outline' as const,
    },
  ];
  return (
    <View className="flex-row flex-wrap gap-3">
      {cells.map((c) => (
        <View
          key={c.label}
          className="min-w-[45%] flex-1 rounded-2xl border border-divider bg-paper p-3.5 shadow-sm shadow-black/5"
        >
          <Icon name={c.icon} size={18} color={colors.gold700} />
          <Text className="mt-2 text-lg font-black text-ink" numberOfLines={1}>
            {c.value}
          </Text>
          <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ComingSoonPick({ drawTimeLabel }: { drawTimeLabel: string }) {
  return (
    <View className="rounded-2xl border border-dashed border-gold-600/40 bg-gold-500/5 p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="color-wand-outline" size={18} color={colors.gold700} />
        <Text className="text-sm font-extrabold text-ink">Pick your own numbers</Text>
        <Badge label="COMING SOON" variant="gold" />
      </View>
      <Text className="mt-2 text-xs text-ink-mute">
        For now, tickets are issued to you automatically from your approved deposits and entered into
        the {drawTimeLabel} draw. Manual number selection is on the way.
      </Text>
    </View>
  );
}

function LinkTile({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: string;
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
        <Icon name={icon} size={20} color={colors.gold700} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color={colors.inkMute} />
    </Pressable>
  );
}

function SkeletonCard() {
  return <View className="h-40 rounded-2xl border border-divider bg-surfaceAlt/40" />;
}
