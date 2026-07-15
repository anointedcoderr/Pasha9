// Built by Anointed Coder.
//
// Promotions (live): a filter chip row above the real promotions list from
// GET /api/content/promotions. Each card renders operator artwork, a category
// pill, the humanised `effective` summary + terms, and a claim CTA whose
// behavior follows the backend `claimAction`:
//   - credit   -> POST the claim, credit the bonus, invalidate the wallet
//   - deposit  -> route to /deposit (the reward is deposit-gated)
//   - redirect -> POST the claim, then open the returned URL in a browser
//   - disabled -> the CTA is inert with a reason chip
// A promo-code redeem field sits at the top. Both the per-card claim and the
// redeem are guarded against double-submit with a synchronous useRef (the
// disabled prop only catches up on the next render) and surface ApiError.message.

import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Screen,
  SectionHeader,
  ChipToggle,
  Badge,
  Pill,
  PrimaryButton,
  GhostButton,
  TextField,
  EmptyState,
} from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/client';
import {
  usePromotions,
  useClaimPromotion,
  useRedeemPromoCode,
  type Promotion,
} from '@/lib/api/promotions';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'first_deposit_bonus', label: 'Deposit' },
  { key: 'daily_bonus', label: 'Daily' },
  { key: 'weekly_reward', label: 'Weekly' },
  { key: 'referral_bonus', label: 'Referral' },
  { key: 'vip_reward', label: 'VIP' },
];

function categoryLabel(category: string): string {
  return category
    .replace(/_bonus$|_reward$|_offer$/g, '')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase();
}

interface Feedback {
  id: string;
  kind: 'ok' | 'err';
  text: string;
}

