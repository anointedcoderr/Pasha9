// Built by Anointed Coder.
//
// Affiliate (live, stack route): reads the applicant's real status from
// GET /api/affiliate/me and branches:
//   - approved / isAffiliate -> a partner dashboard (tier rates, downline,
//     commission totals)
//   - pending                -> an "under review" status card
//   - none / rejected        -> the apply form (channel / audience / notes)
//     posting to POST /api/affiliate/apply, guarded against double-submit
//     with a synchronous useRef and surfacing ApiError.message.

import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Screen,
  Gradient,
  StatRow,
  Badge,
  PrimaryButton,
  TextField,
  EmptyState,
} from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import {
  useAffiliateOverview,
  useApplyAffiliate,
  type AffiliateOverview,
} from '@/lib/api/affiliate';
import { formatBDT } from '@/lib/format';
import { colors, gradients } from '@/lib/theme';

const PERKS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'cash-outline', label: 'Lifetime revenue share' },
  { icon: 'time-outline', label: 'Weekly on-time payouts' },
  { icon: 'stats-chart-outline', label: 'Real-time dashboard' },
];

export default function AffiliateScreen() {
  const overview = useAffiliateOverview();

  return (
    <Screen header={<BackHeader title="Affiliate" />} contentClassName="px-4 pt-3 gap-4">
      {overview.isLoading ? (
        <View className="items-center py-24">
          <ActivityIndicator color={colors.gold700} />
          <Text className="mt-3 text-sm text-ink-mute">Loading affiliate status</Text>
        </View>
      ) : overview.isError || !overview.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load affiliate status"
          message={
            overview.error instanceof ApiError
              ? overview.error.message
              : 'Check your connection and try again.'
          }
          actionLabel="Retry"
          onAction={() => overview.refetch()}
        />
      ) : (
        <AffiliateBody data={overview.data} />
      )}
    </Screen>
  );
}

