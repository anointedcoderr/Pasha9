// Built by Anointed Coder.
//
// Sports / Sportsbook landing. A sport category chip row (Football, Cricket,
// Basketball, Tennis, eSports) filters the REAL events feed from
// GET /api/content/sports-events. Each event renders as a card (team A vs
// team B, league, kickoff, a live/upcoming badge) with a single honest action
// that opens the provider's real sportsbook deep link in an in-app browser,
// gated on auth. No fabricated matches and no invented odds: the endpoint does
// not return odds, so none are shown. Loading, error and empty states are all
// truthful.

import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { Screen, SectionHeader, Gradient, EmptyState } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { titleCase } from '@/lib/format';
import { ApiError } from '@/lib/api/client';
import { balanceQueryKey, bonusesQueryKey } from '@/lib/api/hooks';
import { useSportsEvents, type SportEvent } from '@/lib/api/sports';
import { useAuth } from '@/store/auth';

type IconName = string;

interface Sport {
  key: string;
  label: string;
  icon: IconName;
}

// The chip keys match the backend `sportType` slugs so filtering is a direct
// case-insensitive compare against the real events.
const SPORTS: Sport[] = [
  { key: 'football', label: 'Football', icon: 'football' },
  { key: 'cricket', label: 'Cricket', icon: 'baseball' },
  { key: 'basketball', label: 'Basketball', icon: 'basketball' },
  { key: 'tennis', label: 'Tennis', icon: 'tennisball' },
  { key: 'esports', label: 'eSports', icon: 'game-controller' },
];

