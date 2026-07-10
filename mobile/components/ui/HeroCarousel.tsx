// Built by Anointed Coder.
//
// HeroCarousel: a horizontally paged banner slider with page dots. Each
// slide is a dark gradient banner card (image + wash + title/subtitle +
// CTA). Snaps one card at a time and tracks the active dot.
//
// Props:
//   banners   HeroBanner[]              slides (required)
//   onPress   (b: HeroBanner) => void   tap / CTA handler
//   height    number                    card height override
//   className string

import { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gradient } from './Gradient';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import type { BannerAccent, HeroBanner } from '@/lib/mock/banners';

const H_PAD = 16; // matches Screen's px-4
const GAP = 12;

const ACCENT: Record<BannerAccent, string> = {
  gold: colors.gold500,
  blue: colors.blue500,
  hot: colors.hot,
  neon: colors.neon,
  royal: colors.gold600,
};

export interface HeroCarouselProps {
  banners: HeroBanner[];
  onPress?: (banner: HeroBanner) => void;
  height?: number;
  className?: string;
}

export function HeroCarousel({ banners, onPress, height, className }: HeroCarouselProps) {
  const { width } = useWindowDimensions();
  const cardW = width - H_PAD * 2;
  const cardH = height ?? Math.round(cardW * 0.52);
  const [index, setIndex] = useState(0);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    setIndex(Math.round(x / (cardW + GAP)));
  }

  return (
    <View className={cn('', className)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        contentContainerStyle={{ paddingRight: H_PAD }}
      >
        {banners.map((b, i) => (
          <Pressable
            key={b.id}
            onPress={() => onPress?.(b)}
            style={{ width: cardW, height: cardH, marginRight: i === banners.length - 1 ? 0 : GAP }}
            className="relative overflow-hidden rounded-2xl border border-white/10 active:opacity-95"
          >
            <Image
              source={{ uri: b.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
            />
            {/* Legibility wash: dark from the left */}
            <Gradient
              colors={['rgba(11,14,20,0.92)', 'rgba(11,14,20,0.55)', 'rgba(11,14,20,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {/* Accent hairline */}
            <View
              className="absolute left-0 top-0 h-full w-1"
              style={{ backgroundColor: ACCENT[b.accent] }}
            />

            <View className="absolute inset-0 justify-center p-4">
              <View className="max-w-[80%]">
                <Text className="text-lg font-black text-white" numberOfLines={2}>
                  {b.title}
                </Text>
                <Text className="mt-1 text-xs text-white/80" numberOfLines={2}>
                  {b.subtitle}
                </Text>
                <View className="mt-3 flex-row">
                  <View
                    className="flex-row items-center gap-1 rounded-pill px-3 py-1.5"
                    style={{ backgroundColor: ACCENT[b.accent] }}
                  >
                    <Text className="text-xs font-extrabold text-ink">{b.ctaLabel}</Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.ink} />
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Dots */}
      <View className="mt-2.5 flex-row items-center justify-center gap-1.5">
        {banners.map((b, i) => (
          <View
            key={b.id}
            className={cn(
              'h-1.5 rounded-full',
              i === index ? 'w-5 bg-gold-500' : 'w-1.5 bg-divider',
            )}
          />
        ))}
      </View>
    </View>
  );
}
