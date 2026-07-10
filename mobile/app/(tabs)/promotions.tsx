// Built by Anointed Coder.
//
// Promotions: a filter chip row (All / Deposit / Cashback / Referral / VIP)
// above a scrollable list of premium promo cards. Each card carries a banner
// image, a status tag, title, short description, a Claim / Details action
// pair and a terms line. Cards reuse mockPromotions from @/lib/mock, enriched
// locally with a category, terms and call-to-action for the filter row.

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Screen,
  SectionHeader,
  ChipToggle,
  Badge,
  Pill,
  PrimaryButton,
  GhostButton,
  EmptyState,
} from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { mockPromotions, type Promotion } from '@/lib/mock';
import { colors } from '@/lib/theme';

type PromoCategory = 'deposit' | 'cashback' | 'referral' | 'vip';

interface PromoCard extends Promotion {
  category: PromoCategory;
  terms: string;
  cta: string;
}

// Enrich the shared mock promos with a category + terms so the filter row and
// card footers have something real to render.
const AUGMENT: Record<string, Pick<PromoCard, 'category' | 'terms' | 'cta'>> = {
  promo_first: { category: 'deposit', terms: '35x wagering. Min deposit BDT 500.', cta: 'Claim' },
  promo_cashback: { category: 'cashback', terms: 'Paid every Monday. No wagering.', cta: 'Opt in' },
  promo_reload: { category: 'deposit', terms: 'Once per day. Max bonus BDT 3,000.', cta: 'Claim' },
  promo_referral: { category: 'referral', terms: 'Friend must deposit and play.', cta: 'Invite' },
};

const EXTRA: PromoCard[] = [
  {
    id: 'promo_vip_reload',
    title: 'VIP Weekend Reload 30%',
    subtitle: 'Gold tier and up get a boosted weekend top up',
    tag: 'VIP',
    imageUrl: 'https://picsum.photos/seed/pasha-promo-vip1/600/360',
    category: 'vip',
    terms: 'Gold tier or higher. 20x wagering.',
    cta: 'Claim',
  },
  {
    id: 'promo_vip_birthday',
    title: 'Birthday Bonus',
    subtitle: 'A gift on your special day, scaled to your VIP tier',
    tag: 'VIP',
    imageUrl: 'https://picsum.photos/seed/pasha-promo-vip2/600/360',
    category: 'vip',
    terms: 'Auto credited within 24 hours.',
    cta: 'Details',
  },
  {
    id: 'promo_lossback',
    title: 'Daily Loss-back 10%',
    subtitle: 'Get a slice of yesterday back, win or lose',
    tag: 'NEW',
    imageUrl: 'https://picsum.photos/seed/pasha-promo-lb/600/360',
    category: 'cashback',
    terms: 'Credited daily at 12:00. Min loss BDT 200.',
    cta: 'Opt in',
  },
];

const PROMOS: PromoCard[] = [
  ...mockPromotions.map((p) => ({
    ...p,
    ...(AUGMENT[p.id] ?? { category: 'deposit' as PromoCategory, terms: 'Terms apply.', cta: 'Claim' }),
  })),
  ...EXTRA,
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'cashback', label: 'Cashback' },
  { key: 'referral', label: 'Referral' },
  { key: 'vip', label: 'VIP' },
];

function tagVariant(tag: Promotion['tag']) {
  return tag === 'HOT' ? 'hot' : tag === 'NEW' ? 'new' : 'gold';
}

export default function PromotionsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const list = useMemo(
    () => (filter === 'all' ? PROMOS : PROMOS.filter((p) => p.category === filter)),
    [filter],
  );

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      <SectionHeader
        title="Promotions"
        subtitle="Bonuses picked for you"
        icon="gift"
      />

      <ChipToggle options={FILTERS} value={filter} onChange={setFilter} scroll />

      <View className="gap-4">
        {list.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            title="No promotions here yet"
            message="Try a different filter. Fresh offers drop every week."
          />
        ) : (
          list.map((p) => (
            <View
              key={p.id}
              className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5"
            >
              <View className="relative">
                <Image
                  source={{ uri: p.imageUrl }}
                  style={{ width: '100%', height: 140 }}
                  contentFit="cover"
                  transition={200}
                />
                <View className="absolute left-2.5 top-2.5">
                  <Badge label={p.tag} variant={tagVariant(p.tag)} />
                </View>
                <View className="absolute right-2.5 top-2.5">
                  <Pill label={p.category.toUpperCase()} tone="dark" />
                </View>
              </View>

              <View className="gap-3 p-4">
                <View>
                  <Text className="text-base font-extrabold text-ink" numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text className="mt-1 text-sm text-ink-mute" numberOfLines={2}>
                    {p.subtitle}
                  </Text>
                </View>

                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="shield-checkmark-outline" size={13} color={colors.inkMute} />
                  <Text className="flex-1 text-[11px] text-ink-mute" numberOfLines={1}>
                    {p.terms}
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <PrimaryButton
                    label={p.cta}
                    size="sm"
                    className="flex-1"
                    onPress={() => router.push('/deposit')}
                  />
                  <GhostButton
                    label="Details"
                    size="sm"
                    className="flex-1"
                    onPress={() => router.push('/legal')}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}
