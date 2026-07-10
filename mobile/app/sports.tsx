// Built by Anointed Coder.
//
// Sports / Sportsbook landing: a sport category chip row (Football, Cricket,
// Basketball, Tennis, eSports), a featured live matches list with odds
// buttons and a live badge, and an upcoming matches list. Static, mock-like
// local data; selecting a sport filters both lists. No real betting logic.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, SectionHeader, Gradient, EmptyState } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

interface Sport {
  key: string;
  label: string;
  icon: IconName;
}

const SPORTS: Sport[] = [
  { key: 'football', label: 'Football', icon: 'football' },
  { key: 'cricket', label: 'Cricket', icon: 'baseball' },
  { key: 'basketball', label: 'Basketball', icon: 'basketball' },
  { key: 'tennis', label: 'Tennis', icon: 'tennisball' },
  { key: 'esports', label: 'eSports', icon: 'game-controller' },
];

interface Match {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  live?: boolean;
  clock?: string;
  score?: string;
  time?: string;
  odds: { home: string; draw?: string; away: string };
}

const MATCHES: Match[] = [
  // Football
  { id: 'f1', sport: 'football', league: 'Premier League', home: 'Man City', away: 'Arsenal', live: true, clock: "58'", score: '2 - 1', odds: { home: '1.85', draw: '3.40', away: '4.20' } },
  { id: 'f2', sport: 'football', league: 'La Liga', home: 'Real Madrid', away: 'Barcelona', live: true, clock: "71'", score: '1 - 1', odds: { home: '2.10', draw: '3.30', away: '3.50' } },
  { id: 'f3', sport: 'football', league: 'Premier League', home: 'Liverpool', away: 'Chelsea', time: 'Today 21:00', odds: { home: '2.05', draw: '3.40', away: '3.60' } },
  { id: 'f4', sport: 'football', league: 'Bundesliga', home: 'Bayern', away: 'Dortmund', time: 'Tomorrow 00:30', odds: { home: '1.70', draw: '3.90', away: '4.50' } },

  // Cricket
  { id: 'c1', sport: 'cricket', league: 'ODI Series', home: 'India', away: 'Australia', live: true, clock: '32.4 ov', score: '198 / 4', odds: { home: '1.65', away: '2.25' } },
  { id: 'c2', sport: 'cricket', league: 'T20 International', home: 'Bangladesh', away: 'Pakistan', time: 'Today 19:30', odds: { home: '1.90', away: '1.95' } },
  { id: 'c3', sport: 'cricket', league: 'Test Match', home: 'England', away: 'South Africa', time: 'Tomorrow 15:00', odds: { home: '1.80', away: '2.05' } },

  // Basketball
  { id: 'b1', sport: 'basketball', league: 'NBA', home: 'Lakers', away: 'Celtics', live: true, clock: 'Q3 04:12', score: '78 - 72', odds: { home: '1.75', away: '2.10' } },
  { id: 'b2', sport: 'basketball', league: 'NBA', home: 'Warriors', away: 'Bucks', time: 'Today 23:00', odds: { home: '1.90', away: '1.95' } },
  { id: 'b3', sport: 'basketball', league: 'EuroLeague', home: 'Barcelona', away: 'Real Madrid', time: 'Tomorrow 20:45', odds: { home: '2.20', away: '1.68' } },

  // Tennis
  { id: 't1', sport: 'tennis', league: 'ATP Masters', home: 'Alcaraz', away: 'Sinner', live: true, clock: 'Set 2', score: '6-4 3-2', odds: { home: '1.55', away: '2.45' } },
  { id: 't2', sport: 'tennis', league: 'ATP 500', home: 'Djokovic', away: 'Medvedev', time: 'Tomorrow 18:00', odds: { home: '1.70', away: '2.15' } },

  // eSports
  { id: 'e1', sport: 'esports', league: 'LoL Worlds', home: 'T1', away: 'G2 Esports', live: true, clock: 'Game 2', score: '1 - 0', odds: { home: '1.60', away: '2.35' } },
  { id: 'e2', sport: 'esports', league: 'CS2 Major', home: 'NAVI', away: 'FaZe Clan', time: 'Today 20:00', odds: { home: '1.85', away: '1.95' } },
];

