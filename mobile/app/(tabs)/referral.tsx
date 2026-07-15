// Built by Anointed Coder.
//
// Referral (live): the player's real referral code + invite link from
// GET /api/me/referrals, a stats row (invited / active / earned), a claimable
// balance card with a guarded Claim button (POST /api/me/referrals/claim), a
// how-it-works card, and the real referred-friends list. The claim is guarded
// against double-submit with a synchronous useRef and, on success, invalidates
// the wallet balance so the header + wallet reflect the credited reward.

import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';
import { Screen, Gradient, StatRow, Badge, EmptyState, type BadgeVariant } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { AppHeader } from '@/components/AppHeader';
import { ApiError } from '@/lib/api/client';
import { useReferralOverview, useClaimReferral } from '@/lib/api/referral';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';

const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: 'share-social', title: 'Share your code', body: 'Send your referral code or link to friends.' },
  { icon: 'person-add', title: 'They join and deposit', body: 'Your friend signs up and makes a first deposit.' },
  { icon: 'cash', title: 'You both earn', body: 'Earn a commission on every active friend.' },
];

function joinedLabel(iso: string | null): string {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return `Joined ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

// We do not get a per-friend active flag on this endpoint, so every real
// invitee surfaces a neutral JOINED pill.
const FRIEND_BADGE: { label: string; variant: BadgeVariant } = { label: 'JOINED', variant: 'gold' };

export default function ReferralScreen() {
  const overview = useReferralOverview();
  const claim = useClaimReferral();

  const claimInFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onShare(message: string) {
    try {
      await Share.share({ message });
    } catch {
      // User dismissed the share sheet; nothing to surface.
    }
  }

  async function onClaim() {
    if (claimInFlight.current) return;
    claimInFlight.current = true;
    setFeedback(null);
    try {
      const res = await claim.mutateAsync();
      const text = res.amount > 0 ? `Claimed ${formatBDT(res.amount)} to your wallet.` : 'Referral rewards claimed.';
      setFeedback({ kind: 'ok', text });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not claim right now. Please try again.';
      setFeedback({ kind: 'err', text: msg });
    } finally {
      claimInFlight.current = false;
    }
  }

  if (overview.isLoading) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3">
        <View className="items-center py-24">
          <ActivityIndicator color={colors.gold700} />
          <Text className="mt-3 text-sm text-ink-mute">Loading your referrals</Text>
        </View>
      </Screen>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3">
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load referrals"
          message={
            overview.error instanceof ApiError
              ? overview.error.message
              : 'Check your connection and try again.'
          }
          actionLabel="Retry"
          onAction={() => overview.refetch()}
        />
      </Screen>
    );
  }

  const d = overview.data;
  const claimable = d.balance.claimableAmount;
  const canClaim = claimable > 0 && !d.cadenceBlocked;

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      {/* Code card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />

        <View className="relative p-4">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
            Your referral code
          </Text>

          <View className="mt-2 flex-row items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <Text className="text-2xl font-black tracking-widest" style={{ color: colors.gold300 }}>
              {d.referralCode || '--'}
            </Text>
            <Icon name="qr-code-outline" size={22} color={colors.gold300} />
          </View>

          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() =>
                onShare(`Join me on Pasha9 with my code ${d.referralCode}: ${d.inviteLink}`)
              }
              className="relative flex-1 flex-row items-center justify-center gap-2 overflow-hidden rounded-pill py-3 active:opacity-90"
            >
              <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              <Icon name="share-social-outline" size={16} color={colors.ink} />
              <Text className="text-sm font-extrabold text-ink">Share invite</Text>
            </Pressable>
            <Pressable
              onPress={() => onShare(d.referralCode)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-pill border border-white/15 bg-white/10 py-3 active:opacity-80"
            >
              <Icon name="pricetag-outline" size={16} color={colors.gold300} />
              <Text className="text-sm font-bold text-white">Share code</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Stats */}
      <StatRow
        items={[
          { label: 'Invited', value: `${d.downline.level1Total}`, icon: 'people' },
          { label: 'Active', value: `${d.downline.level1Active}`, icon: 'flame', valueTone: 'green' },
          { label: 'Earned', value: formatBDT(d.balance.totalEarned), icon: 'cash', valueTone: 'gold' },
        ]}
      />

      {/* Claimable card */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">Ready to claim</Text>
            <Text className="mt-1 text-2xl font-black text-ink">{formatBDT(claimable)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-[11px] text-ink-mute">Pending</Text>
            <Text className="text-sm font-bold text-ink-soft">{formatBDT(d.balance.pendingAmount)}</Text>
          </View>
        </View>

        <Pressable
          onPress={onClaim}
          disabled={!canClaim || claim.isPending}
          className={
            'mt-3 relative flex-row items-center justify-center gap-2 overflow-hidden rounded-pill py-3 ' +
            (!canClaim || claim.isPending ? 'opacity-60' : 'active:opacity-90')
          }
        >
          <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
          {claim.isPending ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <>
              <Icon name="wallet-outline" size={16} color={colors.ink} />
              <Text className="text-sm font-extrabold text-ink">
                {claimable > 0 ? 'Claim to wallet' : 'Nothing to claim'}
              </Text>
            </>
          )}
        </Pressable>

        {d.cadenceBlocked && claimable > 0 ? (
          <Text className="mt-2 text-[11px] text-ink-mute">
            Already claimed this {d.cadence} period. Check back next cycle.
          </Text>
        ) : null}
        {feedback ? (
          <Text
            className="mt-2 text-[12px] font-semibold"
            style={{ color: feedback.kind === 'ok' ? colors.gold700 : colors.hot }}
          >
            {feedback.text}
          </Text>
        ) : null}
      </View>

      {/* How it works */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <Text className="mb-3 text-base font-extrabold text-ink">How it works</Text>
        <View className="gap-3">
          {STEPS.map((step, i) => (
            <View key={step.title} className="flex-row items-center gap-3">
              <View className="relative h-9 w-9 items-center justify-center overflow-hidden rounded-full">
                <Gradient colors={gradients.gold} radius={999} />
                <Text className="text-sm font-black text-ink">{i + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">{step.title}</Text>
                <Text className="text-[11px] text-ink-mute">{step.body}</Text>
              </View>
              <Icon name={step.icon} size={18} color={colors.gold700} />
            </View>
          ))}
        </View>
      </View>

      {/* Referred users */}
      <View className="gap-2">
        <Text className="text-base font-extrabold text-ink">Referred friends</Text>
        {d.invited.length === 0 ? (
          <View className="rounded-2xl border border-divider bg-paper p-5 shadow-sm shadow-black/5">
            <Text className="text-center text-sm text-ink-mute">
              No referrals yet. Share your code to start earning.
            </Text>
          </View>
        ) : (
          d.invited.map((f, i) => {
            const st = FRIEND_BADGE;
            return (
              <View
                key={`${f.username}-${i}`}
                className="flex-row items-center gap-3 rounded-2xl border border-divider bg-paper p-3 shadow-sm shadow-black/5"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-gold-500/15">
                  <Text className="text-sm font-black text-gold-700">
                    {(f.username || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink">{f.username || 'Player'}</Text>
                  <Text className="text-[11px] text-ink-mute">
                    {joinedLabel(f.joinedAt)}
                    {f.phone ? ` · ${f.phone}` : ''}
                  </Text>
                </View>
                <Badge label={st.label} variant={st.variant} />
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}
