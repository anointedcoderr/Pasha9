// Built by Anointed Coder.
//
// SportsFixturesCarousel: the homepage fixtures rail, ported from the web
// SportsFixturesCarousel (apps/web/components/site/SportsFixturesCarousel.tsx).
// Self-fetches the real fixture feed with useSportsEvents() (public read,
// cached ~60s) and renders each event as a horizontal card: a gold header bar
// with a live / upcoming status pill and the league, the kickoff datetime, two
// team rows (crest or a 3-letter fallback), and a "Bet now" footer.
//
// Tapping a fixture opens its deepLinkUrl through the same gate the game launch
// uses: signed-out players route to /auth/login, signed-in players open the
// sportsbook link in the in-app browser. A fixture with no deep link falls back
// to the /sports screen.
//
// Quiet by contract: renders nothing while loading, on error, or when empty.

import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronRight, Flag } from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/lib/theme';
import { useAuth } from '@/store/auth';
import { useSportsEvents, type SportEvent } from '@/lib/api/sports';

const CHIP_GRADIENT = ['#FCD34D', '#F59E0B'] as const;
const CHIP_INK = '#3A1F00';
// Gold header bar (web from-brand-yellow-400 via-500 to-[#F5B400]).
const HEADER_GRADIENT = ['#FFD633', '#FFCC00', '#F5B400'] as const;

/** Kickoff datetime, mirroring the web en-GB 24h format. */
function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }
}

export function SportsFixturesCarousel() {
  const router = useRouter();
  const { status } = useAuth();
  const { data, isLoading, isError } = useSportsEvents();

  // Quiet while loading / on error, and hidden when there are no fixtures.
  if (isLoading || isError) return null;
  const events = data ?? [];
  if (events.length === 0) return null;

  const openFixture = (ev: SportEvent) => {
    if (!ev.deepLinkUrl) {
      router.push('/sports');
      return;
    }
    if (status !== 'authed') {
      router.push('/auth/login');
      return;
    }
    WebBrowser.openBrowserAsync(ev.deepLinkUrl, { enableBarCollapsing: true, showTitle: true }).catch(
      () => router.push('/sports'),
    );
  };

  return (
    <View className="gap-3">
      {/* Header: gold Flag chip + title + accent bar + subtitle. */}
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
          <Gradient colors={CHIP_GRADIENT} radius={12} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
          <Flag size={16} color={CHIP_INK} strokeWidth={2.25} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="shrink text-lg font-extrabold text-brand-ink" numberOfLines={1}>
              Upcoming Fixtures
            </Text>
            <View className="h-[2px] w-10 overflow-hidden rounded-full">
              <Gradient colors={['rgba(255,204,0,0.8)', 'rgba(255,204,0,0)']} />
            </View>
          </View>
          <Text className="text-xs text-brand-inkMute" numberOfLines={1}>
            Live and upcoming sports fixtures
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 12 }}
      >
        {events.map((ev) => {
          const league = ev.leagueNameEn ?? '';
          const isLive = ev.status === 'live';
          return (
            <Pressable
              key={ev.id}
              onPress={() => openFixture(ev)}
              style={{ width: 288 }}
              className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper active:opacity-90"
            >
              {/* Gold header bar with status pill + league. */}
              <View className="relative flex-row items-center justify-between gap-2 px-3 py-2">
                <Gradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
                <View
                  className={cn(
                    'flex-row items-center gap-1 rounded-full px-2 py-0.5',
                    isLive ? 'bg-hot' : 'bg-black/85',
                  )}
                >
                  {isLive ? <View className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                    {isLive ? 'Live' : 'Upcoming'}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ color: CHIP_INK }}
                  className="flex-1 text-right text-[11px] font-bold uppercase tracking-wider"
                >
                  {league}
                </Text>
              </View>

              {/* Body: kickoff, two team rows, provider + Bet now. */}
              <View className="gap-2 px-3 py-3">
                <Text className="text-[11px] font-semibold text-brand-inkMute">
                  {formatDateTime(ev.startsAt)}
                </Text>
                <TeamRow name={ev.teamAName} shortName={ev.teamAShortName} logoUrl={ev.teamALogoUrl} />
                <TeamRow name={ev.teamBName} shortName={ev.teamBShortName} logoUrl={ev.teamBLogoUrl} />
                <View className="mt-1 flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-[10px] uppercase tracking-wider text-brand-inkMute" numberOfLines={1}>
                    {ev.providerName ?? 'Sportsbook'}
                  </Text>
                  <View className="h-7 flex-row items-center gap-1 rounded-full bg-brand-ink px-3">
                    <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white">
                      Bet now
                    </Text>
                    <ChevronRight size={12} color={colors.paper} strokeWidth={2.5} />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TeamRow({
  name,
  shortName,
  logoUrl,
}: {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-brand-divider bg-brand-surface">
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <Text className="text-[8px] font-bold uppercase tracking-wider text-brand-inkMute">
            {(shortName ?? name).slice(0, 3)}
          </Text>
        )}
      </View>
      <Text className="flex-1 text-sm font-semibold text-brand-ink" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}
