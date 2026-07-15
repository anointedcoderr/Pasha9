// Built by Anointed Coder.
//
// DEPOSIT screen, wired to the live backend. Real payment methods come from
// GET /api/content/payment-methods, the amount is validated against the
// 100 - 500,000 BDT range (and any per-method min/max), a required Transaction
// ID and an optional payment-screenshot (expo-image-picker -> POST
// /api/deposits/proof) accompany the request, a live bonus preview reads GET
// /api/content/deposit-preview, and Submit posts to POST /api/deposits via
// useCreateDeposit, landing on a pending-approval success state. All failures
// surface the ApiError message inline.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Card, TextField, PrimaryButton } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import {
  useBonuses,
  useDepositPreview,
  usePaymentMethods,
  useCreateDeposit,
} from '@/lib/api/hooks';
import { uploadDepositProof, type PaymentMethod } from '@/lib/api/wallet';
import { ApiError } from '@/lib/api/client';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = string;

const MIN_DEPOSIT = 100;
const MAX_DEPOSIT = 500_000;
const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

// Approximate each brand so a real (logo-less) method still reads as
// recognisable. Falls back to a neutral blue card for unknown methods.
function brandFor(name: string): { color: string; icon: IconName } {
  const n = name.toLowerCase();
  if (n.includes('bkash')) return { color: '#E2136E', icon: 'phone-portrait' };
  if (n.includes('nagad')) return { color: '#EC1C24', icon: 'wallet' };
  if (n.includes('rocket')) return { color: '#8C3494', icon: 'rocket' };
  if (n.includes('upay')) return { color: '#F7941D', icon: 'card' };
  return { color: '#1E73E8', icon: 'card' };
}

