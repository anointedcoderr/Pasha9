// Built by Anointed Coder.
//
// Home: the exemplar screen, now wired to live backend content top to bottom:
//   AppHeader -> real JACKPOT strip (useJackpot) -> HeroCarousel (useBanners) ->
//   live BalanceCard -> curated CATEGORY strip (real deep-links) -> Hot Games
//   (real featured provider games) -> live LiveWinnersTicker -> Promotions
//   teaser (usePromotions).
//
// Honesty is the rule: nothing here renders a fabricated number, game, or odds.
// When a real value is absent the element hides or shows a truthful empty state,
// and every tile leads to a real action (a provider launch, a real screen, or a
// truthful "browse all" fallback).

import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Screen,
  BalanceCard,
  HeroCarousel,
  CategoryCircle,
  SectionHeader,
  GameTile,
  LiveWinnersTicker,
  Badge,
  Gradient,
} from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import type { CategoryTone } from '@/lib/mock/categories';
import type { HeroBanner } from '@/lib/mock/banners';
import type { Game } from '@/lib/mock/games';
import { formatBDT } from '@/lib/format';
import { colors, gradients } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useBalance, useProviders, useProviderGames } from '@/lib/api/hooks';
import type { ProviderGame } from '@/lib/api/providers';
import { usePromotions } from '@/lib/api/promotions';
import { useRecentWinners, winnerLabel, formatRelativeTime } from '@/lib/api/leaderboard';
import { useGameLaunch } from '@/app/games/_components/useGameLaunch';
import { GameLaunchNotice } from '@/app/games/_components/GameLaunchNotice';
import {
  useBanners,
  useJackpot,
  toHeroBanner,
  bannerLink,
  jackpotHasContent,
  absoluteMediaUrl,
  type Jackpot,
} from '@/lib/api/home';

type IconName = keyof typeof Ionicons.glyphMap;

// Curated category strip. Production /api/content/categories is empty, so these
// stay curated - but each one is honest NAVIGATION into a real destination:
// a deep-link into the provider grid (mirroring the games lobby CATEGORIES) or
// the sports screen. No fake data, just real routes.
const CATEGORIES: Array<{ key: string; label: string; icon: IconName; tone: CategoryTone; href: string }> = [
  { key: 'hot', label: 'Hot', icon: 'flame', tone: 'hot', href: '/games/provider?featured=1' },
  { key: 'slots', label: 'Slots', icon: 'apps', tone: 'violet', href: '/games/provider?category=slots' },
  { key: 'live_casino', label: 'Live Casino', icon: 'tv', tone: 'blue', href: '/games/provider?category=live_casino' },
  { key: 'table', label: 'Table', icon: 'grid', tone: 'gold', href: '/games/provider?category=table' },
  { key: 'fishing', label: 'Fishing', icon: 'fish', tone: 'cyan', href: '/games/provider?category=fishing' },
  { key: 'crash', label: 'Crash', icon: 'flash', tone: 'orange', href: '/games/provider?category=crash' },
  { key: 'sports', label: 'Sports', icon: 'football', tone: 'teal', href: '/sports' },
];

// Copy of the lobby's provider-game -> tile mapping so the Home hot strip renders
// real games identically (name, brand, artwork, featured/jackpot corner flags).
function toTile(g: ProviderGame, providerName: string): Game {
  return {
    id: g.gameUid,
    name: g.displayName,
    provider: g.brandName ?? providerName,
    imageUrl: g.imageUrl ?? '',
    isHot: g.isFeatured,
    isNew: g.isJackpot,
  };
}