export default function SportsScreen() {
  const router = useRouter();
  const [active, setActive] = useState('football');

  const live = MATCHES.filter((m) => m.sport === active && m.live);
  const upcoming = MATCHES.filter((m) => m.sport === active && !m.live);
  const activeSport = SPORTS.find((s) => s.key === active);

  return (
    <Screen header={<BackHeader title="Sports" subtitle="Live odds and fixtures" />} contentClassName="px-4 pt-4 gap-5">
      {/* Sport category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {SPORTS.map((s) => {
          const on = s.key === active;
          return (
            <Pressable
              key={s.key}
              onPress={() => setActive(s.key)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-pill border px-3.5 py-2 active:opacity-80',
                on ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
              )}
            >
              <Ionicons name={s.icon} size={15} color={on ? colors.ink : colors.inkMute} />
              <Text className={cn('text-xs font-bold', on ? 'text-ink' : 'text-ink-soft')}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Featured banner */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20" />
        <View className="relative flex-row items-center gap-3 p-4">
          <View className="relative h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
            <Gradient colors={gradients.gold} radius={16} />
            <Ionicons name={activeSport?.icon ?? 'football'} size={24} color={colors.ink} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-black text-white">{activeSport?.label} betting</Text>
            <Text className="text-xs font-semibold text-white/60">
              Live in-play odds, cash out and boosted markets.
            </Text>
          </View>
          <View className="rounded-pill bg-newg/20 px-2.5 py-1">
            <Text className="text-[11px] font-black" style={{ color: colors.neon }}>
              {live.length} live
            </Text>
          </View>
        </View>
      </View>

      {/* Live matches */}
      <View className="gap-3">
        <SectionHeader title="Live now" subtitle="In-play right now" icon="flash" />
        {live.length > 0 ? (
          <View className="gap-3">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="time-outline"
            title="No live matches"
            message={`No ${activeSport?.label} games are in-play. Check the upcoming fixtures below.`}
          />
        )}
      </View>

      {/* Upcoming matches */}
      <View className="gap-3">
        <SectionHeader title="Upcoming" subtitle="Starting soon" icon="calendar" onAction={() => router.push('/games')} />
        <View className="gap-3">
          {upcoming.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

// A single match card: league + live/time meta, the two team rows, and a row
// of odds buttons (1 / X / 2, with X omitted for two-way sports).
function MatchCard({ match }: { match: Match }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
      {/* Meta row */}
      <View className="flex-row items-center justify-between border-b border-divider px-3.5 py-2.5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-mute" numberOfLines={1}>
          {match.league}
        </Text>
        {match.live ? (
          <View className="flex-row items-center gap-1.5 rounded-pill bg-hot/10 px-2 py-0.5">
            <View className="h-1.5 w-1.5 rounded-full bg-hot" />
            <Text className="text-[10px] font-black uppercase tracking-wider text-hot">
              Live {match.clock}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={12} color={colors.inkMute} />
            <Text className="text-[11px] font-bold text-ink-mute">{match.time}</Text>
          </View>
        )}
      </View>

      {/* Teams */}
      <View className="px-3.5 py-3">
        <TeamRow name={match.home} score={match.score ? match.score.split(' ')[0] : undefined} live={match.live} />
        <View className="my-1.5 h-px bg-divider" />
        <TeamRow
          name={match.away}
          score={match.score ? match.score.split(' ').slice(-1)[0] : undefined}
          live={match.live}
        />
      </View>

      {/* Odds */}
      <View className="flex-row gap-2 px-3.5 pb-3.5">
        <OddsButton label="1" value={match.odds.home} />
        {match.odds.draw ? <OddsButton label="X" value={match.odds.draw} /> : null}
        <OddsButton label="2" value={match.odds.away} />
      </View>
    </View>
  );
}

function TeamRow({ name, score, live }: { name: string; score?: string; live?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2 flex-1 pr-2">
        <View className="h-6 w-6 items-center justify-center rounded-md bg-surfaceAlt">
          <Text className="text-[11px] font-black text-ink-soft">{name.slice(0, 1)}</Text>
        </View>
        <Text className="flex-1 text-sm font-extrabold text-ink" numberOfLines={1}>
          {name}
        </Text>
      </View>
      {score ? (
        <Text className={cn('text-base font-black tabular-nums', live ? 'text-hot' : 'text-ink')}>{score}</Text>
      ) : null}
    </View>
  );
}

// A tappable odds pill. Visual only: label (market) on top, decimal odd below.
function OddsButton({ label, value }: { label: string; value: string }) {
  return (
    <Pressable className="flex-1 items-center rounded-xl border border-divider bg-surface py-2 active:border-gold-600 active:bg-gold-500/15">
      <Text className="text-[10px] font-black uppercase tracking-wider text-ink-mute">{label}</Text>
      <Text className="mt-0.5 text-sm font-black text-ink">{value}</Text>
    </Pressable>
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
