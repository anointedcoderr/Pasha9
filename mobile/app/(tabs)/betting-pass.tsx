// Built by Anointed Coder.
//
// Betting Pass, wired to the live backend. A season header with the player's
// current tier + a points progress bar toward the next tier, then a vertical
// rail of reward tiers read from GET /api/betting-pass/me. Each unlocked,
// unclaimed tier shows a Claim button that POSTs /api/betting-pass/claim/[id]
// (real credit: coins -> bonus balance, freebet/bonus -> locked balance);
// claimed tiers show a check, locked tiers a lock. When the operator has the
// pass disabled the whole claim surface is switched off with a notice. Claims
// are double-submit guarded and invalidate the wallet balance + bonuses, then
// refetch the pass so the ladder and points update. Loading / error / empty
// states included.

import { useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { Screen, Gradient, Badge, PrimaryButton, EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { AppHeader } from '@/components/AppHeader';
import { gradients, colors } from '@/lib/theme';
import { formatBDT, titleCase } from '@/lib/format';
import { ApiError } from '@/lib/api/client';
import {
  useBettingPassMe,
  useClaimBettingPassTier,
  type BettingPassTier,
  type RewardKind,
} from '@/lib/api/betting-pass';

type IconName = string;

function rewardIcon(kind: RewardKind): IconName {
  switch (kind) {
    case 'coins':
      return 'cash';
    case 'freebet':
      return 'ticket';
    case 'bonus':
      return 'gift';
    case 'physical':
      return 'cube';
    default:
      return 'gift';
  }
}

/** A short reward line under the tier name, e.g. "BDT 150 bonus". */
function rewardLine(tier: BettingPassTier): string {
  switch (tier.rewardKind) {
    case 'coins':
      return `${formatBDT(tier.rewardAmount)} bonus coins`;
    case 'freebet':
      return `${formatBDT(tier.rewardAmount)} free bet`;
    case 'bonus':
      return tier.turnoverX > 0
        ? `${formatBDT(tier.rewardAmount)} bonus • ${tier.turnoverX}x turnover`
        : `${formatBDT(tier.rewardAmount)} bonus`;
    case 'physical':
      return 'Physical reward';
    default:
      return tier.rewardAmount > 0 ? formatBDT(tier.rewardAmount) : 'Reward';
  }
}

export default function BettingPassScreen() {
  const query = useBettingPassMe();
  const claim = useClaimBettingPassTier();

  // Which tier is currently being claimed (drives that row's spinner) and the
  // synchronous guard against a double tap in the same tick (the disabled prop
  // only updates on the next render, so two taps could both fire a claim).
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function onClaim(tier: BettingPassTier) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setClaimingId(tier.id);
    setClaimError(null);
    try {
      await claim.mutateAsync(tier.id);
    } catch (err) {
      setClaimError(err instanceof ApiError ? err.message : 'Could not claim this reward. Please try again.');
    } finally {
      submittingRef.current = false;
      setClaimingId(null);
    }
  }

  const refreshControl = (
    <RefreshControl refreshing={query.isRefetching && !query.isLoading} onRefresh={() => query.refetch()} tintColor={colors.gold600} />
  );

  // ---- Loading -------------------------------------------------------------
  if (query.isLoading) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
        <View className="h-40 rounded-2xl border border-divider bg-surfaceAlt" />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="h-20 rounded-2xl border border-divider bg-surfaceAlt" />
        ))}
      </Screen>
    );
  }

  // ---- Error ---------------------------------------------------------------
  if (query.isError || !query.data) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3">
        <EmptyState
          icon="cloud-offline"
          title="Could not load your Betting Pass"
          message="Something went wrong reaching the season. Pull to refresh or try again."
          actionLabel="Try again"
          onAction={() => query.refetch()}
        />
      </Screen>
    );
  }

  const { enabled, seasonKey, progress, ladder } = query.data;
  const seasonName = titleCase(seasonKey);
  const level = progress.currentTier;
  const pointsTotal = progress.pointsTotal;
  const nextReq = progress.nextTierRequirement;
  const pct = nextReq && nextReq > 0 ? Math.min(100, Math.round((pointsTotal / nextReq) * 100)) : 100;

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4" refreshControl={refreshControl}>
      {/* Season header */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />

        <View className="relative p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                Betting Pass
              </Text>
              <Text className="text-xl font-black text-white">{seasonName}</Text>
              {progress.currentTierName ? (
                <Text className="mt-0.5 text-[11px] font-semibold text-white/60">{progress.currentTierName}</Text>
              ) : null}
            </View>
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
              <Gradient colors={gradients.gold} radius={16} />
              <Text className="text-lg font-black text-ink">{level}</Text>
            </View>
          </View>

          {/* Points bar */}
          <View className="mt-4">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-white/70">Tier {level}</Text>
              <Text className="text-[11px] font-bold text-white/70">
                {nextReq && nextReq > 0
                  ? `${pointsTotal.toLocaleString('en-US')} / ${nextReq.toLocaleString('en-US')} pts`
                  : `${pointsTotal.toLocaleString('en-US')} pts`}
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <View className="relative h-full overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
                <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              </View>
            </View>
            <Text className="mt-1.5 text-[11px] text-white/50">
              {progress.nextTierName && progress.pointsToNextTier > 0
                ? `${progress.pointsToNextTier.toLocaleString('en-US')} pts to ${progress.nextTierName}`
                : 'Top tier reached'}
            </Text>
          </View>
        </View>
      </View>

      {/* Disabled notice */}
      {!enabled ? (
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-gold-600/30 bg-gold-500/10 p-3.5">
          <Icon name="lock-closed" size={18} color={colors.gold700} />
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-ink">Betting Pass is paused</Text>
            <Text className="mt-0.5 text-[12px] leading-5 text-ink-mute">
              The season pass is not accepting claims right now. Your points are safe and rewards can be claimed once it reopens.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Claim error banner */}
      {claimError ? (
        <View className="flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2.5">
          <Icon name="alert-circle" size={16} color={colors.hot} />
          <Text className="flex-1 text-xs font-medium text-hot">{claimError}</Text>
        </View>
      ) : null}

      {/* Reward track */}
      {ladder.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No reward tiers yet"
          message="The operator has not published any Betting Pass tiers for this season. Check back soon."
        />
      ) : (
        <View>
          {ladder.map((t, i) => (
            <TierRow
              key={t.id}
              tier={t}
              isFirst={i === 0}
              isLast={i === ladder.length - 1}
              enabled={enabled}
              claiming={claimingId === t.id}
              disabledAll={claimingId !== null}
              onClaim={() => onClaim(t)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TierRow({
  tier,
  isFirst,
  isLast,
  enabled,
  claiming,
  disabledAll,
  onClaim,
}: {
  tier: BettingPassTier;
  isFirst: boolean;
  isLast: boolean;
  enabled: boolean;
  claiming: boolean;
  disabledAll: boolean;
  onClaim: () => void;
}) {
  const claimed = tier.claimed;
  const claimable = enabled && tier.claimable && !claimed;
  const locked = !tier.unlocked && !claimed;
  const icon = rewardIcon(tier.rewardKind);

  return (
    <View className="flex-row items-stretch gap-3">
      {/* Left rail with connector + node */}
      <View className="w-9 items-center">
        {!isFirst ? <View className="absolute top-0 h-1/2 w-0.5 bg-divider" /> : null}
        {!isLast ? <View className="absolute bottom-0 h-1/2 w-0.5 bg-divider" /> : null}
        <View
          className={
            'mt-4 h-9 w-9 items-center justify-center rounded-full border-2 ' +
            (claimed
              ? 'border-gold-600 bg-gold-500'
              : claimable
                ? 'border-gold-600 bg-gold-500/15'
                : 'border-divider bg-surfaceAlt')
          }
        >
          <Icon
            name={claimed ? 'checkmark' : locked ? 'lock-closed' : icon}
            size={16}
            color={claimed ? colors.ink : claimable ? colors.gold700 : colors.inkMute}
          />
        </View>
      </View>

      {/* Reward card */}
      <View
        className={
          'mb-3 flex-1 flex-row items-center gap-3 rounded-2xl border p-3.5 ' +
          (locked ? 'border-divider bg-surface' : 'border-divider bg-paper shadow-sm shadow-black/5')
        }
      >
        <View
          className={
            'h-11 w-11 items-center justify-center rounded-xl ' +
            (locked ? 'bg-surfaceAlt' : 'bg-gold-500/15')
          }
        >
          <Icon name={icon} size={20} color={locked ? colors.inkMute : colors.gold700} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className={'text-sm font-extrabold ' + (locked ? 'text-ink-mute' : 'text-ink')}
              numberOfLines={1}
            >
              {tier.nameEn}
            </Text>
            {claimed ? <Badge label="CLAIMED" variant="new" /> : null}
          </View>
          <Text className="mt-0.5 text-[11px] text-ink-mute" numberOfLines={1}>
            {rewardLine(tier)}
          </Text>
          <Text className="mt-0.5 text-[10px] font-semibold text-ink-mute">
            Tier {tier.tier} • {tier.pointsRequired.toLocaleString('en-US')} pts
          </Text>
        </View>

        {claimable ? (
          claiming ? (
            <View className="h-9 w-16 items-center justify-center">
              <ActivityIndicator color={colors.gold700} size="small" />
            </View>
          ) : (
            <PrimaryButton label="Claim" size="sm" onPress={onClaim} disabled={disabledAll} />
          )
        ) : locked ? (
          <Icon name="lock-closed" size={16} color={colors.inkMute} />
        ) : null}
      </View>
    </View>
  );
}