/** A short, honest category tag from a promo category, or null for a generic one. */
function promoTag(category: string): string | null {
  const c = category.replace(/_bonus$|_reward$|_offer$/g, '').replace(/_/g, ' ').trim();
  if (!c || c === 'other') return null;
  return c.toUpperCase();
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { data: wallet } = useBalance();

  // Live jackpot: shown only when it is enabled AND carries something real.
  const jackpotQuery = useJackpot();
  const jackpot = jackpotQuery.data;
  const showJackpot = !!jackpot && jackpotHasContent(jackpot);

  // Live banners: hidden while loading / when empty (never a mock slider).
  const bannersQuery = useBanners();
  const banners = bannersQuery.data ?? [];
  const heroBanners = banners.map(toHeroBanner);

  // Real featured provider games for the Hot strip, via the same live hooks the
  // lobby uses. Launches run through the shared money-gated launch handler.
  const providersQuery = useProviders();
  const mainProvider = providersQuery.data?.[0] ?? null;
  const providerKey = mainProvider?.providerKey ?? '';
  const featuredQuery = useProviderGames({ providerKey, featured: true, limit: 6 });
  const featuredPage = featuredQuery.data?.pages?.[0];
  const featuredGames = featuredPage?.games ?? [];
  const providerName = featuredPage?.provider.name ?? mainProvider?.name ?? '';
  const launchMinBalance =
    featuredPage?.provider.launchMinBalance ?? mainProvider?.launchMinBalance ?? 0;
  const launcher = useGameLaunch();
  const hotLoading = providersQuery.isLoading || (!!providerKey && featuredQuery.isLoading);

  // Live promotions teaser: hidden while loading / when empty.
  const promosQuery = usePromotions();
  const promos = promosQuery.data ?? [];

  // Live recent winners for the marquee. Hidden until real wins arrive, and
  // when the backend turns the feed off.
  const recentWinners = useRecentWinners();
  const tickerWinners = (recentWinners.data?.enabled === false ? [] : recentWinners.data?.winners ?? []).map(
    (w) => ({
      id: w.id,
      handle: w.handle,
      game: winnerLabel(w),
      amount: w.amount,
      timeAgo: formatRelativeTime(w.at),
    }),
  );

  // 3-column game grid sizing (screen width minus Screen's px-4, minus gaps).
  const GAP = 8;
  const tileW = (width - 32 - GAP * 2) / 3;

  function handleBannerPress(hero: HeroBanner) {
    const raw = banners.find((b) => b.id === hero.id);
    const link = raw ? bannerLink(raw) : null;
    if (!link) {
      router.push('/games');
      return;
    }
    if (link.startsWith('/')) {
      // Internal app path (e.g. /promotions).
      router.push(link as never);
      return;
    }
    // External URL: open in the in-app browser.
    WebBrowser.openBrowserAsync(link, { enableBarCollapsing: true, showTitle: true }).catch(() => {
      router.push('/games');
    });
  }

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      {showJackpot ? <JackpotStrip jackpot={jackpot} /> : null}

      {heroBanners.length > 0 ? (
        <HeroCarousel banners={heroBanners} onPress={handleBannerPress} />
      ) : null}

      <BalanceCard
        username={user?.username ?? 'Player'}
        balance={wallet?.balance ?? 0}
        bonus={wallet?.bonusBalance ?? 0}
        onDeposit={() => router.push('/deposit')}
        onWithdraw={() => router.push('/withdraw')}
        onHistory={() => router.push('/transactions')}
        onSpin={() => router.push('/rewards')}
      />

      {/* Curated category strip: real deep-links, not fake data. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingRight: 8 }}
      >
        {CATEGORIES.map((c) => (
          <CategoryCircle
            key={c.key}
            label={c.label}
            icon={c.icon}
            tone={c.tone}
            onPress={() => router.push(c.href as never)}
          />
        ))}
      </ScrollView>

      {/* Hot games: real featured provider games. */}
      <View className="gap-3">
        <SectionHeader
          title="Hot Games"
          subtitle="Featured across our providers"
          icon="flame"
          onAction={() => router.push('/games')}
        />
        {hotLoading ? (
          <View className="flex-row flex-wrap justify-between">
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={{ width: tileW, marginBottom: 12 }}
                className="aspect-square rounded-2xl border border-divider bg-surfaceAlt"
              />
            ))}
          </View>
        ) : featuredGames.length > 0 ? (
          <View className="flex-row flex-wrap justify-between">
            {featuredGames.map((g) => {
              const key = `${providerKey}:${g.gameUid}`;
              const busy = launcher.launchingKey === key;
              return (
                <View key={g.gameUid} style={{ width: tileW, marginBottom: 12 }} className="relative">
                  <GameTile
                    game={toTile(g, providerName)}
                    className="w-full"
                    onPress={() =>
                      launcher.launch({
                        providerKey,
                        gameUid: g.gameUid,
                        displayName: g.displayName,
                        launchMinBalance,
                      })
                    }
                  />
                  {busy ? (
                    <View className="absolute inset-x-0 top-0 aspect-square items-center justify-center rounded-2xl bg-black/45">
                      <Ionicons name="hourglass" size={20} color={colors.gold500} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/games')}
            className="flex-row items-center justify-between rounded-2xl border border-divider bg-paper p-4 active:opacity-90"
          >
            <View>
              <Text className="text-sm font-black text-ink">Browse all games</Text>
              <Text className="text-[11px] text-ink-mute">Explore the full provider catalog</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.gold700} />
          </Pressable>
        )}
      </View>

      {/* Launch failure / deposit prompt (shared handler). */}
      <GameLaunchNotice launch={launcher} />

      {tickerWinners.length > 0 ? <LiveWinnersTicker winners={tickerWinners} /> : null}

      {/* Promotions teaser: real promos, hidden when empty. */}
      {promos.length > 0 ? (
        <View className="gap-3">
          <SectionHeader
            title="Promotions"
            subtitle="Bonuses picked for you"
            icon="gift"
            onAction={() => router.push('/promotions')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 8 }}
          >
            {promos.map((p) => {
              const image = absoluteMediaUrl(
                p.bannerMobileUrl ?? p.bannerUrl ?? p.thumbnailUrl ?? p.backgroundUrl,
              );
              const tag = promoTag(p.category);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push('/promotions')}
                  style={{ width: width * 0.72 }}
                  className="overflow-hidden rounded-2xl border border-divider bg-paper active:opacity-90"
                >
                  <View className="relative">
                    {image ? (
                      <Image
                        source={{ uri: image }}
                        style={{ width: '100%', height: 110 }}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={{ height: 110 }} className="relative overflow-hidden">
                        <Gradient colors={gradients.goldDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                        <View className="absolute right-3 top-3">
                          <Ionicons name="gift" size={22} color="#ffffff" />
                        </View>
                      </View>
                    )}
                    {tag ? (
                      <View className="absolute left-2 top-2">
                        <Badge label={tag} variant="gold" />
                      </View>
                    ) : null}
                  </View>
                  <View className="p-3">
                    <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-ink-mute" numberOfLines={2}>
                      {p.description ?? p.effective}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </Screen>
  );
}

// Real jackpot strip. Renders the admin's real title/subtitle over the real
// background image, plus any tier that carries a real positive pool number
// (formatBDT). It NEVER shows or animates a fabricated amount: a numberless
// jackpot renders as artwork + label only.
function JackpotStrip({ jackpot }: { jackpot: Jackpot }) {
  const hasBg = !!jackpot.backgroundUrl;
  const tiers = (
    [
      { key: 'grand', fallback: 'Grand', tier: jackpot.grand },
      { key: 'major', fallback: 'Major', tier: jackpot.major },
      { key: 'mini', fallback: 'Mini', tier: jackpot.mini },
    ] as const
  )
    .filter((t) => typeof t.tier.value === 'number' && t.tier.value > 0)
    .map((t) => ({ key: t.key, label: t.tier.title ?? t.fallback, value: t.tier.value as number }));

  return (
    <View className="relative overflow-hidden rounded-2xl border border-gold-600/25">
      {hasBg ? (
        <>
          <Image
            source={{ uri: jackpot.backgroundUrl as string }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <Gradient
            colors={['rgba(11,14,20,0.88)', 'rgba(11,14,20,0.5)', 'rgba(11,14,20,0.18)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </>
      ) : null}

      <View className={cn('p-3.5', hasBg ? '' : 'bg-paper')}>
        <View className="flex-row items-center gap-2">
          <View className="h-6 w-6 items-center justify-center rounded-lg bg-gold-500">
            <Ionicons name="trophy" size={13} color={colors.ink} />
          </View>
          <Text
            className={cn(
              'text-[10px] font-black uppercase tracking-widest',
              hasBg ? 'text-white/85' : 'text-ink-mute',
            )}
          >
            Jackpot
          </Text>
        </View>

        {jackpot.title ? (
          <Text
            className={cn('mt-2 text-base font-black', hasBg ? 'text-white' : 'text-ink')}
            numberOfLines={1}
          >
            {jackpot.title}
          </Text>
        ) : null}
        {jackpot.subtitle ? (
          <Text
            className={cn('mt-0.5 text-xs', hasBg ? 'text-white/80' : 'text-ink-mute')}
            numberOfLines={2}
          >
            {jackpot.subtitle}
          </Text>
        ) : null}

        {tiers.length > 0 ? (
          <View className="mt-2.5 flex-row flex-wrap gap-2">
            {tiers.map((t) => (
              <View
                key={t.key}
                className={cn('rounded-pill px-3 py-1.5', hasBg ? 'bg-white/10' : 'bg-gold-500/12')}
              >
                <Text
                  className={cn(
                    'text-[9px] font-black uppercase tracking-wider',
                    hasBg ? 'text-white/70' : 'text-ink-mute',
                  )}
                >
                  {t.label}
                </Text>
                <Text
                  className={cn('text-sm font-black', hasBg ? 'text-white' : '')}
                  style={hasBg ? undefined : { color: colors.gold700 }}
                >
                  {formatBDT(t.value)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
