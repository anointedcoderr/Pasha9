// Built by Anointed Coder.
//
// VIP Club, wired to the live backend. The player's current tier + a pending-
// application flag come from GET /api/vip/status; the ordered tier ladder from
// GET /api/vip/tiers (public). A dark current-tier card summarises the tier and
// its cashback, a horizontal ladder lets the player pick a tier to target, a
// benefits card details the selected tier (cashback, withdrawal cap, perks),
// and an Apply action POSTs /api/vip/apply for the selected tier. The Apply is
// double-submit guarded and surfaces the ApiError message; an existing pending
// application (either already open or a 409 ALREADY_PENDING) switches the CTA to
// a pending notice. Loading / error / empty states included.

import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Screen, Gradient, SectionHeader, EmptyState, PrimaryButton } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { gradients, colors } from '@/lib/theme';
import { formatBDT } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import { useVipTiers, useVipStatus, useApplyForVip } from '@/lib/api/vip';

export default function VipScreen() {
  const tiersQuery = useVipTiers();
  const statusQuery = useVipStatus();
  const apply = useApplyForVip();

  const tiers = tiersQuery.data ?? [];
  const currentTier = statusQuery.data?.tier ?? null;
  const pending = statusQuery.data?.pendingApplication ?? null;

  const currentIndex = useMemo(
    () => (currentTier ? tiers.findIndex((t) => t.id === currentTier.id) : -1),
    [tiers, currentTier],
  );
  const nextTier = tiers[currentIndex + 1] ?? null;

  // Which tier the Apply button targets. Defaults to the next tier up (or the
  // first tier for a non-VIP player). null once resolved means "any tier".
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resolvedSelectedId = selectedId ?? nextTier?.id ?? null;
  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === resolvedSelectedId) ?? nextTier ?? currentTier ?? tiers[0] ?? null,
    [tiers, resolvedSelectedId, nextTier, currentTier],
  );

  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const submittingRef = useRef(false);

  async function onApply() {
    if (submittingRef.current || pending || apply.isPending) return;
    submittingRef.current = true;
    setApplyError(null);
    try {
      await apply.mutateAsync({ tierId: selectedTier?.id ?? null });
      setApplied(true);
    } catch (err) {
      // A 409 ALREADY_PENDING means an application is already open: refreshing
      // status flips the CTA to the pending notice, so no error banner needed.
      if (err instanceof ApiError && err.code === 'ALREADY_PENDING') {
        statusQuery.refetch();
      } else {
        setApplyError(err instanceof ApiError ? err.message : 'Could not submit your application. Please try again.');
      }
    } finally {
      submittingRef.current = false;
    }
  }

  const refreshControl = (
    <RefreshControl
      refreshing={(tiersQuery.isRefetching || statusQuery.isRefetching) && !tiersQuery.isLoading}
      onRefresh={() => {
        tiersQuery.refetch();
        statusQuery.refetch();
      }}
      tintColor={colors.gold600}
    />
  );

  // ---- Loading -------------------------------------------------------------
  if (tiersQuery.isLoading) {
    return (
      <Screen header={<StackScreenHeader title="VIP Club" subtitle="Loyalty rewards" />} contentClassName="px-4 pt-4 gap-5">
        <View className="h-44 rounded-2xl border border-divider bg-surfaceAlt" />
        <View className="h-32 rounded-2xl border border-divider bg-surfaceAlt" />
        <View className="h-40 rounded-2xl border border-divider bg-surfaceAlt" />
      </Screen>
    );
  }

  // ---- Error ---------------------------------------------------------------
  if (tiersQuery.isError) {
    return (
      <Screen header={<StackScreenHeader title="VIP Club" subtitle="Loyalty rewards" />} contentClassName="px-4 pt-4">
        <EmptyState
          icon="cloud-offline"
          title="Could not load the VIP Club"
          message="Something went wrong reaching the tiers. Pull to refresh or try again."
          actionLabel="Try again"
          onAction={() => tiersQuery.refetch()}
        />
      </Screen>
    );
  }

  // ---- Empty ---------------------------------------------------------------
  if (tiers.length === 0) {
    return (
      <Screen header={<StackScreenHeader title="VIP Club" subtitle="Loyalty rewards" />} contentClassName="px-4 pt-4">
        <EmptyState
          icon="diamond-outline"
          title="No VIP tiers yet"
          message="The VIP Club is being set up. Check back soon to see the loyalty tiers and their perks."
        />
      </Screen>
    );
  }

  // ---- Status error --------------------------------------------------------
  // A failed status fetch must not masquerade as "not a VIP yet". With no data
  // currentTier is null, so the current-tier card and the Apply CTA would render
  // as if the player has no tier, hiding a real fetch error and inviting a
  // duplicate application. Surface it distinctly with a retry instead.
  if (statusQuery.isError) {
    return (
      <Screen header={<StackScreenHeader title="VIP Club" subtitle="Loyalty rewards" />} contentClassName="px-4 pt-4">
        <EmptyState
          icon="cloud-offline"
          title="Could not load your VIP status"
          message="We could not check your current tier right now. Pull to refresh or try again."
          actionLabel="Try again"
          onAction={() => statusQuery.refetch()}
        />
      </Screen>
    );
  }

  const showApply = !pending && !applied;

  return (
    <Screen
      header={<StackScreenHeader title="VIP Club" subtitle="Loyalty rewards" />}
      contentClassName="px-4 pt-4 gap-5"
      refreshControl={refreshControl}
      footer={
        <View className="border-t border-divider bg-paper px-4 pb-7 pt-3">
          {applyError ? (
            <View className="mb-2 flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2">
              <Icon name="alert-circle" size={16} color={colors.hot} />
              <Text className="flex-1 text-xs font-medium text-hot">{applyError}</Text>
            </View>
          ) : null}

          {pending || applied ? (
            <View className="flex-row items-center gap-2.5 rounded-xl border border-newg/30 bg-newg/10 px-3.5 py-3">
              <Icon name="hourglass" size={18} color={colors.newg} />
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-ink">Application pending</Text>
                <Text className="text-[11px] text-ink-mute">
                  Our team is reviewing your VIP request. You will be notified once it is decided.
                </Text>
              </View>
            </View>
          ) : (
            <PrimaryButton
              label={
                apply.isPending
                  ? 'Submitting...'
                  : selectedTier
                    ? `Apply for ${selectedTier.name}`
                    : 'Apply for VIP'
              }
              icon="diamond"
              fullWidth
              loading={apply.isPending}
              disabled={apply.isPending}
              onPress={onApply}
            />
          )}
          {showApply ? (
            <View className="mt-2 flex-row items-center justify-center gap-1.5">
              <Icon name="shield-checkmark" size={12} color={colors.inkMute} />
              <Text className="text-[11px] text-ink-mute">Applications are reviewed by our VIP team</Text>
            </View>
          ) : null}
        </View>
      }
    >
      {/* Current tier card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-500/30">
        <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gold-500/15" />

        <View className="relative p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5 rounded-pill border border-gold-500/40 bg-gold-500/10 px-3 py-1">
              <Icon name="diamond" size={12} color={colors.gold300} />
              <Text className="text-[11px] font-black uppercase tracking-widest" style={{ color: colors.gold300 }}>
                Your tier
              </Text>
            </View>
            {currentTier && currentTier.cashbackRatePercent != null ? (
              <View className="rounded-pill bg-white/10 px-2.5 py-1">
                <Text className="text-[11px] font-black" style={{ color: colors.neon }}>
                  {currentTier.cashbackRatePercent}% cashback
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-4 flex-row items-center gap-3">
            <View
              className="relative h-14 w-14 items-center justify-center overflow-hidden rounded-2xl"
              style={{ borderWidth: 2, borderColor: currentTier?.badgeColor ?? colors.gold500 }}
            >
              <Gradient colors={gradients.gold} radius={16} />
              <Icon name="diamond" size={26} color={colors.ink} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-black text-white">{currentTier ? currentTier.name : 'Not a VIP yet'}</Text>
              <Text className="text-xs font-semibold text-white/60">
                {currentTier
                  ? nextTier
                    ? `Next tier: ${nextTier.name}`
                    : 'You are at the top tier'
                  : 'Apply below to join the VIP Club'}
              </Text>
            </View>
          </View>

          {/* Ladder position progress */}
          <View className="mt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                {nextTier ? `Progress to ${nextTier.name}` : 'Top tier reached'}
              </Text>
              <Text className="text-[11px] font-black" style={{ color: colors.gold300 }}>
                {tiers.length > 0 ? Math.round(((currentIndex + 1) / tiers.length) * 100) : 0}%
              </Text>
            </View>
            <View className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <View
                className="relative h-full overflow-hidden rounded-full"
                style={{ width: `${tiers.length > 0 ? ((currentIndex + 1) / tiers.length) * 100 : 0}%` }}
              >
                <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              </View>
            </View>
            <Text className="mt-2 text-[11px] font-semibold text-white/60">
              {nextTier
                ? `Tier ${Math.max(1, currentIndex + 1)} of ${tiers.length} • climb to ${nextTier.name}`
                : currentTier
                  ? 'You enjoy every VIP privilege.'
                  : `${tiers.length} tiers to climb`}
            </Text>
          </View>
        </View>
      </View>

      {/* Tier ladder (tap to choose which to apply for) */}
      <View className="gap-3">
        <SectionHeader title="Tier ladder" subtitle="Tap a tier to target your application" icon="trending-up" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
          {tiers.map((tier, i) => {
            const active = i === currentIndex;
            const cleared = currentIndex >= 0 && i < currentIndex;
            const selected = tier.id === selectedTier?.id;
            const badge = tier.badgeColor ?? colors.gold500;
            return (
              <Pressable
                key={tier.id}
                onPress={() => setSelectedId(tier.id)}
                className={cn(
                  'w-[124px] items-center rounded-2xl border p-3 active:opacity-90',
                  selected ? 'border-gold-600 bg-gold-500/10' : active ? 'border-gold-500 bg-gold-500/5' : 'border-divider bg-paper',
                )}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${badge}22`, borderWidth: 2, borderColor: badge }}
                >
                  <Icon name={cleared ? 'checkmark' : 'diamond'} size={20} color={badge} />
                </View>
                <Text className="mt-2 text-sm font-black text-ink" numberOfLines={1}>
                  {tier.name}
                </Text>
                {tier.cashbackRatePercent != null ? (
                  <View className="mt-1.5 rounded-pill bg-gold-500/15 px-2 py-0.5">
                    <Text className="text-[10px] font-black text-gold-700">{tier.cashbackRatePercent}%</Text>
                  </View>
                ) : null}
                {active ? (
                  <View className="mt-1.5 rounded-pill bg-gold-500 px-2 py-0.5">
                    <Text className="text-[9px] font-black uppercase tracking-wider text-ink">You</Text>
                  </View>
                ) : selected ? (
                  <View className="mt-1.5 rounded-pill bg-gold-500/20 px-2 py-0.5">
                    <Text className="text-[9px] font-black uppercase tracking-wider text-gold-700">Target</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected tier benefits */}
      {selectedTier ? (
        <View className="gap-3">
          <SectionHeader title={`${selectedTier.name} benefits`} subtitle="What this tier unlocks" icon="gift" />
          <View className="gap-2.5 rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
            <BenefitRow
              icon="cash-outline"
              label="Cashback rate"
              value={selectedTier.cashbackRatePercent != null ? `${selectedTier.cashbackRatePercent}%` : '-'}
            />
            <View className="h-px bg-divider" />
            <BenefitRow
              icon="wallet-outline"
              label="Max withdrawal"
              value={selectedTier.withdrawalMaxAmount != null ? formatBDT(selectedTier.withdrawalMaxAmount) : 'Standard'}
            />
            {selectedTier.description ? (
              <>
                <View className="h-px bg-divider" />
                <Text className="text-[12px] leading-5 text-ink-soft">{selectedTier.description}</Text>
              </>
            ) : null}
            {selectedTier.perksEn.length > 0 ? (
              <>
                <View className="h-px bg-divider" />
                <View className="gap-2">
                  {selectedTier.perksEn.map((perk, i) => (
                    <View key={i} className="flex-row items-start gap-2">
                      <Icon name="checkmark-circle" size={16} color={colors.newg} />
                      <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{perk}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function BenefitRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={16} color={colors.gold700} />
        <Text className="text-sm text-ink-mute">{label}</Text>
      </View>
      <Text className="text-sm font-black text-ink">{value}</Text>
    </View>
  );
}
