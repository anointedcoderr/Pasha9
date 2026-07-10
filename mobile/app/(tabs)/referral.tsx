// Built by Anointed Coder.
//
// Referral: the player's referral code with copy + share actions, a stats
// row (invited / active / earned), a how-it-works steps card and a list of
// referred users with a status pill and per-friend earnings. Stats come from
// mockReferralStats; the referred-users list is local mock. Static screen.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Gradient, StatRow, Badge, type BadgeVariant } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { mockReferralStats } from '@/lib/mock';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';

type FriendStatus = 'active' | 'pending';

interface Friend {
  id: string;
  handle: string;
  joined: string;
  earned: number;
  status: FriendStatus;
  avatarUrl: string;
}

const FRIENDS: Friend[] = [
  { id: 'f1', handle: 'rakib***11', joined: '2 days ago', earned: 500, status: 'active', avatarUrl: 'https://picsum.photos/seed/pasha-ref1/96/96' },
  { id: 'f2', handle: 'mou***34', joined: '4 days ago', earned: 500, status: 'active', avatarUrl: 'https://picsum.photos/seed/pasha-ref2/96/96' },
  { id: 'f3', handle: 'sami***08', joined: '6 days ago', earned: 0, status: 'pending', avatarUrl: 'https://picsum.photos/seed/pasha-ref3/96/96' },
  { id: 'f4', handle: 'tanha***77', joined: '1 week ago', earned: 300, status: 'active', avatarUrl: 'https://picsum.photos/seed/pasha-ref4/96/96' },
  { id: 'f5', handle: 'imr***52', joined: '1 week ago', earned: 0, status: 'pending', avatarUrl: 'https://picsum.photos/seed/pasha-ref5/96/96' },
];

const STATUS: Record<FriendStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'ACTIVE', variant: 'new' },
  pending: { label: 'PENDING', variant: 'gold' },
};

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'share-social', title: 'Share your code', body: 'Send your referral code or link to friends.' },
  { icon: 'person-add', title: 'They join and deposit', body: 'Your friend signs up and makes a first deposit.' },
  { icon: 'cash', title: 'You both earn', body: 'Get up to BDT 750 for every active friend.' },
];

export default function ReferralScreen() {
  const s = mockReferralStats;
  const [copied, setCopied] = useState(false);

  function onCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      {/* Code card */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />

        <View className="relative p-4">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">
            Your referral code
          </Text>

          <View className="mt-2 flex-row items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <Text className="text-2xl font-black tracking-widest" style={{ color: colors.gold300 }}>
              {s.code}
            </Text>
            <Ionicons name="qr-code-outline" size={22} color={colors.gold300} />
          </View>

          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={onCopy}
              className="relative flex-1 flex-row items-center justify-center gap-2 overflow-hidden rounded-pill py-3 active:opacity-90"
            >
              <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.ink} />
              <Text className="text-sm font-extrabold text-ink">
                {copied ? 'Copied' : 'Copy code'}
              </Text>
            </Pressable>
            <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-pill border border-white/15 bg-white/10 py-3 active:opacity-80">
              <Ionicons name="share-social-outline" size={16} color={colors.gold300} />
              <Text className="text-sm font-bold text-white">Share</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Stats */}
      <StatRow
        items={[
          { label: 'Invited', value: `${s.referred}`, icon: 'people' },
          { label: 'Active', value: `${s.active}`, icon: 'flame', valueTone: 'green' },
          { label: 'Earned', value: formatBDT(s.totalEarned), icon: 'cash', valueTone: 'gold' },
        ]}
      />

      {/* How it works */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <Text className="mb-3 text-base font-extrabold text-ink">How it works</Text>
        <View className="gap-3">
          {STEPS.map((step, i) => (
            <View key={step.title} className="flex-row items-center gap-3">
              <View className="relative h-9 w-9 items-center justify-center overflow-hidden rounded-full">
                <Gradient colors={gradients.gold} radius={999} />
                <Text className="text-sm font-black text-ink">{i + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">{step.title}</Text>
                <Text className="text-[11px] text-ink-mute">{step.body}</Text>
              </View>
              <Ionicons name={step.icon} size={18} color={colors.gold700} />
            </View>
          ))}
        </View>
      </View>

      {/* Referred users */}
      <View className="gap-2">
        <Text className="text-base font-extrabold text-ink">Referred friends</Text>
        {FRIENDS.map((f) => {
          const st = STATUS[f.status];
          return (
            <View
              key={f.id}
              className="flex-row items-center gap-3 rounded-2xl border border-divider bg-paper p-3 shadow-sm shadow-black/5"
            >
              <Image
                source={{ uri: f.avatarUrl }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
                contentFit="cover"
              />
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">{f.handle}</Text>
                <Text className="text-[11px] text-ink-mute">Joined {f.joined}</Text>
              </View>
              <View className="items-end gap-1">
                <Text
                  className="text-sm font-black"
                  style={{ color: f.earned > 0 ? colors.gold700 : colors.inkMute }}
                >
                  {f.earned > 0 ? formatBDT(f.earned) : '-'}
                </Text>
                <Badge label={st.label} variant={st.variant} />
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
