// Built by Anointed Coder.
//
// Home: the exemplar screen. Mirrors the web player homepage, top to bottom:
//   AppHeader -> JACKPOT FEED ticker -> HeroCarousel -> BalanceCard ->
//   CategoryCircle strip -> Hot Games grid -> LiveWinnersTicker ->
//   Promotions teaser.
//
// Everything reads from lib/mock and composes the shared kit in
// components/ui, so later screens can follow the same pattern.

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Screen,
  BalanceCard,
  HeroCarousel,
  CategoryCircle,
  SectionHeader,
  GameTile,
  LiveWinnersTicker,
  Badge,
} from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import {
  mockUser,
  mockWallet,
  mockBanners,
  mockCategories,
  mockHotGames,
  mockWinners,
  mockPromotions,
} from '@/lib/mock';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { useAuth } from '@/store/auth';
import { useBalance } from '@/lib/api/hooks';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { data: wallet } = useBalance();

  // 3-column game grid sizing (screen width minus Screen's px-4, minus gaps).
  const GAP = 8;
  const tileW = (width - 32 - GAP * 2) / 3;

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      <JackpotFeed pool={mockWallet.jackpotPool} />

      <HeroCarousel banners={mockBanners} onPress={() => router.push('/games')} />

      <BalanceCard
        username={user?.username ?? mockUser.username}
        balance={wallet?.balance ?? 0}
        bonus={wallet?.bonusBalance ?? 0}
        onDeposit={() => router.push('/deposit')}
        onWithdraw={() => router.push('/withdraw')}
        onHistory={() => router.push('/transactions')}
        onSpin={() => router.push('/rewards')}
      />

      {/* Category strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingRight: 8 }}
      >
        {mockCategories.map((c) => (
          <CategoryCircle
            key={c.key}
            label={c.label}
            icon={c.icon as keyof typeof Ionicons.glyphMap}
            tone={c.tone}
            onPress={() => router.push(c.route as never)}
          />
        ))}
      </ScrollView>

      {/* Hot games */}
      <View className="gap-3">
        <SectionHeader
          title="Hot Games"
          subtitle="Trending right now"
          icon="flame"
          onAction={() => router.push('/games')}
        />
        <View className="flex-row flex-wrap justify-between">
          {mockHotGames.map((g) => (
            <View key={g.id} style={{ width: tileW, marginBottom: 12 }}>
              <GameTile game={g} className="w-full" onPress={() => router.push('/games')} />
            </View>
          ))}
        </View>
      </View>

      <LiveWinnersTicker winners={mockWinners} />

      {/* Promotions teaser */}
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
          {mockPromotions.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push('/promotions')}
              style={{ width: width * 0.72 }}
              className="overflow-hidden rounded-2xl border border-divider bg-paper active:opacity-90"
            >
              <View className="relative">
                <Image
                  source={{ uri: p.imageUrl }}
                  style={{ width: '100%', height: 110 }}
                  contentFit="cover"
                  transition={200}
                />
                <View className="absolute left-2 top-2">
                  <Badge
                    label={p.tag}
                    variant={p.tag === 'HOT' ? 'hot' : p.tag === 'NEW' ? 'new' : 'gold'}
                  />
                </View>
              </View>
              <View className="p-3">
                <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
                  {p.title}
                </Text>
                <Text className="mt-0.5 text-xs text-ink-mute" numberOfLines={2}>
                  {p.subtitle}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

// JACKPOT FEED ticker line: a live-incrementing pool value with a pulsing
// dot, mirroring the web JackpotTicker.
function JackpotFeed({ pool }: { pool: number }) {
  const [value, setValue] = useState(pool);

  useEffect(() => {
    const id = setInterval(
      () => setValue((v) => v + Math.floor(Math.random() * 1300) + 200),
      1200,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-gold-600/20 bg-paper px-3 py-2">
      <View className="h-6 w-6 items-center justify-center rounded-lg bg-gold-500">
        <Ionicons name="trending-up" size={14} color={colors.ink} />
      </View>
      <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">
        Jackpot Feed
      </Text>
      <Text className="flex-1 text-right text-sm font-black" style={{ color: colors.gold700 }}>
        {formatBDT(value)}
      </Text>
      <View className="h-2 w-2 rounded-full bg-newg" />
    </View>
  );
}
