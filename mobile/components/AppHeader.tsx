// Built by Anointed Coder.
//
// AppHeader: the shared top bar, aligned to the Pasha9 website Header
// (apps/web/components/site/Header.tsx) mobile chrome. Left: hamburger in a
// bordered rounded-xl tile + the brand logo mark (gold gradient hexagon-9 tile
// + "Pasha9" wordmark, mirroring the web Logo). Right cluster: an EN/BN
// language pill, a notifications bell with a live unread badge, a wallet pill
// with the live balance, and a profile avatar. lucide-react-native icons match
// the web (Menu, Globe, Bell, Wallet, Plus, User); brand tokens + fonts match
// the light web theme.
//
// Props (all optional, sensible defaults) so existing callers keep working:
//   username         string    profile label / fallback avatar initial
//   balance          number    wallet chip amount in BDT
//   avatarUrl        string    profile image
//   hasNotification  boolean   force the bell badge; when omitted it tracks the
//                              live unread notification count
//   showWallet       boolean   render the wallet chip (default true)
//   onMenu / onBell / onWallet / onProfile  () => void  overrides; when
//     omitted the bell routes to /notifications and wallet/profile taps route
//     to /wallet and /profile.

import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { Bell, Globe, Menu, Plus, Wallet } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { Gradient } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useBalance } from '@/lib/api/hooks';
import { useNotifications } from '@/lib/api/account';
import { useAppLang } from '@/lib/lang';

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

// Brand logo mark: a gold gradient tile carrying the web hexagon-"9" glyph
// (mirrors the fallback tile in apps/web/components/site/Logo.tsx), then the
// "Pasha9" wordmark with a gold "9". Uses react-native-svg for the hexagon.
function LogoMark() {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="relative h-8 w-8 items-center justify-center overflow-hidden rounded-xl">
        <Gradient
          colors={['#FFE066', '#FFCC00', '#F5B400', '#A87200']}
          locations={[0, 0.45, 0.75, 1]}
          radius={12}
        />
        <Svg viewBox="0 0 32 32" width={20} height={20} fill="none">
          <Defs>
            <SvgLinearGradient id="pashaHex" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1a1d24" />
              <Stop offset="1" stopColor="#0F1115" />
            </SvgLinearGradient>
          </Defs>
          <Path
            d="M16 3 L27 9 L27 22 L16 29 L5 22 L5 9 Z"
            fill="url(#pashaHex)"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.6}
          />
          <Path
            d="M14 10 v12 M14 10 q5 0 5 4 q0 4 -5 4 h-0"
            stroke="#FFCC00"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx={22} cy={11} r={1.2} fill="#FFE066" />
        </Svg>
      </View>
      <Text className="font-display text-lg font-black tracking-tight text-ink">
        Pasha<Text style={{ color: colors.gold600 }}>9</Text>
      </Text>
    </View>
  );
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
  const { lang, toggle } = useAppLang();

  // Live session + wallet + notifications. Props still win when explicitly passed.
  const { user } = useAuth();
  const { data: wallet } = useBalance();
  const { data: notifications } = useNotifications();
  const shownUsername = username ?? user?.username ?? 'Player';
  const shownBalance = balance ?? wallet?.balance ?? 0;
  const shownAvatar = avatarUrl ?? user?.avatarUrl ?? undefined;
  // The badge follows the live unread count unless a caller forces it via the
  // prop. When forced on with no live count we still show a plain dot.
  const unread = notifications?.unreadCount ?? 0;
  const showBadge = hasNotification ?? unread > 0;

  return (
    <View
      className={cn(
        'relative flex-row items-center justify-between border-b border-divider bg-paper px-3 py-2.5',
        className,
      )}
    >
      {/* Top gold hairline glow, as on the web header */}
      <View pointerEvents="none" className="absolute inset-x-0 top-0 h-px bg-gold-500/30" />

      {/* Left: hamburger + logo mark */}
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onMenu ?? (() => router.push('/profile'))}
          hitSlop={8}
          accessibilityLabel="Open menu"
          className="h-9 w-9 items-center justify-center rounded-xl border border-divider bg-paper active:bg-surface"
        >
          <Menu size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <LogoMark />
      </View>

      {/* Right cluster */}
      <View className="flex-row items-center gap-1.5">
        {/* Language EN/BN pill */}
        <Pressable
          onPress={toggle}
          accessibilityLabel="Toggle language"
          className="flex-row items-center gap-1 rounded-pill border border-divider bg-surface px-2 py-1.5 active:opacity-80"
        >
          <Globe size={13} color={colors.inkMute} strokeWidth={2} />
          <Text className="font-en text-[11px] font-bold text-gold-700">
            {lang === 'en' ? 'EN' : 'BN'}
          </Text>
        </Pressable>

        {/* Notifications bell */}
        <Pressable
          onPress={onBell ?? (() => router.push('/notifications'))}
          hitSlop={6}
          accessibilityLabel="Notifications"
          className="relative h-9 w-9 items-center justify-center rounded-xl border border-divider bg-paper active:bg-surface"
        >
          <Bell size={18} color={colors.ink} strokeWidth={2} />
          {showBadge ? (
            unread > 0 ? (
              <View className="absolute -right-1 -top-1 h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-paper bg-hot px-1">
                <Text className="text-[9px] font-black leading-none text-white">
                  {unread > 99 ? '99+' : String(unread)}
                </Text>
              </View>
            ) : (
              <View className="absolute right-1 top-1 h-2 w-2 rounded-full border border-paper bg-hot" />
            )
          ) : null}
        </Pressable>

        {/* Wallet pill (light pill + gold wallet icon + deposit +) */}
        {showWallet ? (
          <Pressable
            onPress={onWallet ?? (() => router.push('/wallet'))}
            accessibilityLabel="Wallet"
            className="flex-row items-center gap-1.5 rounded-pill border border-divider bg-surface py-1.5 pl-2.5 pr-1.5 active:opacity-80"
          >
            <Wallet size={14} color={colors.gold600} strokeWidth={2} />
            <Text className="font-en text-[11px] font-black text-ink" numberOfLines={1}>
              {formatBDT(shownBalance)}
            </Text>
            <View className="h-5 w-5 items-center justify-center rounded-full bg-gold-500">
              <Plus size={13} color={colors.ink} strokeWidth={2.5} />
            </View>
          </Pressable>
        ) : null}

        {/* Profile avatar */}
        <Pressable
          onPress={onProfile ?? (() => router.push('/profile'))}
          accessibilityLabel="My account"
          className="h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-divider bg-surfaceAlt active:opacity-80"
        >
          {shownAvatar ? (
            <Image source={{ uri: shownAvatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="font-en text-xs font-black text-ink-soft">
                {shownUsername.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
