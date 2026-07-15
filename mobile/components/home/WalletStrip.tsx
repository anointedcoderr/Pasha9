// Built by Anointed Coder.
//
// WalletStrip: the balance / auth strip that sits under the hero, mirroring the
// website WalletStrip (apps/web/components/site/WalletStrip.tsx). It is
// self-driven off the session:
//   - Signed in (useAuth status 'authed'): a compact dark balance card showing
//     the live balance (useBalance) with a refresh control, plus a segmented
//     Deposit / Withdraw / History action group routing to /deposit /withdraw
//     /transactions.
//   - Guest: a dark welcome card with a Register / Login segmented CTA routing
//     into /auth/register and /auth/login.
//   - Loading: a quiet skeleton block.
//
// The card matches the web look: a #0F1115 -> #1A1D24 -> #0F1115 diagonal
// gradient, a bright-gold coin chip, a warm-gold balance (RN cannot clip a
// gradient to text so a solid warm gold approximates the web gradient), and a
// translucent pill-tab action group where the active tab wears the gold
// gradient.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  LogIn,
  ReceiptText,
  RefreshCw,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { Gradient } from '@/components/ui/Gradient';
import { formatBDT } from '@/lib/format';
import { colors, gradients } from '@/lib/theme';
import { useAuth } from '@/store/auth';
import { useBalance } from '@/lib/api/hooks';

interface Action {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

export function WalletStrip() {
  const router = useRouter();
  const { status, user } = useAuth();
  const balanceQuery = useBalance();

  const go = (path: string) => router.push(path as never);

  // Loading: a quiet skeleton while the session bootstraps.
  if (status === 'loading') {
    return (
      <View
        style={{ height: 110, borderRadius: 16 }}
        className="border border-brand-divider bg-brand-surface"
      />
    );
  }

  // Guest: welcome + Register / Login CTA.
  if (status !== 'authed') {
    const items: Action[] = [
      { key: 'register', label: 'Register', icon: UserPlus, path: '/auth/register' },
      { key: 'login', label: 'Login', icon: LogIn, path: '/auth/login' },
    ];
    return (
      <View style={{ borderRadius: 16 }} className="relative overflow-hidden p-5">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="flex-row items-start gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(255,204,0,0.15)' }}
          >
            <Sparkles size={20} color={colors.gold500} strokeWidth={2} />
          </View>
          <View className="flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: colors.gold300 }}>
              Welcome to Pasha 9
            </Text>
            <Text className="mt-1 text-lg font-extrabold leading-tight text-white">
              Register now and claim your bonus
            </Text>
            <Text className="mt-1 text-xs text-white/70">
              Special first deposit bonus waiting for you.
            </Text>
          </View>
        </View>
        <View className="mt-4">
          <SegmentedActions items={items} defaultKey="register" onSelect={(a) => go(a.path)} />
        </View>
      </View>
    );
  }

  // Authed: greeting + live balance + Deposit / Withdraw / History.
  const balance = balanceQuery.data?.balance ?? 0;
  const items: Action[] = [
    { key: 'deposit', label: 'Deposit', icon: ArrowDownToLine, path: '/deposit' },
    { key: 'withdraw', label: 'Withdraw', icon: ArrowUpToLine, path: '/withdraw' },
    { key: 'history', label: 'History', icon: ReceiptText, path: '/transactions' },
  ];

  return (
    <View
      style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,204,0,0.15)' }}
      className="relative overflow-hidden p-4"
    >
      <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />

      <View className="flex-row items-start gap-3">
        {/* Gold coin chip */}
        <View className="relative h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
          <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
          <Sparkles size={20} color={colors.ink} strokeWidth={2} />
        </View>

        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-semibold text-white/70" numberOfLines={1}>
            Hi, <Text className="font-bold text-white">{user?.username ?? 'Player'}</Text>
          </Text>
          <View className="mt-0.5 flex-row items-center gap-2">
            <Text className="text-2xl font-black" style={{ color: '#FFE9A8' }} numberOfLines={1}>
              {formatBDT(balance)}
            </Text>
            <Pressable
              onPress={() => balanceQuery.refetch()}
              hitSlop={8}
              className="h-7 w-7 items-center justify-center rounded-lg active:bg-white/10"
              style={{ opacity: balanceQuery.isFetching ? 0.5 : 1 }}
            >
              <RefreshCw size={14} color="rgba(255,255,255,0.75)" strokeWidth={2} />
            </Pressable>
          </View>
          <Text className="mt-1 text-[10px] font-bold uppercase tracking-[2px] text-white/55">
            Main balance
          </Text>
        </View>
      </View>

      <View className="mt-4">
        <SegmentedActions items={items} defaultKey="deposit" onSelect={(a) => go(a.path)} />
      </View>
    </View>
  );
}

/**
 * A translucent pill-tab action group. The highlighted tab wears the gold
 * gradient with ink text; the rest stay translucent with a gold icon. Tapping a
 * tab lifts the highlight then fires onSelect (which navigates).
 */
function SegmentedActions({
  items,
  defaultKey,
  onSelect,
}: {
  items: Action[];
  defaultKey: string;
  onSelect: (a: Action) => void;
}) {
  const [active, setActive] = useState(defaultKey);
  return (
    <View
      className="flex-row rounded-xl p-1"
      style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)' }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              setActive(item.key);
              onSelect(item);
            }}
            className="relative h-10 flex-1 flex-row items-center justify-center gap-1.5 overflow-hidden rounded-lg active:opacity-90"
          >
            {isActive ? <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} radius={8} /> : null}
            <Icon size={16} color={isActive ? colors.ink : colors.gold400} strokeWidth={2} />
            <Text
              className="text-[12px] font-semibold"
              style={{ color: isActive ? colors.ink : 'rgba(255,255,255,0.85)' }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
