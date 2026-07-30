// Built by Anointed Coder.
//
// Rewards hub, wired to the live backend and rebuilt to mirror the website
// (apps/web/app/(site)/rewards). Reads coin balance + check-in + spin state
// from GET /api/rewards/me, the reward-store items from GET /api/content/rewards,
// and the wheel (tiers + segments) from GET /api/content/spin-wheel. Three real
// actions, all guarded against double-submit and all invalidating the wallet
// balance / bonuses on success because reward coins live on Wallet.bonusBalance:
//   - Daily check-in  POST /api/rewards/check-in
//   - Spin the wheel  POST /api/rewards/spin   (animated wheel + win modal)
//   - Redeem an item  POST /api/rewards/[id]/claim
// Parity with the site: gold hero, Store / Check-in / Spin tabs (deep-linkable
// via ?tab=), a tier selector so every wheel is reachable (not just tier 1), the
// animated SpinWheel, a win-celebration modal instead of a bare Alert, store
// artwork, and EN/BN copy.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import {
  Screen,
  Gradient,
  PrimaryButton,
  GhostButton,
  Badge,
  EmptyState,
  TextField,
  ChipToggle,
} from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { SpinWheel } from '@/components/rewards/SpinWheel';
import {
  useRewardsMe,
  useRewardStore,
  useSpinWheel,
  useCheckIn,
  useSpin,
  useRedeemReward,
  type RewardItem,
  type RedeemBody,
  type RechargeClaimBody,
  type SpinResultPayload,
  type SpinTier,
  type CheckInConfig,
  formatFreeSpins,
  isUnlimitedFreeSpins,
  UNLIMITED_FREE_SPINS,
} from '@/lib/api/rewards';
import { absoluteMediaUrl } from '@/lib/api/home';
import { ApiError } from '@/lib/api/client';
import { useAppLang } from '@/lib/lang';
import { colors, gradients } from '@/lib/theme';

type IconName = string;
type TabKey = 'spin' | 'checkin' | 'store';

const OPERATORS: { key: RechargeClaimBody['operator']; label: string }[] = [
  { key: 'gp', label: 'GP' },
  { key: 'robi', label: 'Robi' },
  { key: 'bl', label: 'Banglalink' },
  { key: 'airtel', label: 'Airtel' },
  { key: 'teletalk', label: 'Teletalk' },
];

function payoutDescription(payoutType: string, payoutAmount: number, bn: boolean): string {
  switch (payoutType) {
    case 'coins':
      return bn ? `${payoutAmount} কয়েন` : `${payoutAmount} coins`;
    case 'bonus':
      return bn ? `${payoutAmount} BDT বোনাস` : `BDT ${payoutAmount} bonus`;
    case 'cash':
      return bn ? `${payoutAmount} BDT ক্যাশ` : `BDT ${payoutAmount} cash`;
    case 'free_bet':
      return bn ? `${payoutAmount} BDT ফ্রি বেট` : `BDT ${payoutAmount} free bet`;
    case 'loss':
    case 'nothing':
      return bn ? 'এবার কোনো পুরস্কার নেই' : 'no prize this time';
    default:
      return payoutAmount > 0 ? `${payoutAmount}` : bn ? 'একটি পুরস্কার' : 'a prize';
  }
}

function payoutUnit(payoutType: string, bn: boolean): string {
  switch (payoutType) {
    case 'coins':
      return bn ? 'কয়েন' : 'coins';
    case 'bonus':
      return bn ? 'BDT বোনাস' : 'BDT bonus';
    case 'cash':
      return bn ? 'BDT ক্যাশ' : 'BDT cash';
    case 'free_bet':
      return bn ? 'BDT ফ্রি বেট' : 'BDT free bet';
    default:
      return '';
  }
}

// Eases a number from 0 to `to` for the premium win reveal (issue #5).
function CountUpText({ to, className, style }: { to: number; className?: string; style?: object }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / 900);
      setVal(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <Text className={className} style={style}>
      {val.toLocaleString()}
    </Text>
  );
}