/** Format an ISO kickoff into a short, friendly local string. */
function formatKickoff(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** A human status label for the non-live badge. */
function statusLabel(status: string): string {
  if (status === 'upcoming') return 'Upcoming';
  return status ? titleCase(status) : 'Scheduled';
}

export default function SportsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const [active, setActive] = useState('football');

  const sportsQuery = useSportsEvents();
  const events = sportsQuery.data ?? [];

  // Real launch: gate on auth, then open the sportsbook deep link in an in-app
  // browser (the same safe pattern the provider games use). A synchronous ref
  // blocks a double-tap before the launching state lands.
  const inFlight = useRef(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const openEvent = useCallback(
    (event: SportEvent) => {
      if (inFlight.current) return;
      setLaunchError(null);

      if (status !== 'authed') {
        router.push('/auth/login');
        return;
      }
      if (!event.deepLinkUrl) {
        setLaunchError('This match cannot be opened right now. Please try again shortly.');
        return;
      }

      inFlight.current = true;
      setLaunchingId(event.id);
      (async () => {
        try {
          await WebBrowser.openBrowserAsync(event.deepLinkUrl, {
            enableBarCollapsing: true,
            showTitle: true,
          });
          // Back from the sportsbook: a bet may have settled while it was open,
          // so refresh the wallet reads the header + screens rely on.
          queryClient.invalidateQueries({ queryKey: balanceQueryKey });
          queryClient.invalidateQueries({ queryKey: bonusesQueryKey });
        } catch {
          setLaunchError('Could not open the sportsbook. Check your connection and try again.');
        } finally {
          inFlight.current = false;
          setLaunchingId(null);
        }
      })();
    },
    [status, router, queryClient],
  );

  const activeSport = SPORTS.find((s) => s.key === active);
  const sportEvents = events.filter((e) => e.sportType.toLowerCase() === active);
  const live = sportEvents.filter((e) => e.status === 'live');
  const upcoming = sportEvents.filter((e) => e.status !== 'live');

  // Surface the real backend message on error, but never leak a bare error code.
  const friendlyError =
    sportsQuery.error instanceof ApiError && /\s/.test(sportsQuery.error.message)
      ? sportsQuery.error.message
      : 'We could not load the matches. Please try again.';

  return (
    <Screen
      header={<BackHeader title="Sports" subtitle="Live and upcoming fixtures" />}
      contentClassName="px-4 pt-4 gap-5"
    >
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
              <Icon name={s.icon} size={15} color={on ? colors.ink : colors.inkMute} />
              <Text className={cn('text-xs font-bold', on ? 'text-ink' : 'text-ink-soft')}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Featured banner. Honest copy: the live count is real and no odds are
          promised, since this feed does not carry odds. */}
      <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
        <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
        <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20" />
        <View className="relative flex-row items-center gap-3 p-4">
          <View className="relative h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
            <Gradient colors={gradients.gold} radius={16} />
            <Icon name={activeSport?.icon ?? 'football'} size={24} color={colors.ink} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-black text-white">{activeSport?.label} matches</Text>
            <Text className="text-xs font-semibold text-white/60">
              Real fixtures. Open a match to place your bet.
            </Text>
          </View>
          {sportsQuery.isSuccess && live.length > 0 ? (
            <View className="rounded-pill bg-newg/20 px-2.5 py-1">
              <Text className="text-[11px] font-black" style={{ color: colors.neon }}>
                {live.length} live
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Launch failure banner (auth-gate routes away, so this is a real open
          failure or a missing link). */}
      {launchError ? (
        <View className="flex-row items-center gap-2.5 rounded-2xl border border-hot/40 bg-hot/10 px-3.5 py-3">
          <Icon name="alert-circle" size={18} color={colors.hot} />
          <Text className="flex-1 text-xs font-medium text-ink">{launchError}</Text>
          <Pressable onPress={() => setLaunchError(null)} hitSlop={8}>
            <Icon name="close" size={16} color={colors.inkMute} />
          </Pressable>
        </View>
      ) : null}

      {/* Body: loading -> error -> empty -> content */}
      {sportsQuery.isLoading ? (
        <View className="gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className="h-40 rounded-2xl border border-divider bg-surfaceAlt" />
          ))}
        </View>
      ) : sportsQuery.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load matches"
          message={friendlyError}
          actionLabel="Retry"
          onAction={() => sportsQuery.refetch()}
        />
      ) : live.length === 0 && upcoming.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No matches scheduled right now"
          message={`There are no ${activeSport?.label ?? ''} fixtures at the moment. Explore the full sportsbook instead.`}
          actionLabel="Open sportsbook"
          onAction={() => router.push('/games/provider?category=sportsbook')}
        />
      ) : (
        <>
          {live.length > 0 ? (
            <View className="gap-3">
              <SectionHeader title="Live now" subtitle="In-play right now" icon="flash" />
              <View className="gap-3">
                {live.map((e) => (
                  <EventCard key={e.id} event={e} launching={launchingId === e.id} onBet={() => openEvent(e)} />
                ))}
              </View>
            </View>
          ) : null}

          {upcoming.length > 0 ? (
            <View className="gap-3">
              <SectionHeader
                title="Upcoming"
                subtitle="Starting soon"
                icon="calendar"
                actionLabel="Full sportsbook"
                onAction={() => router.push('/games/provider?category=sportsbook')}
              />
              <View className="gap-3">
                {upcoming.map((e) => (
                  <EventCard key={e.id} event={e} launching={launchingId === e.id} onBet={() => openEvent(e)} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

// A single real event card: league + status meta, the two team rows, kickoff
// and provider meta, and one honest action that opens the sportsbook.
function EventCard({
  event,
  launching,
  onBet,
}: {
  event: SportEvent;
  launching: boolean;
  onBet: () => void;
}) {
  const isLive = event.status === 'live';
  const kickoff = formatKickoff(event.startsAt);
  const canBet = !!event.deepLinkUrl;

  return (
    <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
      {/* Meta row: league + status */}
      <View className="flex-row items-center justify-between border-b border-divider px-3.5 py-2.5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-mute" numberOfLines={1}>
          {event.leagueNameEn || 'Match'}
        </Text>
        {isLive ? (
          <View className="flex-row items-center gap-1.5 rounded-pill bg-hot/10 px-2 py-0.5">
            <View className="h-1.5 w-1.5 rounded-full bg-hot" />
            <Text className="text-[10px] font-black uppercase tracking-wider text-hot">Live</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1 rounded-pill bg-surfaceAlt px-2 py-0.5">
            <Icon name="time-outline" size={11} color={colors.inkMute} />
            <Text className="text-[10px] font-black uppercase tracking-wider text-ink-mute">
              {statusLabel(event.status)}
            </Text>
          </View>
        )}
      </View>

      {/* Teams */}
      <View className="gap-2.5 px-3.5 py-3">
        <TeamRow name={event.teamAName} short={event.teamAShortName} logo={event.teamALogoUrl} />
        <View className="flex-row items-center gap-2">
          <View className="h-px flex-1 bg-divider" />
          <Text className="text-[10px] font-black uppercase tracking-wider text-ink-mute">vs</Text>
          <View className="h-px flex-1 bg-divider" />
        </View>
        <TeamRow name={event.teamBName} short={event.teamBShortName} logo={event.teamBLogoUrl} />
      </View>

      {/* Kickoff + provider meta */}
      {kickoff || event.providerName ? (
        <View className="flex-row items-center justify-between px-3.5 pb-1">
          {kickoff ? (
            <View className="flex-row items-center gap-1">
              <Icon name="calendar-outline" size={12} color={colors.inkMute} />
              <Text className="text-[11px] font-semibold text-ink-mute">{kickoff}</Text>
            </View>
          ) : (
            <View />
          )}
          {event.providerName ? (
            <Text className="text-[10px] font-semibold text-ink-mute" numberOfLines={1}>
              {event.providerName}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Action */}
      <View className="px-3.5 pb-3.5 pt-2.5">
        {canBet ? (
          <Pressable
            onPress={onBet}
            disabled={launching}
            className="relative flex-row items-center justify-center gap-1.5 overflow-hidden rounded-xl py-2.5 active:opacity-90"
          >
            <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={12} />
            <Icon name={launching ? 'hourglass' : 'open-outline'} size={15} color={colors.ink} />
            <Text className="text-xs font-black uppercase tracking-wider text-ink">
              {launching ? 'Opening...' : isLive ? 'Bet now' : 'Open'}
            </Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center justify-center gap-1.5 rounded-xl border border-divider bg-surface py-2.5">
            <Icon name="lock-closed-outline" size={14} color={colors.inkMute} />
            <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Not available yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// One team row: crest (real logo, or the short-name initial as a fallback),
// full name, and the short code.
function TeamRow({ name, short, logo }: { name: string; short: string | null; logo: string | null }) {
  const initial = (short || name || '?').trim().slice(0, 1).toUpperCase();
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-surfaceAlt">
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <Text className="text-[11px] font-black text-ink-soft">{initial}</Text>
        )}
      </View>
      <Text className="flex-1 text-sm font-extrabold text-ink" numberOfLines={1}>
        {name || 'TBD'}
      </Text>
      {short ? <Text className="text-[11px] font-bold text-ink-mute">{short}</Text> : null}
    </View>
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
