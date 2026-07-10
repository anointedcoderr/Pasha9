// Built by Anointed Coder.
//
// WITHDRAW screen. Shows the withdrawable balance, a branded method picker,
// an account-number field, an amount input with min/max hints and quick
// chips, a payout summary, and a sticky Request Withdrawal button. Static,
// mock only, no real payout logic.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, TextField, PrimaryButton, Gradient } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { mockWallet } from '@/lib/mock';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

interface Method {
  key: string;
  name: string;
  color: string;
  icon: IconName;
}

const METHODS: Method[] = [
  { key: 'bkash', name: 'bKash', color: '#E2136E', icon: 'phone-portrait' },
  { key: 'nagad', name: 'Nagad', color: '#EC1C24', icon: 'wallet' },
  { key: 'rocket', name: 'Rocket', color: '#8C3494', icon: 'rocket' },
];

const MIN_WITHDRAW = 500;
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export default function WithdrawScreen() {
  const withdrawable = mockWallet.balance;
  const [method, setMethod] = useState<string>('bkash');
  const [account, setAccount] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  const amountNum = Number(amount.replace(/[^0-9]/g, '')) || 0;
  const overBalance = amountNum > withdrawable;
  const belowMin = amountNum > 0 && amountNum < MIN_WITHDRAW;
  const amountError = overBalance
    ? 'Amount exceeds your balance'
    : belowMin
      ? `Minimum withdrawal is ${formatBDT(MIN_WITHDRAW)}`
      : undefined;
  const receive = amountNum; // No fee in this mock.
  const canRequest = amountNum >= MIN_WITHDRAW && !overBalance && !!method && account.length >= 6;

  return (
    <Screen
      header={<StackScreenHeader title="Withdraw" subtitle="Request a payout" />}
      contentClassName="px-4 pt-4 gap-5"
      footer={
        <View className="border-t border-divider bg-paper px-4 pb-7 pt-3">
          <PrimaryButton
            label="Request Withdrawal"
            icon="arrow-up-circle"
            fullWidth
            disabled={!canRequest}
            onPress={() => {}}
          />
          <View className="mt-2 flex-row items-center justify-center gap-1.5">
            <Ionicons name="time-outline" size={12} color={colors.inkMute} />
            <Text className="text-[11px] text-ink-mute">Payouts usually clear within 30 minutes</Text>
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
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Ionicons name="cash-outline" size={22} color={colors.neon} />
          </View>
        </View>
      </View>

      {/* Method picker */}
      <View className="gap-2.5">
        <Text className="text-sm font-extrabold text-ink">Withdraw to</Text>
        <View className="flex-row gap-2.5">
          {METHODS.map((m) => {
            const active = m.key === method;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMethod(m.key)}
                className={cn(
                  'relative flex-1 items-center gap-2 rounded-2xl border p-3 active:opacity-90',
                  active ? 'border-gold-600 bg-gold-500/10' : 'border-divider bg-paper',
                )}
              >
                <View
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: m.color }}
                >
                  <Ionicons name={m.icon} size={20} color="#FFFFFF" />
                </View>
                <Text className="text-sm font-extrabold text-ink">{m.name}</Text>
                {active ? (
                  <View className="absolute right-2 top-2 h-4 w-4 items-center justify-center rounded-full bg-gold-500">
                    <Ionicons name="checkmark" size={11} color={colors.ink} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Account number */}
      <TextField
        label="Account number"
        value={account}
        onChangeText={setAccount}
        placeholder="01XXXXXXXXX"
        icon="call-outline"
        keyboardType="numeric"
        helper="The mobile number registered with your wallet"
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
          helper={`Min ${formatBDT(MIN_WITHDRAW)}  •  Max ${formatBDT(withdrawable)}`}
        />
        <View className="flex-row flex-wrap gap-2">
          {QUICK_AMOUNTS.map((v) => {
            const disabled = v > withdrawable;
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
            onPress={() => setAmount(String(withdrawable))}
            className={cn(
              'rounded-pill border px-3.5 py-2 active:opacity-80',
              amountNum === withdrawable ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
            )}
          >
            <Text
              className={cn(
                'text-xs font-bold',
                amountNum === withdrawable ? 'text-ink' : 'text-ink-soft',
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
          <SummaryRow label="Processing fee" value="Free" tone="green" />
          <View className="h-px bg-divider" />
          <SummaryRow label="You receive" value={formatBDT(receive)} bold />
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
      <Text className={cn('text-sm', bold ? 'font-extrabold text-ink' : 'text-ink-mute')}>
        {label}
      </Text>
      <Text
        className={cn('text-sm font-black', bold ? 'text-ink' : 'text-ink-soft')}
        style={tone === 'green' ? { color: colors.newg } : undefined}
      >
        {value}
      </Text>
    </View>
  );
}
