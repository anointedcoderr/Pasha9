// Built by Anointed Coder.
//
// Profile / Account: the player's account hub, wired to the live session. A
// dark identity card (avatar, username, masked phone, VIP or Member pill), the
// live balance summary from GET /api/bonuses/me, grouped setting rows that route
// to the real account screens, an inline bn/en language picker (PATCH
// /api/me/profile), and Log out. No mock data.

import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Screen, StatRow, Gradient } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { gradients, colors } from '@/lib/theme';
import { formatBDT } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useBalance } from '@/lib/api/hooks';
import { useUpdateProfile } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';

// Mask a BD phone for display, showing only the first four and last four digits.
function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 4)}${'*'.repeat(Math.max(0, phone.length - 8))}${phone.slice(-4)}`;
}

// Surface the real backend message when it carries one, else a friendly line.
function messageFor(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.message !== err.code ? err.message : fallback) : fallback;
}

type IconName = string;
type Tone = 'gold' | 'blue' | 'green' | 'violet' | 'neutral';

interface SettingItem {
  key: string;
  icon: IconName;
  label: string;
  value?: string;
  tone: Tone;
  route?: string;
}

interface SettingGroupData {
  title: string;
  items: SettingItem[];
}

// Every row routes to a real screen except the language row, which opens the
// bn/en picker (handled by key in the render below).
const GROUPS: SettingGroupData[] = [
  {
    title: 'Account',
    items: [
      { key: 'personal', icon: 'person-outline', label: 'Personal info', value: 'Edit', tone: 'blue', route: '/edit-profile' },
      { key: 'security', icon: 'lock-closed-outline', label: 'Security and password', tone: 'violet', route: '/change-password' },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { key: 'rewards', icon: 'gift-outline', label: 'Rewards, check-in and spin', tone: 'gold', route: '/rewards' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { key: 'language', icon: 'language-outline', label: 'Language', tone: 'gold' },
      { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', tone: 'blue', route: '/notifications' },
    ],
  },
  {
    title: 'Wallet',
    items: [
      { key: 'bank', icon: 'card-outline', label: 'Bank and withdrawal accounts', tone: 'gold', route: '/wallet' },
    ],
  },
  {
    title: 'Support',
    items: [
      { key: 'responsible', icon: 'hand-left-outline', label: 'Responsible gaming', tone: 'green', route: '/legal/responsible-gaming' },
      { key: 'help', icon: 'headset-outline', label: 'Support center', value: '24/7', tone: 'blue', route: '/legal/support' },
      { key: 'faq', icon: 'help-circle-outline', label: 'FAQ', tone: 'violet', route: '/legal/faq' },
    ],
  },
];

const TONE_BG: Record<Tone, string> = {
  gold: 'bg-gold-500/15',
  blue: 'bg-blue-500/12',
  green: 'bg-newg/12',
  violet: 'bg-[#a855f7]/12',
  neutral: 'bg-surfaceAlt',
};

const TONE_ICON: Record<Tone, string> = {
  gold: colors.gold700,
  blue: colors.blue600,
  green: colors.newg,
  violet: '#8b5cf6',
  neutral: colors.inkMute,
};

const LANG_OPTIONS: { code: 'en' | 'bn'; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা (Bangla)' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, patchUser } = useAuth();
  const { data: wallet } = useBalance();
  const updateProfile = useUpdateProfile();
  const [signingOut, setSigningOut] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  // Synchronous guard: a disabled prop only updates next render, so a fast
  // double-tap could otherwise fire two PATCH /api/me/profile writes.
  const langSavingRef = useRef(false);

  const username = user?.username ?? 'Player';
  const phoneMasked = maskPhone(user?.phone);
  const avatarUrl = user?.avatarUrl ?? null;
  const mainBalance = wallet?.balance ?? 0;
  const bonusBalance = wallet?.bonusBalance ?? 0;
  const vipTier = user?.vipTier ?? null;
  const langLabel =
    user?.language === 'bn' ? 'বাংলা' : user?.language === 'en' ? 'English' : 'Not set';
  const initial = username.slice(0, 1).toUpperCase();

  // Only show the VIP cell when the player actually has a tier.
  const statItems = [
    { label: 'Main balance', value: formatBDT(mainBalance), icon: 'wallet' as IconName, valueTone: 'gold' as const },
    { label: 'Bonus', value: formatBDT(bonusBalance, false), icon: 'gift' as IconName, valueTone: 'green' as const },
    ...(vipTier
      ? [{ label: 'VIP tier', value: vipTier, icon: 'diamond' as IconName, valueTone: 'blue' as const }]
      : []),
  ];

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

  async function pickLanguage(code: 'en' | 'bn') {
    setLangOpen(false);
    if (langSavingRef.current || updateProfile.isPending) return;
    if (user?.language === code) return;
    langSavingRef.current = true;
    try {
      const updated = await updateProfile.mutateAsync({ language: code });
      patchUser({ language: updated.language });
    } catch (err) {
      Alert.alert('Could not update language', messageFor(err, 'Please try again.'));
    } finally {
      langSavingRef.current = false;
    }
  }

  return (
    <Screen
      header={<StackScreenHeader title="Account" subtitle={`@${username}`} />}
      contentClassName="px-4 pt-4 gap-4"
    >
      {/* Identity card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20" />
        <View className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-blue-500/15" />

        <View className="relative p-4">
          <View className="flex-row items-center gap-3">
            <View className="relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-gold-500/50 bg-white/10">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-2xl font-black text-white">{initial}</Text>
                </View>
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-black text-white" numberOfLines={1}>
                  {username}
                </Text>
                {vipTier ? <VipBadge tier={vipTier} /> : <MemberPill />}
              </View>
              {phoneMasked ? (
                <Text className="mt-0.5 text-xs font-semibold text-white/70">{phoneMasked}</Text>
              ) : null}
              {user?.referralCode ? (
                <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/45">
                  Referral code {user.referralCode}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => router.push('/edit-profile')}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 active:opacity-80"
            >
              <Icon name="create-outline" size={18} color={colors.gold300} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Balance summary */}
      <StatRow items={statItems} />

      {/* Setting groups */}
      {GROUPS.map((group) => (
        <View key={group.title} className="gap-2">
          <Text className="px-1 text-[11px] font-black uppercase tracking-widest text-ink-mute">
            {group.title}
          </Text>
          <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
            {group.items.map((item, i) => {
              const isLanguage = item.key === 'language';
              const value = isLanguage ? langLabel : item.value;
              const onPress = isLanguage
                ? () => setLangOpen(true)
                : item.route
                  ? () => router.push(item.route as never)
                  : undefined;
              return (
                <SettingRow key={item.key} item={item} value={value} first={i === 0} onPress={onPress} />
              );
            })}
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
        <Icon name="log-out-outline" size={18} color={colors.hot} />
        <Text className="text-base font-extrabold" style={{ color: colors.hot }}>
          {signingOut ? 'Signing out...' : 'Log out'}
        </Text>
      </Pressable>

      <Text className="mt-1 text-center text-[11px] text-ink-mute">Pasha9 - v1.0.0</Text>

      {/* Language picker */}
      <Modal
        visible={langOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangOpen(false)}
      >
        <Pressable
          onPress={() => setLangOpen(false)}
          className="flex-1 items-center justify-center bg-black/40 px-8"
        >
          <Pressable onPress={() => undefined} className="w-full rounded-2xl border border-divider bg-paper p-2">
            <Text className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-ink-mute">
              Language
            </Text>
            {LANG_OPTIONS.map((opt) => {
              const active = user?.language === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => pickLanguage(opt.code)}
                  className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-surface"
                >
                  <Icon
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? colors.gold700 : colors.inkMute}
                  />
                  <Text className="flex-1 text-sm font-bold text-ink">{opt.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// A single tappable setting row: tinted icon square, label, optional value,
// chevron. Rows share a hairline divider inside the group card.
function SettingRow({
  item,
  value,
  first,
  onPress,
}: {
  item: SettingItem;
  value?: string;
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
        <Icon name={item.icon} size={18} color={TONE_ICON[item.tone]} />
      </View>
      <Text className="flex-1 text-sm font-bold text-ink" numberOfLines={1}>
        {item.label}
      </Text>
      {value ? (
        <Text className="text-xs font-semibold text-ink-mute" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Icon name="chevron-forward" size={16} color={colors.inkMute} />
    </Pressable>
  );
}

// Small gold VIP pill shown beside the username when the player has a tier.
function VipBadge({ tier }: { tier: string }) {
  return (
    <View className="relative flex-row items-center gap-1 overflow-hidden rounded-pill px-2 py-0.5">
      <Gradient colors={gradients.gold} radius={999} />
      <Icon name="diamond" size={10} color={colors.ink} />
      <Text className="text-[10px] font-black uppercase tracking-wider text-ink">{tier} VIP</Text>
    </View>
  );
}

// Neutral pill shown when the player has no VIP tier yet.
function MemberPill() {
  return (
    <View className="flex-row items-center gap-1 rounded-pill border border-white/15 bg-white/10 px-2 py-0.5">
      <Icon name="person" size={10} color={colors.gold300} />
      <Text className="text-[10px] font-black uppercase tracking-wider text-white/80">Member</Text>
    </View>
  );
}
