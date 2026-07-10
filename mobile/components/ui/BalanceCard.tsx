// Built by Anointed Coder.
//
// BalanceCard: the dark premium wallet island. Shows a greeting, the main
// balance in BDT, a spin-wheel shortcut dot, and a Deposit / Withdraw /
// History action group. Mirrors the web WalletStrip for logged-in players.
//
// Props:
//   username    string     player handle (required)
//   balance     number     main balance in BDT (required)
//   bonus       number     optional bonus balance shown as a sub-line
//   onDeposit / onWithdraw / onHistory / onSpin  () => void handlers
//   className   string

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gradient } from './Gradient';
import { gradients, colors } from '@/lib/theme';
import { formatBDT } from '@/lib/format';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

export interface BalanceCardProps {
  username: string;
  balance: number;
  bonus?: number;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onHistory?: () => void;
  onSpin?: () => void;
  className?: string;
}

export function BalanceCard({
  username,
  balance,
  bonus,
  onDeposit,
  onWithdraw,
  onHistory,
  onSpin,
  className,
}: BalanceCardProps) {
  return (
    <View className={cn('relative overflow-hidden rounded-2xl border border-gold-600/20', className)}>
      <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />

      {/* Decorative gold glow */}
      <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20" />
      <View className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-blue-500/15" />

      <View className="relative p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-start gap-3 flex-1">
            <View className="relative h-11 w-11 items-center justify-center overflow-hidden rounded-2xl">
              <Gradient colors={gradients.gold} radius={16} />
              <Ionicons name="sparkles" size={20} color={colors.ink} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-white/70">
                Hi, <Text className="font-bold text-white">{username}</Text>
              </Text>
              <Text className="mt-0.5 text-3xl font-black" style={{ color: colors.gold300 }}>
                {formatBDT(balance)}
              </Text>
              <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                Main balance
                {typeof bonus === 'number' ? `  -  Bonus ${formatBDT(bonus, false)}` : ''}
              </Text>
            </View>
          </View>

          {/* Spin-wheel shortcut dot */}
          <Pressable
            onPress={onSpin}
            className="relative h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-gold-500/40 active:opacity-80"
          >
            <View className="absolute inset-0 bg-white/5" />
            <Ionicons name="disc" size={22} color={colors.gold300} />
          </Pressable>
        </View>

        {/* Actions */}
        <View className="mt-4 flex-row items-stretch gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
          <BalanceAction icon="arrow-down" label="Deposit" active onPress={onDeposit} />
          <BalanceAction icon="arrow-up" label="Withdraw" onPress={onWithdraw} />
          <BalanceAction icon="receipt-outline" label="History" onPress={onHistory} />
        </View>
      </View>
    </View>
  );
}

function BalanceAction({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="relative flex-1 flex-row items-center justify-center gap-1.5 overflow-hidden rounded-lg py-2.5 active:opacity-90"
    >
      {active ? <Gradient colors={gradients.gold} radius={8} /> : null}
      <Ionicons name={icon} size={15} color={active ? colors.ink : colors.gold300} />
      <Text className={cn('text-xs font-bold', active ? 'text-ink' : 'text-white/85')}>{label}</Text>
    </Pressable>
  );
}