function AffiliateBody({ data }: { data: AffiliateOverview }) {
  const router = useRouter();
  const status = data.application?.status ?? null;
  const isPartner = data.isAffiliate || status === 'approved';
  const isPending = !isPartner && status === 'pending';

  return (
    <>
      {/* Hero */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gold-500/15" />

        <View className="relative p-5">
          <View className="self-start">
            <Badge label={isPartner ? 'PARTNER' : 'EARN WITH US'} variant="gold" />
          </View>
          <Text className="mt-3 text-2xl font-black leading-tight text-white">
            {isPartner ? 'You are a Pasha9 Affiliate' : 'Become a Pasha9 Affiliate'}
          </Text>
          <Text className="mt-2 text-sm text-white/70">
            {isPartner
              ? 'Share your referral code and earn revenue share on every player in your downline.'
              : 'Refer players and earn lifetime revenue share. No caps, no hidden cuts.'}
          </Text>

          <View className="mt-4 gap-2">
            {PERKS.map((p) => (
              <View key={p.label} className="flex-row items-center gap-2">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-gold-500/20">
                  <Ionicons name={p.icon} size={13} color={colors.gold300} />
                </View>
                <Text className="text-[13px] font-medium text-white/85">{p.label}</Text>
              </View>
            ))}
          </View>

          {isPartner && data.referralCode ? (
            <View className="mt-4 flex-row items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">Your code</Text>
              <Text className="text-lg font-black tracking-widest" style={{ color: colors.gold300 }}>
                {data.referralCode}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {isPartner ? (
        <PartnerDashboard data={data} onTerms={() => router.push('/legal')} />
      ) : isPending ? (
        <PendingCard data={data} />
      ) : (
        <ApplyForm rejected={status === 'rejected'} />
      )}
    </>
  );
}

function PartnerDashboard({ data, onTerms }: { data: AffiliateOverview; onTerms: () => void }) {
  return (
    <>
      <StatRow
        items={[
          { label: 'Downline', value: `${data.downline.level1}`, icon: 'people' },
          { label: 'Active', value: `${data.downline.active}`, icon: 'flame', valueTone: 'green' },
          { label: 'Withdrawable', value: formatBDT(data.commissions.withdrawable), icon: 'cash', valueTone: 'gold' },
        ]}
      />

      {/* Commission tiers */}
      {data.tier ? (
        <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
          <View className="flex-row items-center border-b border-divider bg-surface px-4 py-2.5">
            <Text className="flex-1 text-[11px] font-black uppercase tracking-wider text-ink-mute">
              {data.tier.name || 'Your tier'}
            </Text>
            <Text className="text-[11px] font-black uppercase tracking-wider text-ink-mute">Rate</Text>
          </View>
          {[
            { label: 'Level 1 (direct)', pct: data.tier.level1Pct },
            { label: 'Level 2', pct: data.tier.level2Pct },
            { label: 'Level 3', pct: data.tier.level3Pct },
          ].map((row, i) => (
            <View
              key={row.label}
              className={'flex-row items-center px-4 py-3 ' + (i > 0 ? 'border-t border-divider' : '')}
            >
              <Text className="flex-1 text-sm font-extrabold text-ink">{row.label}</Text>
              <Text className="text-sm font-black text-gold-700">{row.pct}%</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Commission totals */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <Text className="mb-3 text-base font-extrabold text-ink">Commissions</Text>
        {[
          { label: 'Pending', value: data.commissions.pending },
          { label: 'Approved', value: data.commissions.approved },
          { label: 'Paid', value: data.commissions.paid },
          { label: 'Total earned', value: data.commissions.totalAll },
        ].map((row, i) => (
          <View
            key={row.label}
            className={'flex-row items-center justify-between py-2 ' + (i > 0 ? 'border-t border-divider' : '')}
          >
            <Text className="text-sm text-ink-soft">{row.label}</Text>
            <Text className="text-sm font-bold text-ink">{formatBDT(row.value)}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onTerms}
        className="flex-row items-center justify-center gap-1.5 rounded-pill border border-divider bg-paper py-3 active:bg-surfaceAlt"
      >
        <Text className="text-sm font-bold text-ink-soft">Program terms</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.inkMute} />
      </Pressable>
    </>
  );
}

function PendingCard({ data }: { data: AffiliateOverview }) {
  return (
    <View className="items-center rounded-2xl border border-divider bg-paper p-6 shadow-sm shadow-black/5">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15">
        <Ionicons name="hourglass-outline" size={26} color={colors.gold700} />
      </View>
      <Text className="mt-3 text-center text-base font-extrabold text-ink">Application under review</Text>
      <Text className="mt-1 max-w-[280px] text-center text-sm text-ink-mute">
        Our partner team is reviewing your application. We will notify you once it is approved.
      </Text>
      {data.application?.channel ? (
        <View className="mt-4 w-full gap-2 rounded-xl border border-divider bg-surface px-4 py-3">
          <Row label="Channel" value={data.application.channel} />
          {data.application.audience ? <Row label="Audience" value={data.application.audience} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[12px] text-ink-mute">{label}</Text>
      <Text className="text-[12px] font-semibold text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ApplyForm({ rejected }: { rejected: boolean }) {
  const apply = useApplyAffiliate();
  const inFlight = useRef(false);

  const [channel, setChannel] = useState('');
  const [audience, setAudience] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const canSubmit = channel.trim().length >= 2;

  async function onApply() {
    if (inFlight.current) return;
    if (!canSubmit) {
      setFeedback({ kind: 'err', text: 'Tell us your main promotion channel to apply.' });
      return;
    }
    inFlight.current = true;
    setFeedback(null);
    try {
      const res = await apply.mutateAsync({ channel, audience, notes });
      setFeedback({
        kind: 'ok',
        text: res.alreadyApplied
          ? 'You already have an application on file. We will be in touch.'
          : 'Application submitted. Our team will review it shortly.',
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not submit your application. Please try again.';
      setFeedback({ kind: 'err', text: msg });
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
      <Text className="text-base font-extrabold text-ink">
        {rejected ? 'Reapply to the program' : 'Apply to the program'}
      </Text>
      <Text className="mt-0.5 text-[12px] text-ink-mute">
        Tell us how you plan to promote Pasha9 and who your audience is.
      </Text>

      <View className="mt-4 gap-3">
        <TextField
          label="Main channel"
          placeholder="e.g. Telegram, YouTube, Facebook"
          icon="megaphone-outline"
          value={channel}
          onChangeText={setChannel}
          autoCapitalize="sentences"
        />
        <TextField
          label="Audience (optional)"
          placeholder="e.g. 12k sports fans in BD"
          icon="people-outline"
          value={audience}
          onChangeText={setAudience}
          autoCapitalize="sentences"
        />
        <TextField
          label="Notes (optional)"
          placeholder="Anything else we should know"
          icon="document-text-outline"
          value={notes}
          onChangeText={setNotes}
          autoCapitalize="sentences"
        />
      </View>

      {feedback ? (
        <Text
          className="mt-3 text-[12px] font-semibold"
          style={{ color: feedback.kind === 'ok' ? colors.gold700 : colors.hot }}
        >
          {feedback.text}
        </Text>
      ) : null}

      <PrimaryButton
        label={rejected ? 'Reapply now' : 'Apply now'}
        icon="rocket"
        fullWidth
        className="mt-4"
        loading={apply.isPending}
        disabled={apply.isPending || !canSubmit}
        onPress={onApply}
      />
    </View>
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
