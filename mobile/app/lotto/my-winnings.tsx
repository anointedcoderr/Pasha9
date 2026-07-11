// Built by Anointed Coder.
//
// My Winnings, wired to the live backend. Reads the player's real winnings
// from GET /api/lotto/me (winnings[] + summary.wonLifetime). A total-won
// summary card sits above the list; each row shows the draw, the winning
// number, the prize tier, the amount and a payout pill. Rows in
// 'pending_credit' expose a Claim button that POSTs
// /api/lotto/winnings/[id]/claim - real money into Wallet.lottoBalance, so
// the claim is guarded against double-submit and invalidates the wallet
// balance on success. Auto-credited wins show as already paid.

import { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Screen,
  Gradient,
  Badge,
  PrimaryButton,
  EmptyState,
  type BadgeVariant,
} from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { useLottoMe, useClaimWinning, type LottoWinning } from '@/lib/api/lotto';
import { ApiError } from '@/lib/api/client';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';

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

function payoutPill(status: string): { label: string; variant: BadgeVariant } {
  if (status === 'credited') return { label: 'PAID', variant: 'new' };
  if (status === 'pending_credit') return { label: 'CLAIMABLE', variant: 'gold' };
  return { label: status.toUpperCase(), variant: 'neutral' };
}

function prettyTier(tier: string): string {
  return tier.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MyWinningsScreen() {
  const router = useRouter();
  const meQuery = useLottoMe();
  const claim = useClaimWinning();
  const winnings = meQuery.data?.winnings ?? [];
  const totalWon = meQuery.data?.summary.wonLifetime ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await meQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [meQuery]);

  // Synchronous per-request guard. The disabled prop only updates next render,
  // so a fast double-tap could fire two claims for the same winning before
  // React re-renders. The ref set flips instantly and blocks the second press.
  const claimingIds = useRef<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onClaim = useCallback(
    (w: LottoWinning) => {
      if (claimingIds.current.has(w.id)) return;
      claimingIds.current.add(w.id);
      setPendingId(w.id);
      claim.mutate(w.id, {
        onSuccess: (res) => {
          Alert.alert('Prize claimed', `${formatBDT(res.amount)} added to your lotto balance.`);
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : 'Could not claim this prize. Please try again.';
          Alert.alert('Claim failed', msg);
        },
        onSettled: () => {
          claimingIds.current.delete(w.id);
          setPendingId((cur) => (cur === w.id ? null : cur));
        },
      });
    },
    [claim],
  );

  if (meQuery.isLoading) {
    return (
      <Screen header={<StackScreenHeader title="My Winnings" />} contentClassName="px-4 pt-3 gap-3">
        <View className="h-28 rounded-2xl border border-divider bg-surfaceAlt/40" />
        {[0, 1].map((i) => (
          <View key={i} className="h-20 rounded-2xl border border-divider bg-surfaceAlt/40" />
        ))}
      </Screen>
    );
  }

  if (meQuery.isError) {
    const msg =
      meQuery.error instanceof ApiError ? meQuery.error.message : 'We could not load your winnings.';
    return (
      <Screen header={<StackScreenHeader title="My Winnings" />} contentClassName="px-4 pt-3 gap-3">
        <EmptyState
          icon="alert-circle-outline"
          title="Could not load winnings"
          message={msg}
          actionLabel="Try again"
          onAction={() => meQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<StackScreenHeader title="My Winnings" />}
      contentClassName="px-4 pt-3 gap-3"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold600} />
      }
    >
      {winnings.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No winnings yet"
          message="Your prizes will show here the moment a draw goes your way."
          actionLabel="Go to Lotto"
          onAction={() => router.replace('/lotto')}
        />
      ) : (
        <>
          {/* Total summary */}
          <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
            <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
            <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-500/15" />
            <View className="relative flex-row items-center justify-between p-4">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                  Total won
                </Text>
                <Text className="mt-1 text-3xl font-black" style={{ color: colors.gold300 }}>
                  {formatBDT(totalWon)}
                </Text>
                <Text className="mt-0.5 text-[11px] text-white/45">
                  Across {winnings.length} winning {winnings.length === 1 ? 'ticket' : 'tickets'}
                </Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-white/5">
                <Ionicons name="trophy" size={26} color={colors.gold300} />
              </View>
            </View>
          </View>

          {winnings.map((w) => {
            const s = payoutPill(w.status);
            const claimable = w.status === 'pending_credit';
            const busy = pendingId === w.id && claim.isPending;
            return (
              <View
                key={w.id}
                className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5"
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-newg/15">
                    <Ionicons name="sparkles" size={18} color={colors.newg} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold text-ink">{prettyTier(w.prizeTier)}</Text>
                    <Text className="text-[11px] text-ink-mute">
                      No. {w.ticketNumber} - won {formatDate(w.createdAt)}
                    </Text>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-base font-black text-gold-700">{formatBDT(w.amount)}</Text>
                    <Badge label={s.label} variant={s.variant} />
                  </View>
                </View>

                {claimable ? (
                  <PrimaryButton
                    label={busy ? 'Claiming...' : 'Claim prize'}
                    icon="gift"
                    size="sm"
                    fullWidth
                    className="mt-3"
                    loading={busy}
                    disabled={busy}
                    onPress={() => onClaim(w)}
                  />
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
