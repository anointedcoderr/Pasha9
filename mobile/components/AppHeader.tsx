// Built by Anointed Coder.
//
// AppHeader: the shared top bar reused across screens. Left: hamburger +
// gold "Pasha9" wordmark. Right: BN/EN language pill (visual only), a
// notifications bell with an unread dot, a wallet chip, and a profile
// avatar. Meant to be passed to <Screen header={<AppHeader />}> so it sits
// just below the safe-area inset.
//
// Props (all optional, sensible defaults):
//   username         string    profile label / fallback avatar initial
//   balance          number    wallet chip amount in BDT
//   avatarUrl        string    profile image
//   hasNotification  boolean   force the bell dot; when omitted it tracks the
//                              live unread notification count
//   showWallet       boolean   render the wallet chip (default true)
//   onMenu / onBell / onWallet / onProfile  () => void  overrides; when
//     omitted the bell routes to /notifications and wallet/profile taps route
//     to /wallet and /profile.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useBalance } from '@/lib/api/hooks';
import { useNotifications } from '@/lib/api/account';

export interface AppHeaderProps {
  username?: string;
  balance?: number;
  avatarUrl?: string;
  hasNotification?: boolean;
  showWallet?: boolean;
  onMenu?: () => void;
  onBell?: () => void;
  onWallet?: () => void;
  onProfile?: () => void;
  className?: string;
}

export function AppHeader({
  username,
  balance,
  avatarUrl,
  hasNotification,
  showWallet = true,
  onMenu,
  onBell,
  onWallet,
  onProfile,
  className,
}: AppHeaderProps) {
  const router = useRouter();
  const [lang, setLang] = useState<'EN' | 'BN'>('EN');

  // Live session + wallet + notifications. Props still win when explicitly passed.
  const { user } = useAuth();
  const { data: wallet } = useBalance();
  const { data: notifications } = useNotifications();
  const shownUsername = username ?? user?.username ?? 'Player';
  const shownBalance = balance ?? wallet?.balance ?? 0;
  const shownAvatar = avatarUrl ?? user?.avatarUrl ?? undefined;
  // The dot follows the live unread count unless a caller forces it via the prop.
  const showDot = hasNotification ?? (notifications?.unreadCount ?? 0) > 0;

  return (
    <View
      className={cn(
        'flex-row items-center justify-between border-b border-divider bg-paper px-3 py-2.5',
        className,
      )}
    >
      {/* Left: hamburger + wordmark */}
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onMenu}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
        >
          <Ionicons name="menu" size={24} color={colors.ink} />
        </Pressable>
        <View className="flex-row items-center gap-1.5">
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-gold-500">
            <Ionicons name="diamond" size={15} color={colors.ink} />
          </View>
          <Text className="text-lg font-black tracking-tight text-ink">
            Pasha<Text style={{ color: colors.gold600 }}>9</Text>
          </Text>
        </View>
      </View>

      {/* Right cluster */}
      <View className="flex-row items-center gap-1.5">
        {/* Language pill (visual only) */}
        <Pressable
          onPress={() => setLang((l) => (l === 'EN' ? 'BN' : 'EN'))}
          className="flex-row items-center gap-1 rounded-pill border border-divider bg-surface px-2 py-1.5 active:opacity-80"
        >
          <Ionicons name="globe-outline" size={13} color={colors.inkSoft} />
          <Text className="text-[11px] font-bold text-ink-soft">{lang}</Text>
        </Pressable>

        {/* Notifications bell */}
        <Pressable
          onPress={onBell ?? (() => router.push('/notifications'))}
          hitSlop={6}
          className="relative h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.ink} />
          {showDot ? (
            <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-paper bg-hot" />
          ) : null}
        </Pressable>

        {/* Wallet chip */}
        {showWallet ? (
          <Pressable
            onPress={onWallet ?? (() => router.push('/wallet'))}
            className="flex-row items-center gap-1 rounded-pill border border-gold-600/30 bg-gold-500/15 py-1.5 pl-2 pr-1.5 active:opacity-80"
          >
            <Ionicons name="wallet" size={14} color={colors.gold700} />
            <Text className="text-[11px] font-black text-ink" numberOfLines={1}>
              {formatBDT(shownBalance)}
            </Text>
            <View className="h-5 w-5 items-center justify-center rounded-full bg-gold-500">
              <Ionicons name="add" size={14} color={colors.ink} />
            </View>
          </Pressable>
        ) : null}

        {/* Profile avatar */}
        <Pressable
          onPress={onProfile ?? (() => router.push('/profile'))}
          className="h-9 w-9 overflow-hidden rounded-full border border-divider bg-surfaceAlt active:opacity-80"
        >
          {shownAvatar ? (
            <Image source={{ uri: shownAvatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-xs font-black text-ink-soft">
                {shownUsername.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
