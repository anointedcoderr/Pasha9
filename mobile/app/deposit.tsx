// Built by Anointed Coder.
//
// DEPOSIT screen. A branded payment-method picker (bKash / Nagad / Rocket),
// an amount input with quick-amount chips, an optional promo code field, a
// live summary, and a sticky Continue button. Static, mock only, no real
// payment logic.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, TextField, PrimaryButton } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { mockWallet } from '@/lib/mock';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

interface Method {
  key: string;
  name: string;
  note: string;
  color: string;
  icon: IconName;
}

// Branded mobile-money options. Colours approximate each brand so the cards
// read as recognisable without shipping real logos.
const METHODS: Method[] = [
  { key: 'bkash', name: 'bKash', note: 'Instant', color: '#E2136E', icon: 'phone-portrait' },
  { key: 'nagad', name: 'Nagad', note: 'Instant', color: '#EC1C24', icon: 'wallet' },
  { key: 'rocket', name: 'Rocket', note: '1-3 min', color: '#8C3494', icon: 'rocket' },
];

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

export default function DepositScreen() {
  const [method, setMethod] = useState<string>('bkash');
  const [amount, setAmount] = useState<string>('1000');
  const [promo, setPromo] = useState<string>('');

  const amountNum = Number(amount.replace(/[^0-9]/g, '')) || 0;
  // Mock 100% first-deposit match for the summary line.
  const bonus = Math.round(amountNum);
  const total = amountNum + bonus;
  const selected = METHODS.find((m) => m.key === method);
  const canContinue = amountNum >= 100 && !!method;

  return (
    <Screen
      header={<StackScreenHeader title="Deposit" subtitle="Top up your wallet" />}
      contentClassName="px-4 pt-4 gap-5"
      footer={
        <View className="border-t border-divider bg-paper px-4 pb-7 pt-3">
          <PrimaryButton
            label="Continue"
            icon="arrow-forward"
            fullWidth
            disabled={!canContinue}
            onPress={() => {}}
          />
          <View className="mt-2 flex-row items-center justify-center gap-1.5">
            <Ionicons name="shield-checkmark" size={12} color={colors.inkMute} />
            <Text className="text-[11px] text-ink-mute">Payments are processed securely</Text>
          </View>
        </View>
      }
    >
      {/* Current balance context */}
      <Card className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-gold-500/15">
            <Ionicons name="wallet" size={18} color={colors.gold700} />
          </View>
          <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">
            Current balance
          </Text>
        </View>
        <Text className="text-base font-black text-ink">{formatBDT(mockWallet.balance)}</Text>
      </Card>

      {/* Payment method picker */}
      <View className="gap-2.5">
        <Text className="text-sm font-extrabold text-ink">Payment method</Text>
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
                <Text className="text-[10px] text-ink-mute">{m.note}</Text>
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

      {/* Amount + quick chips */}
      <View className="gap-2.5">
        <TextField
          label="Amount (BDT)"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          icon="cash-outline"
          keyboardType="numeric"
          helper="Minimum deposit BDT 100"
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

      {/* Promo code */}
      <TextField
        label="Promo code (optional)"
        value={promo}
        onChangeText={setPromo}
        placeholder="Enter a bonus code"
        icon="pricetag-outline"
        autoCapitalize="characters"
      />

      {/* Summary */}
      <View className="gap-2.5">
        <Text className="text-sm font-extrabold text-ink">Summary</Text>
        <Card className="gap-2.5">
          <SummaryRow label="Deposit amount" value={formatBDT(amountNum)} />
          <SummaryRow label="Method" value={selected?.name ?? '-'} />
          <SummaryRow label="Bonus (100%)" value={`+ ${formatBDT(bonus)}`} tone="green" />
          <View className="h-px bg-divider" />
          <SummaryRow label="Total credited" value={formatBDT(total)} bold />
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
