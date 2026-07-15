// Built by Anointed Coder.
//
// Rewards hub, wired to the live backend. Reads the player's coin balance +
// check-in + spin state from GET /api/rewards/me, the reward-store items from
// GET /api/content/rewards, and the wheel description from
// GET /api/content/spin-wheel. Three real actions, all guarded against
// double-submit and all invalidating the wallet balance / bonuses on success
// because reward coins live on Wallet.bonusBalance:
//   - Daily check-in  POST /api/rewards/check-in   (credits coins, streak)
//   - Spin the wheel  POST /api/rewards/spin        (spends coins / grants prize)
//   - Redeem an item  POST /api/rewards/[id]/claim  (spends coins immediately)
// The redeem sheet collects the operator/phone or delivery details the server
// requires per RewardItem.rewardType.

import { useCallback, useMemo, useRef, useState } from 'react';
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
} from '@/lib/api/rewards';
import { ApiError } from '@/lib/api/client';
import { colors, gradients } from '@/lib/theme';

type IconName = string;

const OPERATORS: { key: RechargeClaimBody['operator']; label: string }[] = [
  { key: 'gp', label: 'GP' },
  { key: 'robi', label: 'Robi' },
  { key: 'bl', label: 'Banglalink' },
  { key: 'airtel', label: 'Airtel' },
  { key: 'teletalk', label: 'Teletalk' },
];

function payoutDescription(payoutType: string, payoutAmount: number): string {
  switch (payoutType) {
    case 'coins':
      return `${payoutAmount} coins`;
    case 'bonus':
      return `BDT ${payoutAmount} bonus`;
    case 'cash':
      return `BDT ${payoutAmount} cash`;
    case 'free_bet':
      return `BDT ${payoutAmount} free bet`;
    case 'loss':
    case 'nothing':
      return 'no prize this time';
    default:
      return payoutAmount > 0 ? `${payoutAmount}` : 'a prize';
  }
}