export default function DepositScreen() {
  const router = useRouter();
  const { data: bonuses } = useBonuses();
  const methodsQuery = usePaymentMethods();
  const createDeposit = useCreateDeposit();

  const methods = methodsQuery.data?.deposit ?? [];

  const [methodName, setMethodName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Default to the first real method once they load.
  useEffect(() => {
    if (!methodName && methods.length > 0) setMethodName(methods[0].name);
  }, [methods, methodName]);

  const selected = useMemo<PaymentMethod | undefined>(
    () => methods.find((m) => m.name === methodName),
    [methods, methodName],
  );

  const amountNum = Number(amount.replace(/[^0-9]/g, '')) || 0;
  const effectiveMin = Math.max(MIN_DEPOSIT, selected?.minDeposit ?? 0);
  const effectiveMax = selected?.maxDeposit != null ? Math.min(MAX_DEPOSIT, selected.maxDeposit) : MAX_DEPOSIT;

  const amountError =
    amountNum > 0 && amountNum < effectiveMin
      ? `Minimum deposit is ${formatBDT(effectiveMin)}`
      : amountNum > effectiveMax
        ? `Maximum deposit is ${formatBDT(effectiveMax)}`
        : undefined;

  const trxTrim = transactionId.trim();
  const trxError = trxTrim.length > 0 && trxTrim.length < 6 ? 'Transaction ID looks too short' : undefined;

  // Debounced amount drives the live bonus preview so we do not fire a request
  // on every keystroke.
  const [previewAmount, setPreviewAmount] = useState(0);
  useEffect(() => {
    const inRange = amountNum >= effectiveMin && amountNum <= effectiveMax;
    const t = setTimeout(() => setPreviewAmount(inRange ? amountNum : 0), 300);
    return () => clearTimeout(t);
  }, [amountNum, effectiveMin, effectiveMax]);
  const { data: preview } = useDepositPreview(previewAmount);
  const bonusAmount = previewAmount > 0 ? preview?.bonusAmount ?? 0 : 0;
  const totalCredit = previewAmount > 0 ? preview?.totalCredit ?? amountNum : amountNum;

  const currentBalance = bonuses?.wallet.balance ?? 0;

  const canSubmit =
    !!methodName &&
    amountNum >= effectiveMin &&
    amountNum <= effectiveMax &&
    trxTrim.length >= 6 &&
    !uploading &&
    !createDeposit.isPending;

  async function pickProof() {
    setUploadError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setUploadError('Photo permission is needed to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setUploading(true);
    setProofName(asset.fileName ?? 'screenshot.jpg');
    try {
      const { proofUrl: url } = await uploadDepositProof({
        uri: asset.uri,
        name: asset.fileName ?? 'screenshot.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setProofUrl(url);
    } catch (err) {
      setProofUrl(null);
      setProofName(null);
      setUploadError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function clearProof() {
    setProofUrl(null);
    setProofName(null);
    setUploadError(null);
  }

  // Synchronous double-submit guard. isPending / the disabled prop only flip on
  // the next render, so two taps in the same tick would both create a deposit
  // request (transactionId is not unique server-side). This ref blocks it.
  const submittingRef = useRef(false);

  async function submit() {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    try {
      const deposit = await createDeposit.mutateAsync({
        amount: amountNum,
        method: methodName,
        transactionId: trxTrim,
        proofUrl: proofUrl ?? undefined,
      });
      setSubmittedId(deposit.id);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not submit deposit. Please try again.');
    } finally {
      submittingRef.current = false;
    }
  }

  function newRequest() {
    setSubmittedId(null);
    setSubmitError(null);
    setAmount('');
    setTransactionId('');
    clearProof();
  }

  // ---- Success (pending approval) state -----------------------------------
  if (submittedId) {
    return (
      <Screen
        header={<StackScreenHeader title="Deposit" subtitle="Top up your wallet" />}
        contentClassName="px-4 pt-6 gap-5"
      >
        <Card className="items-center gap-3 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-newg/15">
            <Icon name="checkmark-circle" size={38} color={colors.newg} />
          </View>
          <Text className="text-center text-lg font-black text-ink">Deposit request submitted</Text>
          <Text className="max-w-[300px] text-center text-sm text-ink-mute">
            Your request is pending review. Your main balance and any bonus are credited after approval.
          </Text>
          <View className="mt-1 rounded-lg bg-surfaceAlt px-3 py-1.5">
            <Text className="text-[11px] text-ink-mute">
              Reference: <Text className="font-bold text-ink-soft">{submittedId}</Text>
            </Text>
          </View>
          <View className="mt-2 w-full gap-2">
            <PrimaryButton label="New deposit" icon="add" fullWidth onPress={newRequest} />
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
      header={<StackScreenHeader title="Deposit" subtitle="Top up your wallet" />}
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
            label={createDeposit.isPending ? 'Submitting...' : 'Submit deposit'}
            icon="arrow-forward"
            fullWidth
            disabled={!canSubmit}
            loading={createDeposit.isPending}
            onPress={submit}
          />
          <View className="mt-2 flex-row items-center justify-center gap-1.5">
            <Icon name="shield-checkmark" size={12} color={colors.inkMute} />
            <Text className="text-[11px] text-ink-mute">Requests are reviewed before crediting</Text>
          </View>
        </View>
      }
    >
      {/* Current balance context */}
      <Card className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-gold-500/15">
            <Icon name="wallet" size={18} color={colors.gold700} />
          </View>
          <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Current balance</Text>
        </View>
        <Text className="text-base font-black text-ink">{formatBDT(currentBalance)}</Text>
      </Card>

      {/* Payment method picker */}
      <View className="gap-2.5">
        <Text className="text-sm font-extrabold text-ink">Payment method</Text>
        {methodsQuery.isLoading ? (
          <View className="flex-row gap-2.5">
            {[0, 1, 2].map((i) => (
              <View key={i} className="h-28 flex-1 rounded-2xl border border-divider bg-surfaceAlt" />
            ))}
          </View>
        ) : methodsQuery.isError ? (
          <Card className="flex-row items-center gap-2">
            <Icon name="cloud-offline" size={18} color={colors.hot} />
            <Text className="flex-1 text-sm text-ink-soft">Could not load payment methods.</Text>
            <Pressable onPress={() => methodsQuery.refetch()} hitSlop={8}>
              <Text className="text-sm font-bold text-gold-700">Retry</Text>
            </Pressable>
          </Card>
        ) : methods.length === 0 ? (
          <Card>
            <Text className="text-sm text-ink-soft">
              No deposit methods are available right now. Please check back shortly or contact support.
            </Text>
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
        {/* Operator payment instructions for the selected manual method */}
        {selected?.number || selected?.instruction ? (
          <Card className="gap-1.5">
            {selected.number ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">
                  {selected.name} number
                </Text>
                <Text className="text-sm font-black text-ink">{selected.number}</Text>
              </View>
            ) : null}
            {selected.instruction ? (
              <Text className="text-[12px] leading-5 text-ink-soft">{selected.instruction}</Text>
            ) : null}
          </Card>
        ) : null}
      </View>

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
          helper={`Min ${formatBDT(effectiveMin)}  •  Max ${formatBDT(effectiveMax)}`}
        />
        <View className="flex-row flex-wrap gap-2">
          {QUICK_AMOUNTS.map((v) => {
            const active = amountNum === v;
            return (
              <Pressable
                key={v}
                onPress={() => setAmount(String(v))}
                className={cn(
                  'rounded-pill border px-3.5 py-2 active:opacity-80',
                  active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
                )}
              >
                <Text className={cn('text-xs font-bold', active ? 'text-ink' : 'text-ink-soft')}>
                  +{formatBDT(v, false)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Transaction ID (required) */}
      <TextField
        label="Transaction ID"
        value={transactionId}
        onChangeText={setTransactionId}
        placeholder="e.g. TRX8A21K9"
        icon="receipt-outline"
        autoCapitalize="characters"
        error={trxError}
        helper="The transaction ID from your payment app"
      />

      {/* Optional payment-screenshot proof */}
      <View className="gap-2">
        <Text className="text-xs font-bold text-ink-soft">Payment screenshot (optional)</Text>
        {proofUrl ? (
          <View className="flex-row items-center gap-2 rounded-xl border border-newg/30 bg-newg/10 px-3 py-3">
            <Icon name="checkmark-circle" size={18} color={colors.newg} />
            <Text className="flex-1 text-sm font-medium text-ink-soft" numberOfLines={1}>
              {proofName ?? 'Screenshot attached'}
            </Text>
            <Pressable onPress={clearProof} hitSlop={8}>
              <Icon name="close-circle" size={18} color={colors.inkMute} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickProof}
            disabled={uploading}
            className={cn(
              'h-12 flex-row items-center gap-2 rounded-xl border border-dashed border-divider bg-paper px-3 active:bg-surfaceAlt',
              uploading && 'opacity-70',
            )}
          >
            {uploading ? (
              <ActivityIndicator color={colors.inkMute} size="small" />
            ) : (
              <Icon name="cloud-upload-outline" size={18} color={colors.inkMute} />
            )}
            <Text className="text-sm text-ink-mute">
              {uploading ? 'Uploading...' : 'Attach a screenshot (PNG, JPG, WEBP)'}
            </Text>
          </Pressable>
        )}
        {uploadError ? <Text className="text-[11px] font-medium text-hot">{uploadError}</Text> : null}
      </View>

      {/* Summary */}
      <View className="gap-2.5">
        <Text className="text-sm font-extrabold text-ink">Summary</Text>
        <Card className="gap-2.5">
          <SummaryRow label="Deposit amount" value={formatBDT(amountNum)} />
          <SummaryRow label="Method" value={methodName || '-'} />
          {bonusAmount > 0 ? (
            <SummaryRow
              label={preview?.promotionName ? `Bonus (${preview.promotionName})` : 'Bonus'}
              value={`+ ${formatBDT(bonusAmount)}`}
              tone="green"
            />
          ) : null}
          <View className="h-px bg-divider" />
          <SummaryRow label="Total credited" value={formatBDT(totalCredit)} bold />
        </Card>
      </View>
    </Screen>
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