export default function RewardsScreen() {
  const { width } = useWindowDimensions();
  const { lang } = useAppLang();
  const bn = lang === 'bn';
  const params = useLocalSearchParams<{ tab?: string }>();

  const meQuery = useRewardsMe();
  const storeQuery = useRewardStore();
  const wheelQuery = useSpinWheel();

  const checkIn = useCheckIn();
  const spin = useSpin();

  const me = meQuery.data;

  const initialTab: TabKey =
    params.tab === 'store' || params.tab === 'checkin' || params.tab === 'spin' ? params.tab : 'spin';
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([meQuery.refetch(), storeQuery.refetch(), wheelQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [meQuery, storeQuery, wheelQuery]);

  // Guards flip synchronously so a double-tap cannot fire twice before the
  // disabled prop catches up on the next render.
  const checkInGuard = useRef(false);
  const spinGuard = useRef(false);

  const onCheckIn = useCallback(() => {
    if (checkInGuard.current || checkIn.isPending) return;
    checkInGuard.current = true;
    checkIn.mutate(undefined, {
      onSuccess: (res) => {
        const bonus = res.isDay7 ? (bn ? ' (৭ম দিনের বোনাসসহ!)' : ' (day 7 bonus included!)') : '';
        Alert.alert(
          bn ? 'চেক-ইন সম্পন্ন' : 'Checked in',
          `+${res.coinsAwarded} ${bn ? 'কয়েন - স্ট্রিক দিন' : 'coins - streak day'} ${res.streakDay}${bonus}`,
        );
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : bn ? 'চেক-ইন ব্যর্থ হয়েছে।' : 'Check-in failed. Please try again.';
        Alert.alert(bn ? 'চেক-ইন ব্যর্থ' : 'Check-in failed', msg);
      },
      onSettled: () => {
        checkInGuard.current = false;
      },
    });
  }, [checkIn, bn]);

  // Tier selection. Every configured wheel is reachable (the old screen only
  // ever spun tiers[0], so Grand/Supreme were unreachable). Falls back to the
  // legacy untiered wheel when no tiers exist.
  const tiers: SpinTier[] = wheelQuery.data?.tiers ?? [];
  const [selectedTierKey, setSelectedTierKey] = useState<string | null>(null);
  const selectedTier = useMemo(() => {
    if (tiers.length === 0) return null;
    return tiers.find((t) => t.key === selectedTierKey) ?? tiers[0];
  }, [tiers, selectedTierKey]);
  const tierKey = selectedTier?.key;
  const wheelSegments = useMemo(
    () => selectedTier?.segments ?? wheelQuery.data?.segments ?? wheelQuery.data?.legacySegments ?? [],
    [selectedTier, wheelQuery.data],
  );

  // Spin animation + result state.
  const [spinning, setSpinning] = useState(false);
  const [landingIndex, setLandingIndex] = useState<number | null>(null);
  const pendingResult = useRef<SpinResultPayload | null>(null);
  const [celebration, setCelebration] = useState<SpinResultPayload | null>(null);

  const onSpin = useCallback(() => {
    if (spinGuard.current || spin.isPending || spinning) return;
    spinGuard.current = true;
    pendingResult.current = null;
    setCelebration(null);
    spin.mutate(tierKey, {
      onSuccess: (res) => {
        // Land the wheel on the server-chosen wedge, then reveal the prize
        // when the animation completes (onLandingComplete).
        pendingResult.current = res;
        setLandingIndex(res.segmentIndex);
        setSpinning(true);
      },
      onError: (err) => {
        setSpinning(false);
        const msg = err instanceof ApiError ? err.message : bn ? 'স্পিন ব্যর্থ হয়েছে।' : 'Spin failed. Please try again.';
        Alert.alert(bn ? 'স্পিন ব্যর্থ' : 'Spin failed', msg);
      },
      onSettled: () => {
        spinGuard.current = false;
      },
    });
  }, [spin, tierKey, spinning, bn]);

  const onLandingComplete = useCallback(() => {
    setSpinning(false);
    if (pendingResult.current) {
      setCelebration(pendingResult.current);
      pendingResult.current = null;
    }
  }, []);

  const onSelectTier = useCallback((key: string) => {
    setSelectedTierKey(key);
    setLandingIndex(null);
    pendingResult.current = null;
  }, []);

  // Redeem sheet state.
  const [redeemItem, setRedeemItem] = useState<RewardItem | null>(null);

  if (meQuery.isLoading) {
    return (
      <Screen header={<StackScreenHeader title={bn ? 'রিওয়ার্ড' : 'Rewards'} />} contentClassName="px-4 pt-3 gap-4">
        <View className="h-28 rounded-2xl border border-divider bg-surfaceAlt/40" />
        <View className="h-36 rounded-2xl border border-divider bg-surfaceAlt/40" />
      </Screen>
    );
  }

  if (meQuery.isError || !me) {
    const msg =
      meQuery.error instanceof ApiError ? meQuery.error.message : bn ? 'রিওয়ার্ড লোড করা যায়নি।' : 'We could not load your rewards.';
    return (
      <Screen header={<StackScreenHeader title={bn ? 'রিওয়ার্ড' : 'Rewards'} />} contentClassName="px-4 pt-3 gap-4">
        <EmptyState
          icon="alert-circle-outline"
          title={bn ? 'রিওয়ার্ড অনুপলব্ধ' : 'Rewards unavailable'}
          message={msg}
          actionLabel={bn ? 'আবার চেষ্টা করুন' : 'Try again'}
          onAction={() => meQuery.refetch()}
        />
      </Screen>
    );
  }

  const GAP = 12;
  const tileW = (width - 32 - GAP) / 2;

  const spinCost = selectedTier?.costPerSpin ?? me.spin.config.costPerSpinCoins;

  // Free-spin availability for THE SELECTED tier. me.spin.freeSpinsRemaining is a
  // cross-tier aggregate, so we derive the per-tier value the way the spin route
  // does: this tier's daily allowance (capped by the remaining global daily
  // allowance) plus this tier's granted spins.
  const tierAllowance = selectedTier?.freeSpinsPerDay ?? me.spin.config.freeSpinsPerDay;
  const grantedFreeForTier = tierKey ? me.spin.grantedFreeSpinsByTier[tierKey] ?? 0 : 0;
  // A negative allowance is the "unlimited" sentinel. Short-circuit before the
  // min() so an unlimited wheel is never clamped down to a real number, and so
  // the coin gate below never disables an unlimited wheel.
  const freeUnlimited =
    isUnlimitedFreeSpins(tierAllowance) ||
    (!selectedTier && isUnlimitedFreeSpins(me.spin.dailyFreeSpinsRemaining));
  const freeSpins = freeUnlimited
    ? UNLIMITED_FREE_SPINS
    : Math.max(0, Math.min(me.spin.dailyFreeSpinsRemaining, tierAllowance) + grantedFreeForTier);
  const hasFreeSpins = freeUnlimited || freeSpins > 0;
  const spinDisabled =
    !me.spin.config.enabled ||
    spin.isPending ||
    spinning ||
    wheelSegments.length === 0 ||
    (!hasFreeSpins && me.coins < spinCost);
  const rewardsAvailable = storeQuery.data?.items.filter((i) => me.coins >= i.cost).length ?? 0;
  const wheelSize = Math.min(width - 72, 320);

  return (
    <Screen
      header={<StackScreenHeader title={bn ? 'রিওয়ার্ড' : 'Rewards'} />}
      contentClassName="px-4 pt-3 gap-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold600} />
      }
    >
      {/* Gold hero band */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20" />
        <View className="relative p-4">
          <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#7A4F00' }}>
            {bn ? 'পাশা৯ রিওয়ার্ড' : 'Pasha9 Rewards'}
          </Text>
          <Text className="mt-1 text-2xl font-black" style={{ color: '#3A1F00' }}>
            {bn ? 'খেলুন। কামান। জিতুন।' : 'Play. Earn. Win.'}
          </Text>
          <View className="mt-3 flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white/30">
              <Icon name="star" size={24} color="#7A4F00" />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-black" style={{ color: '#3A1F00' }}>
                {me.coins.toLocaleString()}
              </Text>
              <Text className="text-[11px] font-semibold" style={{ color: '#5A3A00' }}>
                {bn
                  ? `${formatFreeSpins(freeSpins, bn)} ফ্রি স্পিন বাকি · ${rewardsAvailable} রিওয়ার্ড উপলব্ধ`
                  : `${formatFreeSpins(freeSpins, bn)} free spins left · ${rewardsAvailable} rewards available`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row rounded-2xl border border-divider bg-surface p-1">
        {(
          [
            { key: 'spin', label: bn ? 'স্পিন' : 'Spin', icon: 'disc' },
            { key: 'checkin', label: bn ? 'চেক-ইন' : 'Check-in', icon: 'calendar' },
            { key: 'store', label: bn ? 'স্টোর' : 'Store', icon: 'gift' },
          ] as { key: TabKey; label: string; icon: string }[]
        ).map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 ' + (active ? 'bg-paper shadow-sm shadow-black/5' : '')}
            >
              <Icon name={t.icon} size={15} color={active ? colors.gold700 : colors.inkMute} />
              <Text className="text-[13px] font-bold" style={{ color: active ? colors.ink : colors.inkMute }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* SPIN TAB */}
      {tab === 'spin' ? (
        !me.spin.config.enabled ? (
          <EmptyState icon="pause-circle-outline" title={bn ? 'স্পিন সাময়িক বন্ধ' : 'Spin paused'} message={bn ? 'শীঘ্রই ফিরে আসুন।' : 'Please check back soon.'} />
        ) : (
          <View className="items-center gap-4 rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
            {tiers.length > 1 ? (
              <ChipToggle
                scroll
                options={tiers.map((t) => ({ key: t.key, label: bn ? t.nameBn ?? t.nameEn : t.nameEn }))}
                value={tierKey ?? tiers[0].key}
                onChange={onSelectTier}
              />
            ) : null}

            <SpinWheel
              segments={wheelSegments.map((s) => ({ id: s.id, label: s.label, color: s.color }))}
              spinning={spinning}
              landingIndex={landingIndex}
              onLandingComplete={onLandingComplete}
              onSpinPress={onSpin}
              size={wheelSize}
              centerLabel={bn ? 'স্পিন' : 'SPIN'}
              disabled={spinDisabled}
            />

            <View className="w-full flex-row items-center justify-center gap-2">
              {hasFreeSpins ? <Badge label={bn ? 'ফ্রি' : 'FREE'} variant="new" /> : null}
              <Text className="text-xs font-semibold text-ink-soft">
                {hasFreeSpins
                  ? bn
                    ? `${formatFreeSpins(freeSpins, bn)} ফ্রি স্পিন বাকি`
                    : `${formatFreeSpins(freeSpins, bn)} free spins left`
                  : bn
                    ? `প্রতি স্পিন ${spinCost} কয়েন · আপনার ${me.coins.toLocaleString()}`
                    : `${spinCost} coins per spin · you have ${me.coins.toLocaleString()}`}
              </Text>
            </View>

            <PrimaryButton
              label={
                spinning
                  ? bn
                    ? 'ঘুরছে...'
                    : 'Spinning...'
                  : hasFreeSpins
                    ? bn
                      ? `ফ্রি স্পিন করুন (${formatFreeSpins(freeSpins, bn)})`
                      : `Spin free (${formatFreeSpins(freeSpins, bn)})`
                    : bn
                      ? `${spinCost} কয়েনে স্পিন`
                      : `Spin for ${spinCost} coins`
              }
              icon="sync"
              fullWidth
              loading={spinning || spin.isPending}
              disabled={spinDisabled}
              onPress={onSpin}
            />
          </View>
        )
      ) : null}

      {/* CHECK-IN TAB */}
      {tab === 'checkin' ? (
        <CheckInCard
          bn={bn}
          config={me.checkIn.config}
          streakDay={me.checkIn.streakDay}
          claimedToday={me.checkIn.claimedToday}
          depositRequired={me.checkIn.depositRequiredForNextCycle}
          busy={checkIn.isPending}
          onCheckIn={onCheckIn}
        />
      ) : null}

      {/* STORE TAB */}
      {tab === 'store' ? (
        <View className="gap-3">
          <Text className="text-base font-extrabold text-ink">{bn ? 'রিওয়ার্ড স্টোর' : 'Rewards store'}</Text>
          {storeQuery.isLoading ? (
            <View className="h-40 rounded-2xl border border-divider bg-surfaceAlt/40" />
          ) : storeQuery.isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title={bn ? 'স্টোর অনুপলব্ধ' : 'Store unavailable'}
              message={storeQuery.error instanceof ApiError ? storeQuery.error.message : bn ? 'স্টোর লোড করা যায়নি।' : 'We could not load the rewards store.'}
              actionLabel={bn ? 'আবার চেষ্টা করুন' : 'Try again'}
              onAction={() => storeQuery.refetch()}
            />
          ) : (storeQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState icon="gift-outline" title={bn ? 'এখনও কোনো রিওয়ার্ড নেই' : 'No rewards yet'} message={bn ? 'নতুন রিওয়ার্ড শীঘ্রই আসছে।' : 'New redeemable rewards will appear here soon.'} />
          ) : (
            <View className="flex-row flex-wrap justify-between" style={{ rowGap: GAP }}>
              {storeQuery.data!.items.map((item) => (
                <StoreTile
                  key={item.id}
                  bn={bn}
                  item={item}
                  width={tileW}
                  affordable={me.coins >= item.cost}
                  onPress={() => setRedeemItem(item)}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      <WinCelebration bn={bn} result={celebration} onClose={() => setCelebration(null)} />

      <RedeemSheet bn={bn} item={redeemItem} coins={me.coins} onClose={() => setRedeemItem(null)} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Win-celebration modal (replaces the old Alert)
// ---------------------------------------------------------------------------

function WinCelebration({ bn, result, onClose }: { bn: boolean; result: SpinResultPayload | null; onClose: () => void }) {
  const visible = result != null;
  const won = result != null && result.payoutType !== 'loss' && result.payoutType !== 'nothing' && result.payoutAmount > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={onClose}>
        {/* Inner Pressable swallows the touch so tapping the card does not
            dismiss the modal; only the backdrop or the button closes it. */}
        <Pressable className="w-full max-w-sm overflow-hidden rounded-3xl border" style={{ borderColor: won ? colors.gold500 : colors.divider }} onPress={() => {}}>
          <Gradient colors={won ? gradients.gold : gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={24} />
          <View className="relative items-center p-6">
            <View
              className="h-16 w-16 items-center justify-center rounded-full border"
              style={{ borderColor: won ? '#B37F00' : 'rgba(255,255,255,0.25)', backgroundColor: won ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)' }}
            >
              <Icon name={won ? 'trophy' : 'refresh'} size={30} color={won ? '#7A4F00' : '#FFFFFF'} />
            </View>
            <Text className="mt-3 text-2xl font-black" style={{ color: won ? '#3A1F00' : '#FFFFFF' }}>
              {won ? (bn ? 'অভিনন্দন!' : 'Congratulations!') : bn ? 'আরেকটু!' : 'So close!'}
            </Text>
            {result ? (
              won ? (
                <>
                  <Text className="mt-1 text-base font-bold" style={{ color: '#5A3A00' }}>{result.segmentLabel}</Text>
                  <View className="mt-1 flex-row items-baseline">
                    <CountUpText to={result.payoutAmount} className="text-4xl font-black" style={{ color: '#3A1F00' }} />
                    <Text className="ml-1.5 text-sm font-bold" style={{ color: '#7A4F00' }}>{payoutUnit(result.payoutType, bn)}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text className="mt-1 text-base font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{result.segmentLabel}</Text>
                  <Text className="mt-0.5 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {payoutDescription(result.payoutType, result.payoutAmount, bn)}
                  </Text>
                </>
              )
            ) : null}
            <PrimaryButton label={bn ? 'দারুণ' : 'Awesome'} fullWidth className="mt-5" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Store tile (with artwork parity)
// ---------------------------------------------------------------------------

function StoreTile({
  bn,
  item,
  width,
  affordable,
  onPress,
}: {
  bn: boolean;
  item: RewardItem;
  width: number;
  affordable: boolean;
  onPress: () => void;
}) {
  const art = absoluteMediaUrl(item.bannerUrl ?? item.imageUrl);
  const title = bn ? item.titleBn ?? item.title : item.title;
  return (
    <View style={{ width }} className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
      {art ? (
        <Image source={{ uri: art }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" transition={150} />
      ) : (
        <View className="items-center justify-center bg-gold-500/10" style={{ width: '100%', aspectRatio: 16 / 9 }}>
          <Icon name={rewardIcon(item.rewardType)} size={26} color={colors.gold700} />
        </View>
      )}
      <View className="p-3">
        <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
          {title}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Icon name="star" size={12} color={colors.gold600} />
          <Text className="text-xs font-bold text-ink-soft">
            {item.cost.toLocaleString()} {bn ? 'কয়েন' : 'coins'}
          </Text>
        </View>
        <PrimaryButton
          label={affordable ? (bn ? 'রিডিম' : 'Redeem') : bn ? 'কয়েন কম' : 'Not enough'}
          size="sm"
          fullWidth
          disabled={!affordable}
          className="mt-3"
          onPress={onPress}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

function CheckInCard({
  bn,
  config,
  streakDay,
  claimedToday,
  depositRequired,
  busy,
  onCheckIn,
}: {
  bn: boolean;
  config: CheckInConfig;
  streakDay: number;
  claimedToday: boolean;
  depositRequired: boolean;
  busy: boolean;
  onCheckIn: () => void;
}) {
  const enabled = config.enabled;
  const cycleLength = Math.max(1, Math.min(60, Math.floor(config.cycleLength || 7)));
  const perDay = Array.isArray(config.dayAmounts) && config.dayAmounts.length === cycleLength;
  const todayInCycle = claimedToday ? ((streakDay - 1) % cycleLength) + 1 : (streakDay % cycleLength) + 1;
  const days = Array.from({ length: cycleLength }, (_, i) => i + 1);
  const rewardFor = (day: number) =>
    perDay
      ? Math.max(0, Math.floor(Number(config.dayAmounts[day - 1] ?? config.dailyCoins)))
      : config.dailyCoins + (day === cycleLength ? config.streakBonusDay7 : 0);
  const gateText = bn ? config.depositGateTextBn : config.depositGateTextEn;

  const label = !enabled
    ? bn
      ? 'চেক-ইন বন্ধ'
      : 'Check-in paused'
    : depositRequired
      ? bn
        ? 'নতুন ডিপোজিট প্রয়োজন'
        : 'New deposit required'
      : claimedToday
        ? bn
          ? 'আজ চেক-ইন হয়েছে'
          : 'Checked in today'
        : busy
          ? bn
            ? 'চেক-ইন হচ্ছে...'
            : 'Checking in...'
          : bn
            ? 'আজ চেক-ইন করুন'
            : 'Check in today';

  return (
    <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-extrabold text-ink">{bn ? 'দৈনিক চেক-ইন' : 'Daily check-in'}</Text>
        <Text className="text-[11px] font-bold text-gold-700">{bn ? `স্ট্রিক: ${streakDay} দিন` : `Streak: ${streakDay} days`}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {days.map((day) => {
          const claimed = day < todayInCycle || (day === todayInCycle && claimedToday);
          const today = day === todayInCycle && !claimedToday;
          const reward = rewardFor(day);
          return (
            <View
              key={day}
              className={
                'w-16 items-center rounded-xl border py-3 ' +
                (today ? 'border-gold-600 bg-gold-500/15' : claimed ? 'border-divider bg-surface' : 'border-divider bg-paper')
              }
            >
              <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">
                {bn ? `দিন ${day}` : `Day ${day}`}
              </Text>
              <View
                className={
                  'my-1.5 h-8 w-8 items-center justify-center rounded-full ' +
                  (claimed ? 'bg-newg/15' : today ? 'bg-gold-500' : 'bg-surfaceAlt')
                }
              >
                <Icon name={claimed ? 'checkmark' : 'star'} size={15} color={claimed ? colors.newg : today ? colors.ink : colors.inkMute} />
              </View>
              <Text className="text-[11px] font-black" style={{ color: today ? colors.gold700 : colors.inkSoft }}>
                +{reward}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {depositRequired ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl border border-gold-600/30 bg-gold-500/10 p-3">
          <Icon name="lock-closed" size={15} color={colors.gold700} />
          <Text className="flex-1 text-[12px] leading-5 text-ink-soft">{gateText}</Text>
        </View>
      ) : null}

      <PrimaryButton
        label={label}
        icon="calendar"
        fullWidth
        className="mt-3"
        loading={busy}
        disabled={!enabled || claimedToday || busy || depositRequired}
        onPress={onCheckIn}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Redeem sheet (per-rewardType payload the server requires)
// ---------------------------------------------------------------------------

function RedeemSheet({
  bn,
  item,
  coins,
  onClose,
}: {
  bn: boolean;
  item: RewardItem | null;
  coins: number;
  onClose: () => void;
}) {
  const redeem = useRedeemReward();
  const guard = useRef(false);

  const [operator, setOperator] = useState<RechargeClaimBody['operator']>('gp');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const reset = useCallback(() => {
    setOperator('gp');
    setPhone('');
    setFullName('');
    setAddress('');
    setNotes('');
    guard.current = false;
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const submit = useCallback(() => {
    if (!item) return;
    if (guard.current || redeem.isPending) return;

    let body: RedeemBody;
    if (item.rewardType === 'recharge') {
      if (!/^0?1\d{9}$/.test(phone.trim())) {
        Alert.alert(bn ? 'নম্বর দেখুন' : 'Check the number', bn ? 'একটি সঠিক বাংলাদেশি মোবাইল নম্বর দিন।' : 'Enter a valid Bangladeshi mobile number.');
        return;
      }
      body = { operator, phone: phone.trim() };
    } else if (item.rewardType === 'physical') {
      if (fullName.trim().length < 2 || phone.trim().length < 10 || address.trim().length < 5) {
        Alert.alert(bn ? 'ডেলিভারি তথ্য' : 'Delivery details', bn ? 'নাম, ফোন এবং সম্পূর্ণ ঠিকানা দিন।' : 'Please fill in your name, phone and full address.');
        return;
      }
      body = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
    } else {
      body = {};
    }

    guard.current = true;
    redeem.mutate(
      { id: item.id, body },
      {
        onSuccess: () => {
          Alert.alert(
            bn ? 'রিওয়ার্ড অনুরোধ করা হয়েছে' : 'Reward requested',
            `${bn ? item.titleBn ?? item.title : item.title} ${bn ? 'প্রক্রিয়াধীন। কাটা হয়েছে' : 'is being processed. We deducted'} ${item.cost} ${bn ? 'কয়েন।' : 'coins.'}`,
          );
          close();
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : bn ? 'রিডিম করা যায়নি।' : 'Could not redeem this reward. Please try again.';
          Alert.alert(bn ? 'রিডিম ব্যর্থ' : 'Redeem failed', msg);
        },
        onSettled: () => {
          guard.current = false;
        },
      },
    );
  }, [item, operator, phone, fullName, address, notes, redeem, close, bn]);

  const visible = item != null;
  const affordable = item ? coins >= item.cost : false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl border-t border-divider bg-paper px-4 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-black text-ink" numberOfLines={1}>
              {(bn ? item?.titleBn ?? item?.title : item?.title) ?? (bn ? 'রিডিম' : 'Redeem')}
            </Text>
            <Pressable onPress={close} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt">
              <Icon name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <View className="mb-3 flex-row items-center gap-1.5">
            <Icon name="star" size={14} color={colors.gold600} />
            <Text className="text-sm font-bold text-ink-soft">
              {item?.cost.toLocaleString()} {bn ? 'কয়েন' : 'coins'}
            </Text>
            <Text className="text-xs text-ink-mute">
              {bn ? `- আপনার ${coins.toLocaleString()}` : `- you have ${coins.toLocaleString()}`}
            </Text>
          </View>

          {item?.description || item?.descriptionBn ? (
            <Text className="mb-3 text-xs text-ink-mute">{bn ? item?.descriptionBn ?? item?.description : item?.description}</Text>
          ) : null}

          {item?.rewardType === 'recharge' ? (
            <View className="gap-3">
              <View>
                <Text className="mb-1.5 text-xs font-bold text-ink-soft">{bn ? 'অপারেটর' : 'Operator'}</Text>
                <ChipToggle
                  scroll
                  options={OPERATORS.map((o) => ({ key: o.key, label: o.label }))}
                  value={operator}
                  onChange={(k) => setOperator(k as RechargeClaimBody['operator'])}
                />
              </View>
              <TextField label={bn ? 'মোবাইল নম্বর' : 'Mobile number'} value={phone} onChangeText={setPhone} placeholder="01XXXXXXXXX" keyboardType="phone-pad" />
            </View>
          ) : item?.rewardType === 'physical' ? (
            <View className="gap-3">
              <TextField label={bn ? 'পূর্ণ নাম' : 'Full name'} value={fullName} onChangeText={setFullName} placeholder={bn ? 'আপনার নাম' : 'Your name'} />
              <TextField label={bn ? 'ফোন' : 'Phone'} value={phone} onChangeText={setPhone} placeholder="01XXXXXXXXX" keyboardType="phone-pad" />
              <TextField label={bn ? 'ডেলিভারি ঠিকানা' : 'Delivery address'} value={address} onChangeText={setAddress} placeholder={bn ? 'বাসা, রোড, এলাকা, জেলা' : 'House, road, area, district'} />
              <TextField label={bn ? 'নোট (ঐচ্ছিক)' : 'Notes (optional)'} value={notes} onChangeText={setNotes} placeholder={bn ? 'কিছু জানানোর থাকলে' : 'Anything we should know'} />
            </View>
          ) : (
            <Text className="text-xs text-ink-mute">
              {bn ? 'রিডিম নিশ্চিত করুন। ' : 'Confirm to redeem this reward. '}
              {(bn ? item?.shortInstructionBn ?? item?.shortInstructionEn : item?.shortInstructionEn) ?? ''}
            </Text>
          )}

          <View className="mt-4 flex-row gap-3">
            <GhostButton label={bn ? 'বাতিল' : 'Cancel'} className="flex-1" onPress={close} />
            <PrimaryButton
              label={redeem.isPending ? (bn ? 'রিডিম হচ্ছে...' : 'Redeeming...') : bn ? 'নিশ্চিত করুন' : 'Confirm redeem'}
              className="flex-1"
              loading={redeem.isPending}
              disabled={!affordable || redeem.isPending}
              onPress={submit}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function rewardIcon(type: string): IconName {
  switch (type) {
    case 'recharge':
      return 'phone-portrait';
    case 'physical':
      return 'cube';
    case 'digital':
      return 'sparkles';
    default:
      return 'gift';
  }
}
