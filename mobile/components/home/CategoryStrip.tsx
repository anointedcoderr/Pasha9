// Built by Anointed Coder.
//
// CategoryStrip: the horizontal row of category shortcut cards under the wallet
// strip, mirroring the website CategorySlider
// (apps/web/components/site/CategorySlider.tsx).
//
// Data (self-fetching):
//   - useCategories() supplies the real, admin-ordered categories. When that is
//     empty (the common production case) it falls back to a curated set that
//     matches the games lobby: Hot, Slots, Live Casino, Table, Fishing, Crash,
//     Sports.
//   - useHomepageShortcuts() supplies operator icon-override image URLs keyed by
//     shortcut key; a real category's own uploaded icon (iconImageUrl) wins over
//     the shortcut override, and both win over the built-in lucide glyph.
//
// Each card is a rounded white tile with a gradient icon chip + label, exactly
// like the web. When an override image exists all chrome is dropped and the
// image renders edge to edge (transparent PNGs blend into the page). Tapping a
// card routes into the provider grid at /games/provider?category=<slug>, with
// Hot -> ?featured=1 and Sports -> /sports, matching the lobby deep-links.

import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Cherry,
  Crown,
  Dice5,
  Fish,
  Flame,
  Sparkles,
  Trophy,
  Tv2,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { Gradient } from '@/components/ui/Gradient';
import { titleCase } from '@/lib/format';
import { useCategories, useHomepageShortcuts } from '@/lib/api/homepage';

type Tone = 'gold' | 'red' | 'blue' | 'violet' | 'teal' | 'orange' | 'cyan';

// Web 3-stop tone gradients (CategorySlider TONE map), for the icon chip.
const TONE: Record<Tone, string[]> = {
  gold: ['#FCD34D', '#FBBF24', '#D97706'],
  red: ['#FB7185', '#EF4444', '#EA580C'],
  blue: ['#38BDF8', '#3B82F6', '#1D4ED8'],
  violet: ['#E879F9', '#A855F7', '#4338CA'],
  teal: ['#5EEAD4', '#14B8A6', '#047857'],
  orange: ['#FDBA74', '#F97316', '#DC2626'],
  cyan: ['#67E8F9', '#06B6D4', '#1D4ED8'],
};

interface CuratedItem {
  slug: string;
  labelEn: string;
  labelBn: string;
  shortcutKey: string;
  icon: LucideIcon;
  tone: Tone;
}

// Curated fallback matching the mobile games lobby (mobile/app/(tabs)/index.tsx).
const CURATED: CuratedItem[] = [
  { slug: 'hot', labelEn: 'Hot', labelBn: 'হট', shortcutKey: 'hot', icon: Flame, tone: 'red' },
  { slug: 'slots', labelEn: 'Slots', labelBn: 'স্লট', shortcutKey: 'slot', icon: Cherry, tone: 'violet' },
  { slug: 'live_casino', labelEn: 'Live Casino', labelBn: 'লাইভ ক্যাসিনো', shortcutKey: 'casino', icon: Tv2, tone: 'blue' },
  { slug: 'table', labelEn: 'Table', labelBn: 'টেবিল', shortcutKey: 'table', icon: Dice5, tone: 'gold' },
  { slug: 'fishing', labelEn: 'Fishing', labelBn: 'ফিশিং', shortcutKey: 'fishing', icon: Fish, tone: 'cyan' },
  { slug: 'crash', labelEn: 'Crash', labelBn: 'ক্র্যাশ', shortcutKey: 'crash', icon: Zap, tone: 'orange' },
  { slug: 'sports', labelEn: 'Sports', labelBn: 'স্পোর্টস', shortcutKey: 'sports', icon: Trophy, tone: 'teal' },
];

/** Map a category slug / iconKey to a lucide glyph + tone, mirroring the web. */
function resolveGlyph(slug: string, iconKey: string | null): { icon: LucideIcon; tone: Tone } {
  const k = (iconKey || slug || '').toLowerCase();
  if (k.includes('jackpot')) return { icon: Crown, tone: 'gold' };
  if (k.includes('hot') || k.includes('flame')) return { icon: Flame, tone: 'red' };
  if (k.includes('slot') || k.includes('cherry')) return { icon: Cherry, tone: 'violet' };
  if (k.includes('casino') || k.includes('tv')) return { icon: Tv2, tone: 'blue' };
  if (k.includes('crash') || k.includes('zap') || k.includes('flash')) return { icon: Zap, tone: 'orange' };
  if (k.includes('sport') || k.includes('cricket') || k.includes('trophy')) return { icon: Trophy, tone: 'teal' };
  if (k.includes('fish')) return { icon: Fish, tone: 'cyan' };
  if (k.includes('table') || k.includes('dice')) return { icon: Dice5, tone: 'gold' };
  return { icon: Sparkles, tone: 'gold' };
}

/** The in-app route for a category slug (Hot -> featured, Sports -> /sports). */
function hrefForSlug(slug: string): string {
  const s = slug.toLowerCase();
  if (s === 'hot') return '/games/provider?featured=1';
  if (s === 'sports' || s === 'sport') return '/sports';
  return `/games/provider?category=${slug}`;
}

interface Resolved {
  slug: string;
  label: string;
  image: string | null;
  icon: LucideIcon;
  tone: Tone;
}

export function CategoryStrip() {
  const router = useRouter();
  const { data: categories } = useCategories();
  const { data: shortcuts } = useHomepageShortcuts();
  const overrides = shortcuts ?? {};

  const items: Resolved[] =
    categories && categories.length > 0
      ? categories.map((c) => {
          const g = resolveGlyph(c.slug, c.iconKey);
          return {
            slug: c.slug,
            label: c.nameEn || titleCase(c.slug),
            image: c.iconImageUrl ?? overrides[c.slug] ?? null,
            icon: g.icon,
            tone: g.tone,
          };
        })
      : CURATED.map((c) => ({
          slug: c.slug,
          label: c.labelEn,
          image: overrides[c.shortcutKey] ?? null,
          icon: c.icon,
          tone: c.tone,
        }));

  const go = (slug: string) => router.push(hrefForSlug(slug) as never);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingRight: 8 }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        // Operator icon override: drop all chrome and render the image edge to
        // edge, then the label below (web custom-image branch).
        if (item.image) {
          return (
            <Pressable
              key={item.slug}
              onPress={() => go(item.slug)}
              style={{ width: 80, height: 94 }}
              className="items-stretch active:opacity-90"
            >
              <View className="flex-1 overflow-hidden">
                <Image
                  source={{ uri: item.image }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </View>
              <Text className="pb-1 text-center text-[11px] font-bold leading-tight text-brand-ink" numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={item.slug}
            onPress={() => go(item.slug)}
            style={{ width: 80, height: 94, borderRadius: 16 }}
            className="items-center justify-end overflow-hidden border border-brand-divider bg-brand-paper px-2 pb-2 pt-3 active:opacity-90"
          >
            <View className="relative mb-1.5 h-12 w-12 items-center justify-center overflow-hidden rounded-xl">
              <Gradient colors={TONE[item.tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={12} />
              <Icon size={20} color="#FFFFFF" strokeWidth={2} />
            </View>
            <Text className="text-center text-[11px] font-bold leading-tight text-brand-ink" numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
