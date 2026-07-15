// Built by Anointed Coder.
//
// HomepageVideoCarousel: a horizontal deck of promo-video cards, mirroring
// apps/web/components/site/HomepageVideoCarousel.tsx. Self-fetching via
// useHomepageVideos(). Each card shows the video thumbnail (or the YouTube
// poster derived from the video id) with a play overlay plus title/subtitle;
// tapping opens the YouTube watch page or the uploaded video URL in the in-app
// browser (expo-web-browser) rather than pulling in a native video player.
//
// States: hidden while loading, on error, and when the deck is empty. A row
// with neither a thumbnail nor a playable URL is dropped; if that empties the
// deck the section hides.

import { ScrollView, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { PlayCircle } from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { useHomepageVideos, type HomepageVideo } from '@/lib/api/homepage';

const H_PAD = 16; // matches the Screen px-4 gutter
const GAP = 12;

// Same thumbnail helper the web uses (lib/homepage/youtube.ts): the "hq"
// default frame is available for every public YouTube video.
function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

interface ResolvedVideo {
  id: string;
  title: string;
  subtitle: string | null;
  thumbnail: string | null;
  watchUrl: string | null;
}

function resolve(v: HomepageVideo): ResolvedVideo {
  const isYouTube = v.sourceType === 'youtube' && !!v.youtubeVideoId;
  const thumbnail = v.thumbnailUrl ?? (isYouTube ? youtubeThumbnail(v.youtubeVideoId as string) : null);
  const watchUrl = isYouTube
    ? `https://www.youtube.com/watch?v=${v.youtubeVideoId}`
    : v.videoUrl ?? v.ctaUrl ?? null;
  return {
    id: v.id,
    title: (v.titleEn && v.titleEn.trim()) || (v.titleBn && v.titleBn.trim()) || '',
    subtitle: (v.subtitleEn && v.subtitleEn.trim()) || (v.subtitleBn && v.subtitleBn.trim()) || null,
    thumbnail,
    watchUrl,
  };
}

export function HomepageVideoCarousel() {
  const { width } = useWindowDimensions();
  const { data, isLoading, isError } = useHomepageVideos();

  // Hidden while loading or on error, never a placeholder deck.
  if (isLoading || isError) return null;

  const rows = (data ?? []).map(resolve).filter((r) => r.thumbnail || r.watchUrl);
  if (rows.length === 0) return null;

  const cardW = Math.min(Math.round(width * 0.82), 340);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardW + GAP}
      decelerationRate="fast"
      contentContainerStyle={{ paddingRight: H_PAD }}
    >
      {rows.map((r, i) => (
        <VideoCard
          key={r.id}
          video={r}
          width={cardW}
          style={{ marginRight: i === rows.length - 1 ? 0 : GAP }}
        />
      ))}
    </ScrollView>
  );
}

function VideoCard({
  video,
  width,
  style,
}: {
  video: ResolvedVideo;
  width: number;
  style?: { marginRight: number };
}) {
  const open = video.watchUrl
    ? () => WebBrowser.openBrowserAsync(video.watchUrl as string, { enableBarCollapsing: true, showTitle: true }).catch(() => {})
    : undefined;

  return (
    <Pressable
      onPress={open}
      style={{ width, ...style }}
      className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink active:opacity-95"
    >
      <View className="relative w-full bg-black" style={{ aspectRatio: 16 / 9 }}>
        {video.thumbnail ? (
          <Image
            source={{ uri: video.thumbnail }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Gradient colors={['#3730A3', '#1E1B4B', '#0F1115']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        )}
        <Gradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
        />
        {video.watchUrl ? (
          <View className="absolute inset-0 items-center justify-center">
            <PlayCircle size={56} color="#FFFFFF" strokeWidth={1.75} />
          </View>
        ) : null}
      </View>
      <View className="gap-1 px-4 py-3">
        <Text className="font-en text-[10px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300">
          Ambassador
        </Text>
        {video.title ? (
          <Text className="text-base font-extrabold leading-tight text-white" numberOfLines={2}>
            {video.title}
          </Text>
        ) : null}
        {video.subtitle ? (
          <Text className="text-sm text-white/85" numberOfLines={2}>
            {video.subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
