// Built by Anointed Coder.
//
// Leaderboard: a premium trophy hero, the live 24h WINNINGS ranking (top three
// wear distinct medals: 1st gold, 2nd platinum, 3rd silver), and a live Recent
// Winners feed. Mirrors the web /leaderboard identity: dark islands on the light
// shell. The board reads GET /api/leaderboard/daily and the feed reads
// GET /api/winners/recent, both public and polled, each with loading / error /
// empty and off states.

import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { Screen, Gradient, SectionHeader } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { formatBDT } from '@/lib/format';
import {
  useLeaderboard,
  useRecentWinners,
  winnerLabel,
  formatRelativeTime,
} from '@/lib/api/leaderboard';
import { ApiError } from '@/lib/api/client';
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

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message !== err.code ? err.message : fallback;
}

export default function LeaderboardScreen() {
  const router = useRouter();

  const board = useLeaderboard();
  const feed = useRecentWinners();

  const rows = board.data?.rows ?? [];
  const boardOff = board.data?.enabled === false;

  const winners = feed.data?.winners ?? [];
  const feedOff = feed.data?.enabled === false;

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
            <Icon name="trophy" size={40} color={colors.ink} />
          </View>

          <View className="mt-4 flex-row items-center gap-1.5 rounded-pill border border-gold-500/40 bg-gold-500/10 px-3 py-1">
            <Icon name="flame" size={12} color={colors.gold300} />
            <Text className="text-[11px] font-black uppercase tracking-widest" style={{ color: colors.gold300 }}>
              24h Winnings
            </Text>
          </View>

          <Text className="mt-3 text-2xl font-black text-white">Leaderboard</Text>
          <Text className="mt-1.5 max-w-[280px] text-center text-xs text-white/60">
            Top players by total winnings in the last 24 hours. Handles are masked for privacy.
          </Text>

          {!boardOff && !board.isError ? (
            <View className="mt-4 flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full bg-newg" />
              <Text className="text-[11px] font-bold text-white/70">Live now</Text>
              {rows.length > 0 ? (
                <>
                  <Text className="text-white/30">|</Text>
                  <Icon name="people" size={13} color={colors.dinkMid} />
                  <Text className="text-[11px] font-bold text-white/70">Top {rows.length} players</Text>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {/* 24h winnings board */}
      <View className="overflow-hidden rounded-2xl border border-gold-500/20 bg-darkbg">
        <View className="flex-row items-center justify-between border-b border-white/5 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Icon name="podium" size={16} color={colors.gold300} />
            <Text className="text-sm font-extrabold text-white">Top winners</Text>
          </View>
          {!boardOff && !board.isError ? (
            <View className="flex-row items-center gap-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-newg" />
              <Text className="text-[11px] font-bold text-white/60">Live</Text>
            </View>
          ) : null}
        </View>

        {board.isLoading ? (
          <BoardSkeleton />
        ) : board.isError ? (
          <BoardMessage
            icon="cloud-offline"
            iconColor={colors.hot}
            title={errorMessage(board.error, 'Could not load the leaderboard.')}
            onRetry={() => board.refetch()}
          />
        ) : boardOff ? (
          <BoardMessage
            icon="pause"
            iconColor={colors.dinkMid}
            title="Leaderboard is currently off"
            message="Check back soon. The 24 hour ranking will return shortly."
          />
        ) : rows.length === 0 ? (
          <BoardMessage
            icon="trophy-outline"
            iconColor={colors.gold300}
            title="No winners in the last 24 hours yet"
            message="Be the first to make the board. Every win counts."
          />
        ) : (
          <>
            {rows.map((row, i) => {
              const medal = MEDALS[row.rank] ?? null;
              const winsLabel = `${row.wins} ${row.wins === 1 ? 'win' : 'wins'}`;
              const subtitle = medal ? `${medal.name}  •  ${winsLabel}` : winsLabel;
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
                      <Icon name="medal" size={18} color={colors.ink} />
                    </View>
                  ) : (
                    <View className="h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                      <Text className="text-xs font-black text-white/70">{row.rank}</Text>
                    </View>
                  )}

                  {/* Handle + wins subtitle */}
                  <View className="min-w-0 flex-1">
                    <Text className="text-[15px] font-extrabold text-white" numberOfLines={1}>
                      {row.handle}
                    </Text>
                    <Text
                      className="mt-0.5 text-[11px] font-semibold"
                      style={{ color: medal ? medal.accent : 'rgba(255,255,255,0.45)' }}
                      numberOfLines={1}
                    >
                      {subtitle}
                    </Text>
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
              <Icon name="information-circle-outline" size={14} color={colors.gold300} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[11px] leading-relaxed text-white/50">
                Ranked by each player's total winnings over the last 24 hours. Every player appears once.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Recent winners feed. Hidden entirely when the backend turns it off. */}
      {feedOff ? null : (
        <View className="gap-3">
          <SectionHeader title="Recent Winners" subtitle="Fresh wins across the floor" icon="sparkles" />
          <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
            {feed.isLoading ? (
              <FeedSkeleton />
            ) : feed.isError ? (
              <View className="flex-row items-center gap-2 px-3.5 py-4">
                <Icon name="cloud-offline" size={18} color={colors.hot} />
                <Text className="flex-1 text-sm text-ink-soft">
                  {errorMessage(feed.error, 'Could not load recent winners.')}
                </Text>
                <Pressable onPress={() => feed.refetch()} hitSlop={8}>
                  <Text className="text-sm font-bold text-gold-700">Retry</Text>
                </Pressable>
              </View>
            ) : winners.length === 0 ? (
              <View className="items-center gap-1 px-6 py-8">
                <Icon name="sparkles-outline" size={22} color={colors.gold700} />
                <Text className="text-sm font-extrabold text-ink">No recent winners yet</Text>
                <Text className="text-center text-xs text-ink-mute">
                  Fresh wins will show up here as they happen.
                </Text>
              </View>
            ) : (
              winners.map((w, i) => {
                const when = formatRelativeTime(w.at);
                return (
                  <View
                    key={w.id}
                    className={cn('flex-row items-center gap-3 px-3.5 py-3', i > 0 && 'border-t border-divider')}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-newg/12">
                      <Icon name="cash" size={16} color={colors.newg} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
                        {w.handle}
                      </Text>
                      <Text className="text-[11px] font-medium text-ink-mute" numberOfLines={1}>
                        {winnerLabel(w)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-sm font-black text-newg" numberOfLines={1}>
                        {formatBDT(w.amount)}
                      </Text>
                      {when ? (
                        <Text className="text-[10px] font-semibold text-ink-mute">{when}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* Play CTA */}
      <Pressable
        onPress={() => router.push('/games')}
        className="relative flex-row items-center justify-center gap-2 overflow-hidden rounded-pill py-3.5 active:opacity-90"
      >
        <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
        <Icon name="game-controller" size={18} color={colors.ink} />
        <Text className="text-base font-extrabold text-ink">Play and climb the ranks</Text>
      </Pressable>
    </Screen>
  );
}

// Skeleton rows for the dark board while the ranking loads.
function BoardSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          className={cn('flex-row items-center gap-3 px-4 py-3', i > 0 && 'border-t border-white/5')}
        >
          <View className="h-9 w-9 rounded-xl bg-white/[0.06]" />
          <View className="flex-1 gap-1.5">
            <View className="h-3.5 w-28 rounded bg-white/[0.06]" />
            <View className="h-2.5 w-16 rounded bg-white/[0.05]" />
          </View>
          <View className="h-3.5 w-16 rounded bg-white/[0.06]" />
        </View>
      ))}
    </>
  );
}

// Centered dark-island message for the board's error / off / empty states.
function BoardMessage({
  icon,
  iconColor,
  title,
  message,
  onRetry,
}: {
  icon: string;
  iconColor: string;
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View className="items-center gap-2.5 px-6 py-10">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <Text className="text-center text-sm font-extrabold text-white">{title}</Text>
      {message ? <Text className="max-w-[260px] text-center text-xs text-white/50">{message}</Text> : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          className="mt-1 rounded-pill border border-white/15 bg-white/[0.06] px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-bold" style={{ color: colors.gold300 }}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Skeleton rows for the light recent-winners feed while it loads.
function FeedSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          className={cn('flex-row items-center gap-3 px-3.5 py-3', i > 0 && 'border-t border-divider')}
        >
          <View className="h-9 w-9 rounded-full bg-surfaceAlt" />
          <View className="flex-1 gap-1.5">
            <View className="h-3.5 w-24 rounded bg-surfaceAlt" />
            <View className="h-2.5 w-20 rounded bg-surfaceAlt" />
          </View>
          <View className="h-3.5 w-14 rounded bg-surfaceAlt" />
        </View>
      ))}
    </>
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
        <Icon name="chevron-back" size={22} color={colors.ink} />
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
