// Built by Anointed Coder.
//
// Shared provider (aggregator) games grid. Powers all three grid surfaces
// (the full provider lobby, Slots, and the dynamic /games/[category] route);
// each screen is a thin wrapper that fixes the category / brand / featured
// filter and passes a title. Mirrors the web /games/provider lobby:
//   real GET /api/providers/[key]/games with search + category + brand filters,
//   brand chips from counts.byBrand, category chips with counts.byCategory,
//   a responsive GameTile grid, Load-more via the infinite query, and a tap
//   that runs the shared launch handler (auth-gate + money-gate + in-app browser).

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, GameTile, ChipToggle, TextField, EmptyState } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useBalance, useProviders, useProviderGames } from '@/lib/api/hooks';
import type { Game } from '@/lib/mock/games';
import type { ProviderGame } from '@/lib/api/providers';
import { useGameLaunch } from './useGameLaunch';
import { GameLaunchNotice } from './GameLaunchNotice';

const PAGE_SIZE = 24;

// Category chips (web parity). '' == All. `slug` maps to the backend category
// value; the label is what the chip shows.
const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'slots', label: 'Slots' },
  { key: 'live_casino', label: 'Live Casino' },
  { key: 'table', label: 'Table' },
  { key: 'fishing', label: 'Fishing' },
  { key: 'crash', label: 'Crash' },
  { key: 'flash', label: 'Fast' },
  { key: 'sportsbook', label: 'Sportsbook' },
];

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

export interface ProviderGridProps {
  title: string;
  subtitle?: string;
  /** Locks the category (Slots screen, category route); hides the category chips. */
  fixedCategory?: string;
  /** Locks the brand filter (hides the brand chips). */
  fixedBrand?: string;
  /** Seeds the (still switchable) category chip from a deep link. */
  initialCategory?: string;
  /** Seeds the (still switchable) brand chip from a deep link. */
  initialBrand?: string;
  featured?: boolean;
  jackpot?: boolean;
  initialQuery?: string;
  initialProviderKey?: string;
}

