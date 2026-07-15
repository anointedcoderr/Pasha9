// Built by Anointed Coder.
//
// WITHDRAW screen, wired to the live backend. The withdrawable balance comes
// from GET /api/bonuses/me minus the locked amounts reported by GET
// /api/withdrawals/eligibility, the turnover gate (isMet + remaining reason)
// also comes from eligibility, real payout methods + global min/max come from
// GET /api/content/payment-methods and /api/content/withdrawal-limits, and
// Submit posts to POST /api/withdrawals via useCreateWithdrawal, landing on a
// pending-approval state. All failures surface the ApiError message inline.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { Screen, Card, TextField, PrimaryButton, Gradient } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import {
  useBonuses,
  usePaymentMethods,
  useWithdrawalEligibility,
  useWithdrawalLimits,
  useCreateWithdrawal,
} from '@/lib/api/hooks';
import { type PaymentMethod } from '@/lib/api/wallet';
import { ApiError } from '@/lib/api/client';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = string;

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

function brandFor(name: string): { color: string; icon: IconName } {
  const n = name.toLowerCase();
  if (n.includes('bkash')) return { color: '#E2136E', icon: 'phone-portrait' };
  if (n.includes('nagad')) return { color: '#EC1C24', icon: 'wallet' };
  if (n.includes('rocket')) return { color: '#8C3494', icon: 'rocket' };
  if (n.includes('upay')) return { color: '#F7941D', icon: 'card' };
  return { color: '#1E73E8', icon: 'card' };
}