export default function PromotionsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const promosQuery = usePromotions();
  const claim = useClaimPromotion();
  const redeem = useRedeemPromoCode();

  // Synchronous double-submit guards. The disabled prop only updates on the
  // next render, so a rapid double-tap must be blocked by a ref read here.
  const claimInFlight = useRef<string | null>(null);
  const redeemInFlight = useRef(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [code, setCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const list = useMemo(() => {
    const all = promosQuery.data ?? [];
    return filter === 'all' ? all : all.filter((p) => p.category === filter);
  }, [promosQuery.data, filter]);

  async function onClaim(p: Promotion) {
    if (claimInFlight.current) return;
    if (p.claimAction === 'disabled' || p.claimed) return;

    if (p.claimAction === 'deposit') {
      router.push('/deposit');
      return;
    }

    claimInFlight.current = p.id;
    setFeedback(null);
    try {
      const res = await claim.mutateAsync(p.id);
      if (res.action === 'redirect' && res.url) {
        await WebBrowser.openBrowserAsync(res.url, { enableBarCollapsing: true, showTitle: true });
      } else if (typeof res.amount === 'number' && res.amount > 0) {
        setFeedback({ id: p.id, kind: 'ok', text: `Claimed ${formatBDT(res.amount)} bonus.` });
      } else {
        setFeedback({ id: p.id, kind: 'ok', text: 'Reward claimed.' });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not claim this promotion. Please try again.';
      setFeedback({ id: p.id, kind: 'err', text: msg });
    } finally {
      claimInFlight.current = null;
    }
  }

  async function onRedeem() {
    if (redeemInFlight.current) return;
    if (code.trim().length < 2) {
      setRedeemMsg({ kind: 'err', text: 'Enter a valid promo code.' });
      return;
    }
    redeemInFlight.current = true;
    setRedeemMsg(null);
    try {
      const res = await redeem.mutateAsync(code);
      const label = res.amount > 0 ? `Redeemed ${formatBDT(res.amount)}.` : 'Promo code redeemed.';
      setRedeemMsg({ kind: 'ok', text: label });
      setCode('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not redeem that code. Please try again.';
      setRedeemMsg({ kind: 'err', text: msg });
    } finally {
      redeemInFlight.current = false;
    }
  }

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      <SectionHeader title="Promotions" subtitle="Bonuses picked for you" icon="gift" />

      {/* Promo code redeem */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <Text className="text-sm font-extrabold text-ink">Have a promo code?</Text>
        <Text className="mt-0.5 text-[11px] text-ink-mute">Enter it below to add the reward to your wallet.</Text>
        <View className="mt-3 flex-row items-end gap-2">
          <TextField
            className="flex-1"
            placeholder="e.g. WELCOME10"
            icon="pricetag-outline"
            value={code}
            onChangeText={(t) => setCode(t)}
            autoCapitalize="characters"
          />
          <PrimaryButton
            label="Redeem"
            size="md"
            loading={redeem.isPending}
            disabled={redeem.isPending || code.trim().length < 2}
            onPress={onRedeem}
          />
        </View>
        {redeemMsg ? (
          <Text
            className="mt-2 text-[12px] font-semibold"
            style={{ color: redeemMsg.kind === 'ok' ? colors.gold700 : colors.hot }}
          >
            {redeemMsg.text}
          </Text>
        ) : null}
      </View>

      <ChipToggle options={FILTERS} value={filter} onChange={setFilter} scroll />

      {promosQuery.isLoading ? (
        <View className="items-center py-16">
          <ActivityIndicator color={colors.gold700} />
          <Text className="mt-3 text-sm text-ink-mute">Loading promotions</Text>
        </View>
      ) : promosQuery.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load promotions"
          message={
            promosQuery.error instanceof ApiError
              ? promosQuery.error.message
              : 'Check your connection and try again.'
          }
          actionLabel="Retry"
          onAction={() => promosQuery.refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title="No promotions here yet"
          message="Try a different filter. Fresh offers drop every week."
        />
      ) : (
        <View className="gap-4">
          {list.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              busy={claim.isPending && claimInFlight.current === p.id}
              feedback={feedback && feedback.id === p.id ? feedback : null}
              onClaim={() => onClaim(p)}
              onDetails={() => router.push('/legal')}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function claimLabel(p: Promotion): string {
  if (p.claimed) return 'Claimed';
  switch (p.claimAction) {
    case 'deposit':
      return 'Deposit to claim';
    case 'redirect':
      return 'Continue';
    case 'disabled':
      return 'Unavailable';
    default:
      return 'Claim';
  }
}

function PromoCard({
  promo,
  busy,
  feedback,
  onClaim,
  onDetails,
}: {
  promo: Promotion;
  busy: boolean;
  feedback: Feedback | null;
  onClaim: () => void;
  onDetails: () => void;
}) {
  const image = promo.bannerMobileUrl ?? promo.bannerUrl ?? promo.thumbnailUrl ?? promo.backgroundUrl;
  const terms = promo.termsEn ?? (promo.turnoverX > 0 ? `Wagering ${promo.turnoverX}x before release.` : 'Terms apply.');
  const disabled = promo.claimAction === 'disabled' || promo.claimed === true;

  return (
    <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
      {image ? (
        <View className="relative">
          <Image
            source={{ uri: image }}
            style={{ width: '100%', height: 140 }}
            contentFit="cover"
            transition={200}
          />
          <View className="absolute right-2.5 top-2.5">
            <Pill label={categoryLabel(promo.category)} tone="dark" />
          </View>
          {promo.claimed ? (
            <View className="absolute left-2.5 top-2.5">
              <Badge label="CLAIMED" variant="new" />
            </View>
          ) : null}
        </View>
      ) : (
        <View className="flex-row items-center justify-between border-b border-divider px-4 py-3">
          <Text className="text-[11px] font-black uppercase tracking-wider text-ink-mute">
            {categoryLabel(promo.category)}
          </Text>
          {promo.claimed ? <Badge label="CLAIMED" variant="new" /> : null}
        </View>
      )}

      <View className="gap-3 p-4">
        <View>
          <Text className="text-base font-extrabold text-ink" numberOfLines={1}>
            {promo.name}
          </Text>
          <Text className="mt-1 text-sm text-ink-mute" numberOfLines={3}>
            {promo.description ?? promo.effective}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Icon name="shield-checkmark-outline" size={13} color={colors.inkMute} />
          <Text className="flex-1 text-[11px] text-ink-mute" numberOfLines={2}>
            {terms}
          </Text>
        </View>

        {promo.disabledReason ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="alert-circle-outline" size={13} color={colors.hot} />
            <Text className="flex-1 text-[11px] font-medium text-hot">
              {promo.disabledReason === 'config_error'
                ? 'This offer is being updated. Check back soon.'
                : 'This offer is not available for your account yet.'}
            </Text>
          </View>
        ) : null}

        {feedback ? (
          <Text
            className="text-[12px] font-semibold"
            style={{ color: feedback.kind === 'ok' ? colors.gold700 : colors.hot }}
          >
            {feedback.text}
          </Text>
        ) : null}

        <View className="flex-row gap-2">
          <PrimaryButton
            label={claimLabel(promo)}
            size="sm"
            className="flex-1"
            loading={busy}
            disabled={disabled || busy}
            onPress={onClaim}
          />
          <GhostButton label="Details" size="sm" className="flex-1" onPress={onDetails} />
        </View>
      </View>
    </View>
  );
}
