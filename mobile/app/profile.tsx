// Built by Anointed Coder.
//
// Profile / Account: the player's account hub. A dark premium identity card
// (avatar, username, masked phone, VIP badge, member since), a balance
// summary row, then grouped icon-setting rows (Account, Preferences, Wallet,
// Support) and a Log out button. Static, mock-driven, matches Home style.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, StatRow, Gradient } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { formatBDT } from '@/lib/format';
import { mockUser } from '@/lib/mock';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useBalance } from '@/lib/api/hooks';

// Mask a BD phone for display, showing only the last four digits.
function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 4)}${'*'.repeat(Math.max(0, phone.length - 8))}${phone.slice(-4)}`;
}

type IconName = keyof typeof Ionicons.glyphMap;

// Setting groups. Each row routes somewhere in a later phase; here they are
// visual only (onPress is a no-op wired to the closest existing route).
interface SettingItem {
  key: string;
  icon: IconName;
  label: string;
  value?: string;
  tone: 'gold' | 'blue' | 'green' | 'violet' | 'neutral';
  route?: string;
}

interface SettingGroupData {
  title: string;
  items: SettingItem[];
}

const GROUPS: SettingGroupData[] = [
  {
    title: 'Account',
    items: [
      { key: 'personal', icon: 'person-outline', label: 'Personal info', value: 'Edit', tone: 'blue' },
      { key: 'security', icon: 'lock-closed-outline', label: 'Security and password', tone: 'violet' },
      { key: 'kyc', icon: 'shield-checkmark-outline', label: 'KYC verification', value: 'Verified', tone: 'green' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { key: 'language', icon: 'language-outline', label: 'Language', value: 'BN / EN', tone: 'gold' },
      { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', value: 'On', tone: 'blue' },
    ],
  },
  {
    title: 'Wallet',
    items: [
      { key: 'bank', icon: 'card-outline', label: 'Bank and withdrawal accounts', value: '2 saved', tone: 'gold', route: '/wallet' },
    ],
  },
  {
    title: 'Support',
    items: [
      { key: 'responsible', icon: 'hand-left-outline', label: 'Responsible gaming', tone: 'green' },
      { key: 'help', icon: 'headset-outline', label: 'Support center', value: '24/7', tone: 'blue' },
    ],
  },
];

const TONE_BG: Record<SettingItem['tone'], string> = {
  gold: 'bg-gold-500/15',
  blue: 'bg-blue-500/12',
  green: 'bg-newg/12',
  violet: 'bg-[#a855f7]/12',
  neutral: 'bg-surfaceAlt',
};

const TONE_ICON: Record<SettingItem['tone'], string> = {
  gold: colors.gold700,
  blue: colors.blue600,
  green: colors.newg,
  violet: '#8b5cf6',
  neutral: colors.inkMute,
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: wallet } = useBalance();
  const [signingOut, setSigningOut] = useState(false);

  const username = user?.username ?? mockUser.username;
  const phoneMasked = maskPhone(user?.phone) ?? mockUser.phoneMasked;
  const avatarUrl = user?.avatarUrl ?? mockUser.avatarUrl;
  const mainBalance = wallet?.balance ?? 0;
  const bonusBalance = wallet?.bonusBalance ?? 0;

  const memberSince = new Date(mockUser.memberSince).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // The auth gate redirects to /auth/login once the session clears.
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen header={<BackHeader title="Account" subtitle={`@${username}`} />} contentClassName="px-4 pt-4 gap-4">
      {/* Identity card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20" />
        <View className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-blue-500/15" />

        <View className="relative p-4">
          <View className="flex-row items-center gap-3">
            <View className="relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-gold-500/50">
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-black text-white" numberOfLines={1}>
                  {username}
                </Text>
                <VipBadge tier={mockUser.vipTier} />
              </View>
              <Text className="mt-0.5 text-xs font-semibold text-white/70">{phoneMasked}</Text>
              <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/45">
                Member since {memberSince}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 active:opacity-80"
            >
              <Ionicons name="create-outline" size={18} color={colors.gold300} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Balance summary */}
      <StatRow
        items={[
          { label: 'Main balance', value: formatBDT(mainBalance), icon: 'wallet', valueTone: 'gold' },
          { label: 'Bonus', value: formatBDT(bonusBalance, false), icon: 'gift', valueTone: 'green' },
          { label: 'VIP tier', value: mockUser.vipTier, icon: 'diamond', valueTone: 'blue' },
        ]}
      />

      {/* Setting groups */}
      {GROUPS.map((group) => (
        <View key={group.title} className="gap-2">
          <Text className="px-1 text-[11px] font-black uppercase tracking-widest text-ink-mute">
            {group.title}
          </Text>
          <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
            {group.items.map((item, i) => (
              <SettingRow
                key={item.key}
                item={item}
                first={i === 0}
                onPress={() => (item.route ? router.push(item.route as never) : undefined)}
              />
            ))}
          </View>
        </View>
      ))}

      {/* Log out */}
      <Pressable
        onPress={onSignOut}
        disabled={signingOut}
        className={cn(
          'mt-1 flex-row items-center justify-center gap-2 rounded-pill border border-hot/30 bg-hot/5 py-3.5 active:opacity-80',
          signingOut && 'opacity-60',
        )}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.hot} />
        <Text className="text-base font-extrabold" style={{ color: colors.hot }}>
          {signingOut ? 'Signing out...' : 'Log out'}
        </Text>
      </Pressable>

      <Text className="mt-1 text-center text-[11px] text-ink-mute">Pasha9 - v1.0.0</Text>
    </Screen>
  );
}

// A single tappable setting row: tinted icon square, label, optional value,
// chevron. Rows share a hairline divider inside the group card.
function SettingRow({
  item,
  first,
  onPress,
}: {
  item: SettingItem;
  first: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 px-3.5 py-3.5 active:bg-surface',
        !first && 'border-t border-divider',
      )}
    >
      <View className={cn('h-9 w-9 items-center justify-center rounded-xl', TONE_BG[item.tone])}>
        <Ionicons name={item.icon} size={18} color={TONE_ICON[item.tone]} />
      </View>
      <Text className="flex-1 text-sm font-bold text-ink" numberOfLines={1}>
        {item.label}
      </Text>
      {item.value ? (
        <Text className="text-xs font-semibold text-ink-mute" numberOfLines={1}>
          {item.value}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.inkMute} />
    </Pressable>
  );
}

// Small gold VIP pill shown beside the username.
function VipBadge({ tier }: { tier: string }) {
  return (
    <View className="relative flex-row items-center gap-1 overflow-hidden rounded-pill px-2 py-0.5">
      <Gradient colors={gradients.gold} radius={999} />
      <Ionicons name="diamond" size={10} color={colors.ink} />
      <Text className="text-[10px] font-black uppercase tracking-wider text-ink">{tier} VIP</Text>
    </View>
  );
}

// Slim back header for stack routes (mirrors the ComingSoon stack variant).
function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-2 border-b border-divider bg-paper px-3 py-2.5">
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-lg font-black text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
