// Built by Anointed Coder.
//
// AmbassadorVideoSection: brand-ambassador card + promo-video card, mirroring
// apps/web/components/site/AmbassadorVideoSection.tsx. Self-fetching via
// useAmbassador(). The section only appears once the operator has switched it
// on with real content behind it; a half-configured feed (ambassador with no
// video, or the reverse) shows just the configured card, and the single card
// spans the full row. There is no native video player dependency: the promo
// play button opens video.url in the in-app browser (expo-web-browser).
//
// States: hidden while loading, on error, when inactive, and when there is no
// ambassador and no video content.

import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Play, User } from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useAmbassador } from '@/lib/api/homepage';

// Bundled defaults copied 1:1 from the web i18n dictionary (en.json
// home.ambassador / home.video) so a configured-but-captionless feed reads
// exactly like the website.
const FALLBACK = {
  ambassadorName: 'Pasha 9 Brand Ambassador',
  ambassadorCaption: 'Official ambassador of Pasha 9 for the 2025/2026 season.',
  videoTitle: 'Behind the scenes',
  videoCaption: 'Watch the official Pasha 9 promo and matchday highlights.',
} as const;

export function AmbassadorVideoSection() {
  const { data, isLoading, isError } = useAmbassador();

  // Hidden until the fetch resolves and the operator has switched it on.
  if (isLoading || isError || !data || !data.active) return null;

  const hasAmbassador = !!data.ambassador.name?.trim() || !!data.ambassador.imageUrl?.trim();
  const hasVideo = !!data.video.url?.trim() || !!data.video.posterUrl?.trim();
  if (!hasAmbassador && !hasVideo) return null;

  return (
    <View className="gap-3">
      {hasAmbassador ? (
        <AmbassadorCard
          name={data.ambassador.name ?? FALLBACK.ambassadorName}
          caption={data.ambassador.caption ?? FALLBACK.ambassadorCaption}
          imageUrl={data.ambassador.imageUrl}
        />
      ) : null}
      {hasVideo ? (
        <VideoCard
          title={data.video.title ?? FALLBACK.videoTitle}
          caption={data.video.caption ?? FALLBACK.videoCaption}
          url={data.video.url}
          posterUrl={data.video.posterUrl}
        />
      ) : null}
    </View>
  );
}

function AmbassadorCard({ name, caption, imageUrl }: { name: string; caption: string; imageUrl: string | null }) {
  return (
    <View className="relative overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink">
      {/* gold -> transparent -> blue wash, matching the web overlay */}
      <Gradient
        colors={['rgba(255,204,0,0.30)', 'rgba(255,204,0,0)', 'rgba(30,115,232,0.30)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        radius={16}
      />
      <View className="relative flex-row items-center gap-4 px-5 py-6">
        <View className="flex-1">
          <Text className="font-en text-[11px] font-bold uppercase tracking-wider text-brand-yellow-400">
            Brand Ambassador
          </Text>
          <Text className="mt-2 text-xl font-extrabold leading-tight text-white">{name}</Text>
          <Text className="mt-2 text-sm leading-relaxed text-white/75">{caption}</Text>
        </View>
        <View className="h-32 w-24 shrink-0 overflow-hidden rounded-xl">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View className="relative flex-1 items-center justify-center">
              <Gradient colors={['#FFCC00', '#F5B400']} radius={12} />
              <User size={40} color={colors.ink} strokeWidth={1.75} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function VideoCard({ title, caption, url, posterUrl }: { title: string; caption: string; url: string | null; posterUrl: string | null }) {
  return (
    <View className="relative overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink" style={{ minHeight: 152 }}>
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.8 }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Gradient colors={['#1659C2', '#FFCC00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
      )}
      {/* ink scrim from the bottom-left so the copy always reads */}
      <Gradient
        colors={['#0F1115', 'rgba(15,17,21,0.55)', 'rgba(15,17,21,0)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
      />

      <View className="relative flex-1 justify-between gap-4 px-5 py-6">
        <View>
          <Text className="font-en text-[11px] font-bold uppercase tracking-wider text-brand-yellow-400">
            Promo Video
          </Text>
          <Text className="mt-2 text-xl font-extrabold leading-tight text-white">{title}</Text>
          <Text className="mt-2 text-sm leading-relaxed text-white/75">{caption}</Text>
        </View>
        {/* Play only renders when a real video url exists, never a dead button. */}
        {url ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play promo video"
            onPress={() => WebBrowser.openBrowserAsync(url, { enableBarCollapsing: true, showTitle: true }).catch(() => {})}
            className="h-12 w-12 items-center justify-center self-start rounded-full bg-brand-yellow-500 active:opacity-85"
          >
            <Play size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