export function ProviderGrid({
  title,
  subtitle,
  fixedCategory,
  fixedBrand,
  initialCategory,
  initialBrand,
  featured,
  jackpot,
  initialQuery,
  initialProviderKey,
}: ProviderGridProps) {
  const { width } = useWindowDimensions();
  const providersQuery = useProviders();
  const providers = providersQuery.data ?? [];

  // Resolve the active provider: an explicit deep-link param, else the single
  // Live provider, else the first. A selector appears only when there are 2+.
  const [providerKey, setProviderKey] = useState<string>(initialProviderKey ?? '');
  useEffect(() => {
    // Nothing to seed or reconcile until the provider list has loaded.
    if (providers.length === 0) return;

    // A current selection that IS a known provider is valid: leave it alone.
    if (providerKey && providers.some((p) => p.providerKey === providerKey)) return;

    // Otherwise the selection is unseeded, or set to a key that is not in the
    // loaded list (e.g. a stale or bad deep link that would make
    // useProviderGames error forever). Re-select the deep-linked key only when
    // it is valid, else fall back to the first provider.
    if (initialProviderKey && providers.some((p) => p.providerKey === initialProviderKey)) {
      setProviderKey(initialProviderKey);
    } else {
      setProviderKey(providers[0].providerKey);
    }
  }, [providers, providerKey, initialProviderKey]);

  const [category, setCategory] = useState<string>(fixedCategory ?? initialCategory ?? '');
  const [brand, setBrand] = useState<string>(fixedBrand ?? initialBrand ?? '');
  const [q, setQ] = useState<string>(initialQuery ?? '');
  const [debouncedQ, setDebouncedQ] = useState<string>(initialQuery ?? '');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const effectiveCategory = fixedCategory ?? category;
  const effectiveBrand = fixedBrand ?? brand;

  const gamesQuery = useProviderGames({
    providerKey,
    q: debouncedQ,
    category: effectiveCategory,
    brand: effectiveBrand,
    featured,
    jackpot,
    limit: PAGE_SIZE,
  });

  const pages = gamesQuery.data?.pages ?? [];
  const first = pages[0];
  const providerName = first?.provider.name ?? '';
  const launchMinBalance = first?.provider.launchMinBalance ?? 0;
  const games = useMemo(() => pages.flatMap((p) => p.games), [pages]);
  const total = first?.counts.total ?? 0;
  const byCategory = first?.counts.byCategory ?? {};
  const byBrand = first?.counts.byBrand ?? [];

  const balanceQuery = useBalance();
  const balance = balanceQuery.data?.balance ?? 0;

  const launcher = useGameLaunch();

  const cols = width >= 720 ? 5 : width >= 520 ? 4 : 3;
  const GAP = 10;
  const tileW = (width - 32 - GAP * (cols - 1)) / cols;

  const categoryChips = useMemo(
    () => CATEGORIES.map((c) => ({ key: c.key, label: `${c.label}${c.key && byCategory[c.key] ? ` ${byCategory[c.key]}` : ''}` })),
    [byCategory],
  );

  const brandChips = useMemo(
    () => [{ key: '', label: 'All Brands' }, ...byBrand.map((b) => ({ key: b.brandKey, label: `${b.brandName} ${b.count}` }))],
    [byBrand],
  );

  const providerChips = useMemo(
    () => providers.map((p) => ({ key: p.providerKey, label: p.name })),
    [providers],
  );

  const loadingFirst =
    providersQuery.isLoading || (!!providerKey && gamesQuery.isLoading && !gamesQuery.isFetchingNextPage);
  const noProviders = providersQuery.isSuccess && providers.length === 0;

  return (
    <Screen
      header={<GridHeader title={title} count={total} balance={balance} />}
      contentClassName="px-4 pt-3 gap-4"
    >
      {noProviders ? (
        <EmptyState
          icon="business"
          title="No providers live yet"
          message="Provider games will appear here once a studio is activated. Meanwhile, try Pasha Originals."
        />
      ) : (
        <>
          {/* Search */}
          <TextField
            icon="search"
            placeholder="Search game name or id"
            value={q}
            onChangeText={setQ}
          />

          {/* Provider selector (only when more than one is Live) */}
          {providerChips.length > 1 ? (
            <ChipToggle options={providerChips} value={providerKey} onChange={setProviderKey} scroll />
          ) : null}

          {/* Category chips (hidden when the screen fixes the category) */}
          {!fixedCategory ? (
            <ChipToggle options={categoryChips} value={category} onChange={setCategory} scroll />
          ) : null}

          {/* Brand chips (hidden when the screen fixes the brand) */}
          {!fixedBrand && byBrand.length > 0 ? (
            <ChipToggle options={brandChips} value={brand} onChange={setBrand} scroll />
          ) : null}

          {subtitle ? <Text className="text-xs text-ink-mute">{subtitle}</Text> : null}

          {/* Launch failure / deposit prompt */}
          <GameLaunchNotice launch={launcher} />

          {providersQuery.isError ? (
            <EmptyState
              icon="cloud-offline"
              title="Could not load providers"
              message="Something went wrong reaching the game providers. Please try again."
              actionLabel="Retry"
              onAction={() => providersQuery.refetch()}
            />
          ) : loadingFirst ? (
            <View className="flex-row flex-wrap" style={{ gap: GAP }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View
                  key={i}
                  style={{ width: tileW }}
                  className="aspect-square rounded-2xl border border-divider bg-surfaceAlt"
                />
              ))}
            </View>
          ) : gamesQuery.isError ? (
            <EmptyState
              icon="cloud-offline"
              title="Could not load games"
              message="Something went wrong reaching the game catalog. Please try again."
              actionLabel="Retry"
              onAction={() => gamesQuery.refetch()}
            />
          ) : games.length === 0 && providersQuery.isSuccess ? (
            <EmptyState
              icon="search"
              title="No games found"
              message="No games match these filters. Try another category, brand or search term."
            />
          ) : (
            <>
              <View className="flex-row flex-wrap" style={{ gap: GAP }}>
                {games.map((g) => {
                  const key = `${providerKey}:${g.gameUid}`;
                  const busy = launcher.launchingKey === key;
                  return (
                    <View key={g.gameUid} style={{ width: tileW }} className="relative">
                      <GameTile
                        game={toTile(g, providerName)}
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
                          <ActivityIndicator color={colors.gold500} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {gamesQuery.hasNextPage ? (
                <Pressable
                  onPress={() => gamesQuery.fetchNextPage()}
                  disabled={gamesQuery.isFetchingNextPage}
                  className={cn(
                    'mt-1 h-12 flex-row items-center justify-center gap-2 rounded-pill border border-gold-600/40 bg-gold-500/10 active:opacity-90',
                    gamesQuery.isFetchingNextPage && 'opacity-60',
                  )}
                >
                  {gamesQuery.isFetchingNextPage ? (
                    <ActivityIndicator color={colors.gold700} size="small" />
                  ) : (
                    <Ionicons name="chevron-down" size={16} color={colors.gold700} />
                  )}
                  <Text className="text-xs font-black uppercase tracking-wider text-gold-700">
                    {gamesQuery.isFetchingNextPage
                      ? 'Loading'
                      : `Load more (${Math.max(0, total - games.length)})`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function GridHeader({ title, count, balance }: { title: string; count: number; balance: number }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between border-b border-divider bg-paper px-3 py-2.5">
      <View className="flex-row items-center gap-1.5">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View>
          <Text className="text-base font-black tracking-tight text-ink">{title}</Text>
          <Text className="text-[11px] text-ink-mute">{count} games</Text>
        </View>
      </View>
      <Pressable
        onPress={() => router.push('/deposit')}
        className="flex-row items-center gap-1 rounded-pill border border-gold-600/30 bg-gold-500/15 py-1.5 pl-2 pr-1.5 active:opacity-90"
      >
        <Ionicons name="wallet" size={14} color={colors.gold700} />
        <Text className="text-[11px] font-black text-ink">{formatBDT(balance)}</Text>
        <View className="h-5 w-5 items-center justify-center rounded-full bg-gold-500">
          <Ionicons name="add" size={14} color={colors.ink} />
        </View>
      </Pressable>
    </View>
  );
}