export default function RewardsScreen() {
  const { width } = useWindowDimensions();
  const meQuery = useRewardsMe();
  const storeQuery = useRewardStore();
  const wheelQuery = useSpinWheel();

  const checkIn = useCheckIn();
  const spin = useSpin();

  const me = meQuery.data;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([meQuery.refetch(), storeQuery.refetch(), wheelQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [meQuery, storeQuery, wheelQuery]);

  // Guards: refs flip synchronously so a double-tap cannot fire twice before
  // the disabled prop catches up on the next render.
  const checkInGuard = useRef(false);
  const spinGuard = useRef(false);

  const onCheckIn = useCallback(() => {
    if (checkInGuard.current || checkIn.isPending) return;
    checkInGuard.current = true;
    checkIn.mutate(undefined, {
      onSuccess: (res) => {
        const bonus = res.isDay7 ? ' (day 7 bonus included!)' : '';
        Alert.alert('Checked in', `+${res.coinsAwarded} coins - streak day ${res.streakDay}${bonus}`);
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : 'Check-in failed. Please try again.';
        Alert.alert('Check-in failed', msg);
      },
      onSettled: () => {
        checkInGuard.current = false;
      },
    });
  }, [checkIn]);

  // The spin control targets ONE wheel: the first configured tier, or the
  // legacy untiered wheel when no tiers exist. Cost AND free-spin availability
  // are both read from this same tier so the two can never disagree.
  const selectedTier = useMemo(() => wheelQuery.data?.tiers?.[0] ?? null, [wheelQuery.data]);
  const tierKey = selectedTier?.key;

  const onSpin = useCallback(() => {
    if (spinGuard.current || spin.isPending) return;
    spinGuard.current = true;
    spin.mutate(tierKey, {
      onSuccess: (res) => {
        Alert.alert(
          res.payoutType === 'loss' || res.payoutType === 'nothing' ? 'So close!' : 'You won!',
          `${res.segmentLabel} - ${payoutDescription(res.payoutType, res.payoutAmount)}.`,
        );
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : 'Spin failed. Please try again.';
        Alert.alert('Spin failed', msg);
      },
      onSettled: () => {
        spinGuard.current = false;
      },
    });
  }, [spin, tierKey]);

  // Redeem sheet state.
  const [redeemItem, setRedeemItem] = useState<RewardItem | null>(null);

  if (meQuery.isLoading) {
    return (
      <Screen header={<StackScreenHeader title="Rewards" />} contentClassName="px-4 pt-3 gap-4">
        <View className="h-28 rounded-2xl border border-divider bg-surfaceAlt/40" />
        <View className="h-36 rounded-2xl border border-divider bg-surfaceAlt/40" />
      </Screen>
    );
  }

  if (meQuery.isError || !me) {
    const msg =
      meQuery.error instanceof ApiError ? meQuery.error.message : 'We could not load your rewards.';
    return (
      <Screen header={<StackScreenHeader title="Rewards" />} contentClassName="px-4 pt-3 gap-4">
        <EmptyState
          icon="alert-circle-outline"
          title="Rewards unavailable"
          message={msg}
          actionLabel="Try again"
          onAction={() => meQuery.refetch()}
        />
      </Screen>
    );
  }

  const GAP = 12;
  const tileW = (width - 32 - GAP) / 2;

  const spinCost = selectedTier?.costPerSpin ?? me.spin.config.costPerSpinCoins;

  // Free-spin availability for THE SELECTED tier only. me.spin.freeSpinsRemaining
  // is a cross-tier aggregate (every tier's granted spins plus the global daily
  // allowance), so it can read > 0 while THIS wheel would still charge coins,
  // which would label a paid spin "free". Derive it per tier the way the spin
  // route does:
  //   - granted spins are already bucketed by tier key on the server
  //   - the daily allowance is this tier's own freeSpinsPerDay, capped by the
  //     remaining global daily allowance the server reports
  // The legacy untiered wheel (no selectedTier) has no granted spins and the
  // route uses the global daily allowance directly, so both terms fall back to
  // that.
  const tierAllowance = selectedTier?.freeSpinsPerDay ?? me.spin.config.freeSpinsPerDay;
  const grantedFreeForTier = tierKey ? me.spin.grantedFreeSpinsByTier[tierKey] ?? 0 : 0;
  const freeSpins = Math.max(
    0,
    Math.min(me.spin.dailyFreeSpinsRemaining, tierAllowance) + grantedFreeForTier,
  );
  const spinDisabled =
    !me.spin.config.enabled || spin.isPending || (freeSpins <= 0 && me.coins < spinCost);

  return (
    <Screen
      header={<StackScreenHeader title="Rewards" />}
      contentClassName="px-4 pt-3 gap-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold600} />
      }
    >
      {/* Coin balance */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />
        <View className="relative flex-row items-center justify-between p-4">
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
              Reward coins
            </Text>
            <Text className="mt-1 text-3xl font-black" style={{ color: colors.gold300 }}>
              {me.coins.toLocaleString()}
            </Text>
            <Text className="mt-0.5 text-[11px] text-white/45">Earn more by checking in and playing daily</Text>
          </View>
          <View className="h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-white/5">
            <Icon name="star" size={26} color={colors.gold300} />
          </View>
        </View>
      </View>

      {/* Daily check-in */}
      <CheckInCard
        dailyCoins={me.checkIn.config.dailyCoins}
        streakBonusDay7={me.checkIn.config.streakBonusDay7}
        streakDay={me.checkIn.streakDay}
        claimedToday={me.checkIn.claimedToday}
        enabled={me.checkIn.config.enabled}
        busy={checkIn.isPending}
        onCheckIn={onCheckIn}
      />

      {/* Spin the wheel */}
      <SpinCard
        enabled={me.spin.config.enabled}
        freeSpins={freeSpins}
        cost={spinCost}
        coins={me.coins}
        busy={spin.isPending}
        disabled={spinDisabled}
        onSpin={onSpin}
      />

      {/* Rewards store */}
      <View className="gap-3">
        <Text className="text-base font-extrabold text-ink">Rewards store</Text>
        {storeQuery.isLoading ? (
          <View className="h-40 rounded-2xl border border-divider bg-surfaceAlt/40" />
        ) : storeQuery.isError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Store unavailable"
            message={
              storeQuery.error instanceof ApiError
                ? storeQuery.error.message
                : 'We could not load the rewards store.'
            }
            actionLabel="Try again"
            onAction={() => storeQuery.refetch()}
          />
        ) : (storeQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon="gift-outline"
            title="No rewards yet"
            message="New redeemable rewards will appear here soon."
          />
        ) : (
          <View className="flex-row flex-wrap justify-between" style={{ rowGap: GAP }}>
            {storeQuery.data!.items.map((item) => {
              const affordable = me.coins >= item.cost;
              return (
                <View
                  key={item.id}
                  style={{ width: tileW }}
                  className="rounded-2xl border border-divider bg-paper p-3.5 shadow-sm shadow-black/5"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
                    <Icon name={rewardIcon(item.rewardType)} size={20} color={colors.gold700} />
                  </View>
                  <Text className="mt-2.5 text-sm font-extrabold text-ink" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <Icon name="star" size={12} color={colors.gold600} />
                    <Text className="text-xs font-bold text-ink-soft">
                      {item.cost.toLocaleString()} coins
                    </Text>
                  </View>
                  <PrimaryButton
                    label={affordable ? 'Redeem' : 'Not enough'}
                    size="sm"
                    fullWidth
                    disabled={!affordable}
                    className="mt-3"
                    onPress={() => setRedeemItem(item)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>

      <RedeemSheet
        item={redeemItem}
        coins={me.coins}
        onClose={() => setRedeemItem(null)}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

function CheckInCard({
  dailyCoins,
  streakBonusDay7,
  streakDay,
  claimedToday,
  enabled,
  busy,
  onCheckIn,
}: {
  dailyCoins: number;
  streakBonusDay7: number;
  streakDay: number;
  claimedToday: boolean;
  enabled: boolean;
  busy: boolean;
  onCheckIn: () => void;
}) {
  // Day within the current 7-day cycle. Before today's claim the "today" cell
  // is the next day; after claiming it is the day just claimed.
  const todayInCycle = claimedToday ? ((streakDay - 1) % 7) + 1 : (streakDay % 7) + 1;
  const days = Array.from({ length: 7 }, (_, i) => i + 1);

  return (
    <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-extrabold text-ink">Daily check-in</Text>
        <Text className="text-[11px] font-bold text-gold-700">Streak: {streakDay} days</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {days.map((day) => {
          const claimed = day < todayInCycle || (day === todayInCycle && claimedToday);
          const today = day === todayInCycle && !claimedToday;
          const reward = day === 7 ? dailyCoins + streakBonusDay7 : dailyCoins;
          return (
            <View
              key={day}
              className={
                'w-16 items-center rounded-xl border py-3 ' +
                (today
                  ? 'border-gold-600 bg-gold-500/15'
                  : claimed
                    ? 'border-divider bg-surface'
                    : 'border-divider bg-paper')
              }
            >
              <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">
                Day {day}
              </Text>
              <View
                className={
                  'my-1.5 h-8 w-8 items-center justify-center rounded-full ' +
                  (claimed ? 'bg-newg/15' : today ? 'bg-gold-500' : 'bg-surfaceAlt')
                }
              >
                <Icon
                  name={claimed ? 'checkmark' : 'star'}
                  size={15}
                  color={claimed ? colors.newg : today ? colors.ink : colors.inkMute}
                />
              </View>
              <Text
                className="text-[11px] font-black"
                style={{ color: today ? colors.gold700 : colors.inkSoft }}
              >
                +{reward}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <PrimaryButton
        label={!enabled ? 'Check-in paused' : claimedToday ? 'Checked in today' : busy ? 'Checking in...' : 'Check in today'}
        icon="calendar"
        fullWidth
        className="mt-3"
        loading={busy}
        disabled={!enabled || claimedToday || busy}
        onPress={onCheckIn}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Spin
// ---------------------------------------------------------------------------

function SpinCard({
  enabled,
  freeSpins,
  cost,
  coins,
  busy,
  disabled,
  onSpin,
}: {
  enabled: boolean;
  freeSpins: number;
  cost: number;
  coins: number;
  busy: boolean;
  disabled: boolean;
  onSpin: () => void;
}) {
  const usesFree = freeSpins > 0;
  const label = !enabled
    ? 'Spin paused'
    : busy
      ? 'Spinning...'
      : usesFree
        ? `Spin free (${freeSpins} left)`
        : `Spin for ${cost} coins`;
  return (
    <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
      <Gradient colors={gradients.hot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
      <View className="absolute -left-6 -bottom-8 h-32 w-32 rounded-full bg-white/10" />
      <View className="relative p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-white/40 bg-white/10">
            <Icon name="disc" size={28} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-black text-white">Daily Spin</Text>
              {usesFree ? <Badge label="FREE" variant="new" /> : null}
            </View>
            <Text className="mt-0.5 text-xs font-medium text-white/85">
              {usesFree
                ? 'Spin the wheel for a free reward'
                : `Each spin costs ${cost} coins. You have ${coins.toLocaleString()}.`}
            </Text>
          </View>
        </View>
        <PrimaryButton
          label={label}
          icon="sync"
          fullWidth
          className="mt-3"
          loading={busy}
          disabled={disabled}
          onPress={onSpin}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Redeem sheet (per-rewardType payload the server requires)
// ---------------------------------------------------------------------------

function RedeemSheet({
  item,
  coins,
  onClose,
}: {
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

    // Client-side validation mirroring the server's zod schemas so the player
    // gets an inline message instead of a round-trip 400.
    let body: RedeemBody;
    if (item.rewardType === 'recharge') {
      if (!/^0?1\d{9}$/.test(phone.trim())) {
        Alert.alert('Check the number', 'Enter a valid Bangladeshi mobile number.');
        return;
      }
      body = { operator, phone: phone.trim() };
    } else if (item.rewardType === 'physical') {
      if (fullName.trim().length < 2 || phone.trim().length < 10 || address.trim().length < 5) {
        Alert.alert('Delivery details', 'Please fill in your name, phone and full address.');
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
          Alert.alert('Reward requested', `${item.title} is being processed. We deducted ${item.cost} coins.`);
          close();
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : 'Could not redeem this reward. Please try again.';
          Alert.alert('Redeem failed', msg);
        },
        onSettled: () => {
          guard.current = false;
        },
      },
    );
  }, [item, operator, phone, fullName, address, notes, redeem, close]);

  const visible = item != null;
  const affordable = item ? coins >= item.cost : false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl border-t border-divider bg-paper px-4 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-black text-ink" numberOfLines={1}>
              {item?.title ?? 'Redeem'}
            </Text>
            <Pressable onPress={close} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt">
              <Icon name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <View className="mb-3 flex-row items-center gap-1.5">
            <Icon name="star" size={14} color={colors.gold600} />
            <Text className="text-sm font-bold text-ink-soft">
              {item?.cost.toLocaleString()} coins
            </Text>
            <Text className="text-xs text-ink-mute">- you have {coins.toLocaleString()}</Text>
          </View>

          {item?.description ? (
            <Text className="mb-3 text-xs text-ink-mute">{item.description}</Text>
          ) : null}

          {item?.rewardType === 'recharge' ? (
            <View className="gap-3">
              <View>
                <Text className="mb-1.5 text-xs font-bold text-ink-soft">Operator</Text>
                <ChipToggle
                  scroll
                  options={OPERATORS.map((o) => ({ key: o.key, label: o.label }))}
                  value={operator}
                  onChange={(k) => setOperator(k as RechargeClaimBody['operator'])}
                />
              </View>
              <TextField
                label="Mobile number"
                value={phone}
                onChangeText={setPhone}
                placeholder="01XXXXXXXXX"
                keyboardType="phone-pad"
              />
            </View>
          ) : item?.rewardType === 'physical' ? (
            <View className="gap-3">
              <TextField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
              <TextField
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="01XXXXXXXXX"
                keyboardType="phone-pad"
              />
              <TextField label="Delivery address" value={address} onChangeText={setAddress} placeholder="House, road, area, district" />
              <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything we should know" />
            </View>
          ) : (
            <Text className="text-xs text-ink-mute">
              Confirm to redeem this reward. {item?.shortInstructionEn ?? ''}
            </Text>
          )}

          <View className="mt-4 flex-row gap-3">
            <GhostButton label="Cancel" className="flex-1" onPress={close} />
            <PrimaryButton
              label={redeem.isPending ? 'Redeeming...' : 'Confirm redeem'}
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