export default function WithdrawScreen() {
  const router = useRouter();
  const { data: bonuses } = useBonuses();
  const methodsQuery = usePaymentMethods();
  const eligibilityQuery = useWithdrawalEligibility();
  const limitsQuery = useWithdrawalLimits();
  const createWithdrawal = useCreateWithdrawal();

  const methods = methodsQuery.data?.payout ?? [];
  const eligibility = eligibilityQuery.data;
  const limits = limitsQuery.data;

  const [methodName, setMethodName] = useState<string>('');
  const [account, setAccount] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    if (!methodName && methods.length > 0) setMethodName(methods[0].name);
  }, [methods, methodName]);

  const selected = useMemo<PaymentMethod | undefined>(
    () => methods.find((m) => m.name === methodName),
    [methods, methodName],
  );

  // Withdrawable = balance minus everything the server subtracts before it
  // will accept a withdrawal (locked bonus + reward turnover locks).
  const rawBalance = bonuses?.wallet.balance ?? 0;
  const lockedBonus = bonuses?.wallet.lockedBalance ?? 0;
  const bdtLocked = eligibility?.bdtBalanceLocked ?? 0;
  const refLocked = eligibility?.referralBalanceLocked ?? 0;
  const withdrawable = Math.max(0, rawBalance - lockedBonus - bdtLocked - refLocked);

  // Per-method override wins, else the global limit.
  const effectiveMin = selected?.minWithdrawal != null ? selected.minWithdrawal : limits?.min ?? 500;
  const effectiveMax = selected?.maxWithdrawal != null ? selected.maxWithdrawal : limits?.max ?? 200_000;

  const turnoverBlocked = Boolean(eligibility && !eligibility.isMet);

  const amountNum = Number(amount.replace(/[^0-9]/g, '')) || 0;
  const overBalance = amountNum > withdrawable;
  const belowMin = amountNum > 0 && amountNum < effectiveMin;
  const aboveMax = amountNum > effectiveMax;
  const amountError = overBalance
    ? 'Amount exceeds your withdrawable balance'
    : belowMin
      ? `Minimum withdrawal is ${formatBDT(effectiveMin)}`
      : aboveMax
        ? `Maximum withdrawal is ${formatBDT(effectiveMax)}`
        : undefined;

  const accountTrim = account.trim();
  const accountError =
    accountTrim.length > 0 && accountTrim.length < 6 ? 'Account number looks too short' : undefined;

  const canRequest =
    !!methodName &&
    !turnoverBlocked &&
    amountNum >= effectiveMin &&
    amountNum <= effectiveMax &&
    !overBalance &&
    accountTrim.length >= 6 &&
    !createWithdrawal.isPending;

  // Synchronous double-submit guard. isPending / the disabled prop only flip on
  // the next render, so two taps in the same tick would both fire a real payout
  // request. This ref blocks the second tap immediately.
  const submittingRef = useRef(false);

  async function submit() {
    if (!canRequest || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    try {
      const withdrawal = await createWithdrawal.mutateAsync({
        amount: amountNum,
        method: methodName,
        accountNumber: accountTrim,
      });
      setSubmittedId(withdrawal.id);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not submit withdrawal. Please try again.',
      );
      // A turnover / balance rejection means the gate numbers moved; refresh.
      eligibilityQuery.refetch();
    } finally {
      submittingRef.current = false;
    }
  }

  function newRequest() {
    setSubmittedId(null);
    setSubmitError(null);
    setAmount('');
    setAccount('');
  }

  // ---- Success (pending approval) state -----------------------------------
  if (submittedId) {
    return (
      <Screen
        header={<StackScreenHeader title="Withdraw" subtitle="Request a payout" />}
        contentClassName="px-4 pt-6 gap-5"
      >
        <Card className="items-center gap-3 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-newg/15">
            <Icon name="checkmark-circle" size={38} color={colors.newg} />
          </View>
          <Text className="text-center text-lg font-black text-ink">Withdrawal request submitted</Text>
          <Text className="max-w-[300px] text-center text-sm text-ink-mute">
            Your payout is pending review. The amount is deducted from your balance once it is approved.
          </Text>
          <View className="mt-1 rounded-lg bg-surfaceAlt px-3 py-1.5">
            <Text className="text-[11px] text-ink-mute">
              Reference: <Text className="font-bold text-ink-soft">{submittedId}</Text>
            </Text>
          </View>
          <View className="mt-2 w-full gap-2">
            <PrimaryButton label="New request" icon="add" fullWidth onPress={newRequest} />
            <Pressable
              onPress={() => router.push('/transactions')}
              className="h-11 items-center justify-center rounded-pill border border-divider bg-paper active:bg-surfaceAlt"
            >
              <Text className="text-sm font-bold text-ink-soft">View transactions</Text>
            </Pressable>
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={<StackScreenHeader title="Withdraw" subtitle="Request a payout" />}
      contentClassName="px-4 pt-4 gap-5"
      footer={
        <View className="border-t border-divider bg-paper px-4 pb-7 pt-3">
          {submitError ? (
            <View className="mb-2 flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2">
              <Icon name="alert-circle" size={16} color={colors.hot} />
              <Text className="flex-1 text-xs font-medium text-hot">{submitError}</Text>
            </View>
          ) : null}
          <PrimaryButton
            label={createWithdrawal.isPending ? 'Submitting...' : 'Request withdrawal'}
            icon="arrow-up-circle"
            fullWidth
            disabled={!canRequest}
            loading={createWithdrawal.isPending}
            onPress={submit}
          />
          <View className="mt-2 flex-row items-center justify-center gap-1.5">
            <Icon name="time-outline" size={12} color={colors.inkMute} />
            <Text className="text-[11px] text-ink-mute">Payouts are reviewed before they clear</Text>
          </View>
        </View>
      }
    >
      {/* Withdrawable balance island */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-neon/10" />
        <View className="relative flex-row items-center justify-between p-5">
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-widest text-white/60">
              Withdrawable balance
            </Text>
            <Text className="mt-1.5 text-3xl font-black" style={{ color: colors.gold300 }}>
              {formatBDT(withdrawable)}
            </Text>
            {lockedBonus + bdtLocked + refLocked > 0 ? (
              <Text className="mt-1 text-[11px] text-white/45">
                {formatBDT(lockedBonus + bdtLocked + refLocked)} locked by active turnover
              </Text>
            ) : null}
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Icon name="cash-outline" size={22} color={colors.neon} />
          </View>
        </View>
      </View>

      {/* Turnover gate warning */}
      {turnoverBlocked && eligibility ? (
        <View className="gap-2 rounded-2xl border-l-4 border-hot bg-hot/10 p-4">
          <View className="flex-row items-center gap-2">
            <Icon name="alert-circle" size={18} color={colors.hot} />
            <Text className="flex-1 text-sm font-bold text-ink">Turnover not complete yet</Text>
          </View>
          <Text className="text-xs text-ink-soft">
            Complete {formatBDT(eligibility.remainingTurnover)} more turnover before you can request a
            withdrawal.
          </Text>
          <View className="mt-1 flex-row gap-2">
            <GateStat label="Required" value={eligibility.requiredTurnover} />
            <GateStat label="Completed" value={eligibility.completedTurnover} />
            <GateStat label="Remaining" value={eligibility.remainingTurnover} />
          </View>
        </View>
      ) : null}

      {/* Method picker */}
      <View className="gap-2.5">
        <Text className="text-sm font-extrabold text-ink">Withdraw to</Text>
        {methodsQuery.isLoading ? (
          <View className="flex-row gap-2.5">
            {[0, 1, 2].map((i) => (
              <View key={i} className="h-24 flex-1 rounded-2xl border border-divider bg-surfaceAlt" />
            ))}
          </View>
        ) : methodsQuery.isError ? (
          <Card className="flex-row items-center gap-2">
            <Icon name="cloud-offline" size={18} color={colors.hot} />
            <Text className="flex-1 text-sm text-ink-soft">Could not load payout methods.</Text>
            <Pressable onPress={() => methodsQuery.refetch()} hitSlop={8}>
              <Text className="text-sm font-bold text-gold-700">Retry</Text>
            </Pressable>
          </Card>
        ) : methods.length === 0 ? (
          <Card>
            <Text className="text-sm text-ink-soft">No payout channels are available right now.</Text>
          </Card>
        ) : (
          <View className="flex-row flex-wrap gap-2.5">
            {methods.map((m) => {
              const active = m.name === methodName;
              const brand = brandFor(m.name);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMethodName(m.name)}
                  style={{ width: '31.5%' }}
                  className={cn(
                    'relative items-center gap-2 rounded-2xl border p-3 active:opacity-90',
                    active ? 'border-gold-600 bg-gold-500/10' : 'border-divider bg-paper',
                  )}
                >
                  <View
                    className="h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: brand.color }}
                  >
                    <Icon name={brand.icon} size={20} color="#FFFFFF" />
                  </View>
                  <Text className="text-center text-xs font-extrabold text-ink" numberOfLines={1}>
                    {m.name}
                  </Text>
                  {active ? (
                    <View className="absolute right-2 top-2 h-4 w-4 items-center justify-center rounded-full bg-gold-500">
                      <Icon name="checkmark" size={11} color={colors.ink} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Account number */}
      <TextField
        label="Account number"
        value={account}
        onChangeText={setAccount}
        placeholder="01XXXXXXXXX"
        icon="call-outline"
        keyboardType="numeric"
        error={accountError}
        helper="The account number registered with the selected method"
      />

      {/* Amount + quick chips */}
      <View className="gap-2.5">
        <TextField
          label="Amount (BDT)"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          icon="cash-outline"
          keyboardType="numeric"
          error={amountError}
          helper={`Min ${formatBDT(effectiveMin)}  •  Max ${formatBDT(Math.min(effectiveMax, withdrawable || effectiveMax))}`}
        />
        <View className="flex-row flex-wrap gap-2">
          {QUICK_AMOUNTS.map((v) => {
            const disabled = v > withdrawable || v > effectiveMax || v < effectiveMin;
            const active = amountNum === v;
            return (
              <Pressable
                key={v}
                onPress={() => !disabled && setAmount(String(v))}
                disabled={disabled}
                className={cn(
                  'rounded-pill border px-3.5 py-2 active:opacity-80',
                  active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
                  disabled && 'opacity-40',
                )}
              >
                <Text className={cn('text-xs font-bold', active ? 'text-ink' : 'text-ink-soft')}>
                  {formatBDT(v, false)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              const max = Math.min(withdrawable, effectiveMax);
              if (max >= effectiveMin) setAmount(String(Math.floor(max)));
            }}
            className={cn(
              'rounded-pill border px-3.5 py-2 active:opacity-80',
              amountNum > 0 && amountNum === Math.floor(Math.min(withdrawable, effectiveMax))
                ? 'border-gold-600 bg-gold-500'
                : 'border-divider bg-paper',
            )}
          >
            <Text
              className={cn(
                'text-xs font-bold',
                amountNum > 0 && amountNum === Math.floor(Math.min(withdrawable, effectiveMax))
                  ? 'text-ink'
                  : 'text-ink-soft',
              )}
            >
              Max
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Summary */}
      <View className="gap-2.5">
        <Text className="text-sm font-extrabold text-ink">Summary</Text>
        <Card className="gap-2.5">
          <SummaryRow label="Withdrawal amount" value={formatBDT(amountNum)} />
          <SummaryRow label="Method" value={methodName || '-'} />
          <SummaryRow label="Processing fee" value="Free" tone="green" />
          <View className="h-px bg-divider" />
          <SummaryRow label="You receive" value={formatBDT(amountNum)} bold />
        </Card>
      </View>
    </Screen>
  );
}

function GateStat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 rounded-lg bg-paper px-2 py-1.5">
      <Text className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">{label}</Text>
      <Text className="text-xs font-black text-ink" numberOfLines={1}>
        {formatBDT(value, false)}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'green';
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={cn('text-sm', bold ? 'font-extrabold text-ink' : 'text-ink-mute')}>{label}</Text>
      <Text
        className={cn('text-sm font-black', bold ? 'text-ink' : 'text-ink-soft')}
        style={tone === 'green' ? { color: colors.newg } : undefined}
      >
        {value}
      </Text>
    </View>
  );
}
