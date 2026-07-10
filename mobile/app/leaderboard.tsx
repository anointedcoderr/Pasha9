// Built by Anointed Coder.
//
// Leaderboard: a premium trophy hero, the always-on 24h WINNINGS ranking
// (top three wear distinct medals: 1st gold, 2nd platinum, 3rd silver), and a
// Recent Winners feed. Mirrors the web /leaderboard identity: dark islands on
// the light shell. Read-only and static from mock.

import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Gradient, SectionHeader } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { formatBDT } from '@/lib/format';
import { mockLeaderboard, mockWinners } from '@/lib/mock';
import { cn } from '@/lib/cn';

// Distinct medal identity for the top three of the 24h board:
//   1st GOLD, 2nd PLATINUM, 3rd SILVER. Ranks 4+ get a neutral dark chip.
interface Medal {
  name: string;
  grad: readonly string[];
  accent: string;
  border: string;
  rowBg: string;
}

const MEDALS: Record<number, Medal> = {
  1: { name: 'Gold', grad: ['#FFE066', '#FFCC00', '#F5B400'], accent: '#FFD633', border: '#F5B400', rowBg: 'bg-gold-500/10' },
  2: { name: 'Platinum', grad: ['#e0f2fe', '#a5b4c8', '#7c8aa0'], accent: '#cfe3f2', border: '#9fb3c8', rowBg: 'bg-white/[0.06]' },
  3: { name: 'Silver', grad: ['#eef2f7', '#cbd5e1', '#94a3b8'], accent: '#e2e8f0', border: '#cbd5e1', rowBg: 'bg-white/[0.05]' },
};

export default function LeaderboardScreen() {
  const router = useRouter();

  return (
    <Screen header={<BackHeader title="Leaderboard" subtitle="24h winnings" />} contentClassName="px-4 pt-4 gap-5">
      {/* Trophy hero */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-500/30">
        <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-gold-500/20" />
        <View className="absolute -left-12 bottom-[-30%] h-52 w-52 rounded-full bg-newg/10" />

        <View className="relative items-center px-5 py-7">
          <View className="relative h-20 w-20 items-center justify-center overflow-hidden rounded-2xl">
            <Gradient colors={gradients.gold} radius={16} />
            <Ionicons name="trophy" size={40} color={colors.ink} />
          </View>

          <View className="mt-4 flex-row items-center gap-1.5 rounded-pill border border-gold-500/40 bg-gold-500/10 px-3 py-1">
            <Ionicons name="flame" size={12} color={colors.gold300} />
            <Text className="text-[11px] font-black uppercase tracking-widest" style={{ color: colors.gold300 }}>
              24h Winnings
            </Text>
          </View>

          <Text className="mt-3 text-2xl font-black text-white">Leaderboard</Text>
          <Text className="mt-1.5 max-w-[280px] text-center text-xs text-white/60">
            Top players by total winnings in the last 24 hours. Handles are masked for privacy.
          </Text>

          <View className="mt-4 flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full bg-newg" />
            <Text className="text-[11px] font-bold text-white/70">Live now</Text>
            <Text className="text-white/30">|</Text>
            <Ionicons name="people" size={13} color={colors.dinkMid} />
            <Text className="text-[11px] font-bold text-white/70">2,418 players</Text>
          </View>
        </View>
      </View>

      {/* 24h winnings board */}
      <View className="overflow-hidden rounded-2xl border border-gold-500/20 bg-darkbg">
        <View className="flex-row items-center justify-between border-b border-white/5 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="podium" size={16} color={colors.gold300} />
            <Text className="text-sm font-extrabold text-white">Top winners</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="h-1.5 w-1.5 rounded-full bg-newg" />
            <Text className="text-[11px] font-bold text-white/60">Live</Text>
          </View>
        </View>

        {mockLeaderboard.map((row, i) => {
          const medal = MEDALS[row.rank] ?? null;
          return (
            <View
              key={row.rank}
              className={cn(
                'flex-row items-center gap-3 px-4 py-3',
                i > 0 && 'border-t border-white/5',
                medal ? `${medal.rowBg} border-l-2` : '',
              )}
              style={medal ? { borderLeftColor: medal.border } : undefined}
            >
              {/* Rank badge */}
              {medal ? (
                <View className="relative h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
                  <Gradient colors={medal.grad} radius={12} />
                  <Ionicons name="medal" size={18} color={colors.ink} />
                </View>
              ) : (
                <View className="h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Text className="text-xs font-black text-white/70">{row.rank}</Text>
                </View>
              )}

              {/* Avatar */}
              <View
                className="h-10 w-10 overflow-hidden rounded-full border"
                style={{ borderColor: medal ? medal.border : 'rgba(255,255,255,0.12)' }}
              >
                <Image
                  source={{ uri: row.avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                />
              </View>

              {/* Handle + medal label */}
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-extrabold text-white" numberOfLines={1}>
                  {row.handle}
                </Text>
                {medal ? (
                  <Text className="mt-0.5 text-[10px] font-black uppercase tracking-wider" style={{ color: medal.accent }}>
                    {medal.name}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-[11px] font-semibold text-white/45">Rank #{row.rank}</Text>
                )}
              </View>

              {/* Winnings */}
              <Text
                className="text-sm font-black"
                style={{ color: medal ? medal.accent : colors.neon }}
                numberOfLines={1}
              >
                {formatBDT(row.winnings)}
              </Text>
            </View>
          );
        })}

        <View className="flex-row items-start gap-2 border-t border-white/5 bg-white/[0.02] px-4 py-3">
          <Ionicons name="information-circle-outline" size={14} color={colors.gold300} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[11px] leading-relaxed text-white/50">
            Ranked by each player's total winnings over the last 24 hours. Every player appears once.
          </Text>
        </View>
      </View>

      {/* Recent winners feed */}
      <View className="gap-3">
        <SectionHeader title="Recent Winners" subtitle="Fresh wins across the floor" icon="sparkles" />
        <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
          {mockWinners.map((w, i) => (
            <View
              key={w.id}
              className={cn('flex-row items-center gap-3 px-3.5 py-3', i > 0 && 'border-t border-divider')}
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-newg/12">
                <Ionicons name="cash" size={16} color={colors.newg} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
                  {w.handle}
                </Text>
                <Text className="text-[11px] font-medium text-ink-mute" numberOfLines={1}>
                  {w.game}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-black text-newg" numberOfLines={1}>
                  {formatBDT(w.amount)}
                </Text>
                <Text className="text-[10px] font-semibold text-ink-mute">{w.timeAgo} ago</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Play CTA */}
      <Pressable
        onPress={() => router.push('/games')}
        className="relative flex-row items-center justify-center gap-2 overflow-hidden rounded-pill py-3.5 active:opacity-90"
      >
        <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
        <Ionicons name="game-controller" size={18} color={colors.ink} />
        <Text className="text-base font-extrabold text-ink">Play and climb the ranks</Text>
      </Pressable>
    </Screen>
  );
}

// Slim back header for stack routes.
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
