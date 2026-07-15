// Built by Anointed Coder.
//
// HomeHero: the full-bleed banner carousel at the very top of Home, mirroring
// the website HeroSlider (apps/web/components/site/HeroSlider.tsx). It is
// self-fetching via useBanners(): a paged, auto-advancing slider with dot
// indicators over a dark brand-ink card with rounded corners and a gold hairline
// border.
//
// Parity notes with the web:
//   - Textless art banners (the common production case: operators upload a full
//     art banner with no title/subtitle/CTA) render the image contain, edge to
//     edge, with NO dim overlay, and the whole slide is the tap target.
//   - Text banners render the image cover under two dim gradients, with a badge
//     pill, a warm-gold title (RN cannot clip a gradient to text, so a solid
//     warm gold approximates it), a subtitle and a gold CTA pill.
//   - A video banner shows its poster still (imageUrl ?? posterUrl) with a play
//     affordance; tapping opens the media (videoUrl, else the banner link) in
//     the in-app browser.
//   - An internal banner link routes in-app; an external link opens via
//     expo-web-browser; a linkless image banner is a no-op.
//
// Honesty: the slider hides itself while loading and when there are no live
// banners (getBanners already drops any banner without a real image). No mock
// slides are ever shown.

import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Play, Sparkles } from 'lucide-react-native';
import { Gradient } from '@/components/ui/Gradient';
import { colors, gradients } from '@/lib/theme';
import { useBanners, bannerImageUrl, type Banner } from '@/lib/api/home';

const H_PAD = 16; // matches Screen's px-4 content padding
const ROTATE_MS = 6500; // web IMAGE_ROTATE_MS

/** English-first display copy for a banner (falls back to the native copy). */
function displayText(b: Banner): { title: string; subtitle: string; cta: string } {
  const title = (b.titleEn?.trim() || b.title?.trim() || '');
  const subtitle = (b.subtitleEn?.trim() || b.subtitle?.trim() || '');
  const cta = b.ctaLabel?.trim() || '';
  return { title, subtitle, cta };
}

/** A banner with no title, subtitle or CTA is a media-only slide. */
function isTextless(b: Banner): boolean {
  const { title, subtitle, cta } = displayText(b);
  return title.length === 0 && subtitle.length === 0 && cta.length === 0;
}

export function HomeHero() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const interacting = useRef(false);
  const [index, setIndex] = useState(0);

  const { data, isLoading } = useBanners();
  const banners = data ?? [];

  const cardW = width - H_PAD * 2;
  // Textless art banners lock to a 2:1 shape (web aspect-[2/1]); when any slide
  // carries text the card grows so the headline + CTA fit.
  const anyText = banners.some((b) => !isTextless(b));
  const cardH = Math.round(cardW * (anyText ? 0.6 : 0.5));

  // Auto-advance. Skipped for a single slide and paused while the user is
  // actively dragging.
  useEffect(() => {
    if (banners.length <= 1 || cardW <= 0) return;
    const id = setInterval(() => {
      if (interacting.current) return;
      setIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * cardW, animated: true });
        return next;
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [banners.length, cardW]);

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (cardW <= 0) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / cardW));
  }

  function open(b: Banner) {
    const isVideo = b.mediaType === 'video';
    const target = isVideo ? (b.videoUrl ?? b.link) : b.link;
    if (!target) return; // linkless image banner: no-op
    if (target.startsWith('/')) {
      router.push(target as never);
      return;
    }
    WebBrowser.openBrowserAsync(target, { enableBarCollapsing: true, showTitle: true }).catch(() => {});
  }

  // Hidden while loading and when there are no live banners.
  if (isLoading || banners.length === 0) return null;

  return (
    <View
      style={{
        height: cardH,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,204,0,0.20)',
        backgroundColor: colors.ink,
      }}
      className="relative overflow-hidden"
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          interacting.current = true;
        }}
        onScrollEndDrag={() => {
          interacting.current = false;
        }}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {banners.map((b) => (
          <HeroSlide key={b.id} banner={b} width={cardW} height={cardH} onPress={() => open(b)} />
        ))}
      </ScrollView>

      {/* Slide indicator dots (inside the card, bottom-center) */}
      {banners.length > 1 ? (
        <View className="absolute inset-x-0 bottom-3 flex-row items-center justify-center gap-1.5">
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={{ height: 6, width: i === index ? 32 : 16, borderRadius: 999 }}
              className={i === index ? 'bg-brand-yellow-500' : 'bg-white/30'}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function HeroSlide({
  banner,
  width,
  height,
  onPress,
}: {
  banner: Banner;
  width: number;
  height: number;
  onPress: () => void;
}) {
  const { title, subtitle, cta } = displayText(banner);
  const textless = isTextless(banner);
  const isVideo = banner.mediaType === 'video';
  const uri = bannerImageUrl(banner) ?? '';

  return (
    <Pressable onPress={onPress} style={{ width, height }} className="relative active:opacity-95">
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit={textless ? 'contain' : 'cover'}
        transition={250}
        cachePolicy="memory-disk"
      />

      {/* Text slides keep the headline legible over busy art. Textless slides
          show the artwork exactly as designed, with no wash. */}
      {!textless ? (
        <>
          <Gradient
            colors={['rgba(0,0,0,0.80)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Gradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.60)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          <View className="absolute inset-0 justify-center px-5 py-6">
            <View className="max-w-[86%]">
              <View
                className="flex-row items-center gap-1.5 self-start rounded-pill px-3 py-1"
                style={{ backgroundColor: 'rgba(255,204,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,204,0,0.30)' }}
              >
                <Sparkles size={12} color={colors.gold300} strokeWidth={2} />
                <Text className="text-[10px] font-black uppercase tracking-[2px]" style={{ color: colors.gold300 }}>
                  Pasha 9
                </Text>
              </View>

              {title ? (
                <Text className="mt-2.5 text-2xl font-black leading-tight" style={{ color: '#FFE9A8' }} numberOfLines={2}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text className="mt-2 text-[13px] leading-snug text-white/85" numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}

              {cta ? (
                <View className="mt-4 flex-row">
                  <View className="relative overflow-hidden rounded-pill">
                    <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
                    <View className="flex-row items-center gap-1.5 px-5 py-2.5">
                      <Text className="text-sm font-extrabold text-brand-ink">{cta}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </>
      ) : null}

      {/* Video play affordance over the poster still */}
      {isVideo ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <Play size={26} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
