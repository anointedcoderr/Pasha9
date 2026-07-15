// Built by Anointed Coder.
//
// HomeGameTile: one game card inside a homepage strip, ported from the web
// HomeDbGameSection tile (apps/web/components/site/HomeDbGameSection.tsx). A
// pure square thumbnail carries the artwork full-bleed, with per-card overlays
// gated by the same flags the admin flips per row:
//   showProviderLabel / showGameName / showHotBadge / showPlayButton
//   imageOnlyMode      (drop ALL chrome, show the upload edge-to-edge)
//   imageFitMode       ('contain' renders a blurred copy behind so the tile
//                        never reveals a white box; 'cover' fills the square)
//
// Tapping launches the game through the shared launch handler:
//   - external games -> the money-gated / auth-gated useGameLaunch flow, read
//     off HomeLaunchContext so the strip mounts ONE handler + notice for all
//     its tiles (the section provides it; a no-op default keeps the tile safe
//     if it is ever rendered standalone).
//   - native games   -> router.push(href) into the in-app route.
//
// The tile fills its parent's width (w-full aspect-square), so the section
// sizes each cell (a 3-col grid cell or a fixed rail width) and drops the tile
// in unchanged.

import { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Play } from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { cn } from '@/lib/cn';
import { resolveHref } from '@/lib/nav';
import type { GameLaunch } from '@/app/games/_components/useGameLaunch';
import type { HomeSectionGame } from '@/lib/api/homepage-types';

// A no-op launch handler so a tile rendered without a provider never crashes.
// In practice every strip wraps its tiles in HomeLaunchContext.Provider with a
// real useGameLaunch() instance, so tapping surfaces the auth / money gate.
const NOOP_LAUNCH: GameLaunch = {
  launch: () => {},
  launchingKey: null,
  error: null,
  deposit: null,
  clear: () => {},
};

/**
 * Shares one useGameLaunch() instance from a strip down to its tiles, so the
 * spinner state, the deposit prompt and the error notice all reflect the same
 * handler. A strip provides its launcher here and mounts a single
 * GameLaunchNotice bound to the same value.
 */
export const HomeLaunchContext = createContext<GameLaunch>(NOOP_LAUNCH);

// Gold play-pill gradient (web from-amber-300 to-amber-500) + its ink text.
const PLAY_GRADIENT = ['#FCD34D', '#F59E0B'] as const;
const PLAY_INK = '#3A1F00';

// Cosmetic badge palettes ported from the web rose/amber/yellow overlay pills.
const HOT_BADGE = { bg: 'rgba(244,63,94,0.25)', border: 'rgba(253,164,175,0.6)', text: '#FFF1F2' };
const JACKPOT_BADGE = { bg: 'rgba(252,211,77,0.25)', border: 'rgba(252,211,77,0.6)', text: '#FFFBEB' };
const BRAND_BADGE = { bg: 'rgba(253,224,71,0.25)', border: 'rgba(253,224,71,0.6)', text: '#FEFCE8' };
const PROVIDER_BADGE = { bg: 'rgba(253,230,138,0.15)', border: 'rgba(252,211,77,0.6)', text: '#FEF3C7' };

const nameShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

export function HomeGameTile({ game }: { game: HomeSectionGame }) {
  const launcher = useContext(HomeLaunchContext);
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  const isExternal = game.source === 'external';
  const busyKey =
    isExternal && game.providerKey && game.gameUid ? `${game.providerKey}:${game.gameUid}` : null;
  const busy = busyKey != null && launcher.launchingKey === busyKey;

  const useImage = !!game.imageUrl && !failed;
  // Per-card overlay visibility. Defaults to "show everything" (undefined !==
  // false) so organic strips keep their full look; curated Hot Games rows can
  // flip each flag off. imageOnly drops all chrome and shows the upload alone.
  const imageOnly = game.imageOnlyMode === true && useImage;
  const showProvider = game.showProviderLabel !== false && !imageOnly;
  const showName = game.showGameName !== false && !imageOnly;
  const showHotBadge = game.showHotBadge !== false && !imageOnly;
  const showPlay = game.showPlayButton !== false && !imageOnly;
  const useContain = game.imageFitMode === 'contain' && useImage;
  const hasOverlayText = !imageOnly && (showName || showPlay);

  const onPress = () => {
    if (isExternal) {
      if (game.providerKey && game.gameUid) {
        launcher.launch({
          providerKey: game.providerKey,
          gameUid: game.gameUid,
          displayName: game.displayName,
        });
      }
      return;
    }
    // Native game: straight into the in-app route.
    router.push(resolveHref(game.href) as never);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className={cn('w-full active:opacity-90', busy && 'opacity-70')}
    >
      <View className="relative aspect-square w-full overflow-hidden rounded-2xl bg-brand-surface">
        {useImage ? (
          <>
            {useContain ? (
              // Blurred copy behind a contained foreground so a transparent /
              // letterboxed upload never reveals a white box.
              <Image
                source={{ uri: game.imageUrl as string }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={20}
                cachePolicy="memory-disk"
              />
            ) : null}
            <Image
              source={{ uri: game.imageUrl as string }}
              style={StyleSheet.absoluteFill}
              contentFit={useContain ? 'contain' : 'cover'}
              transition={200}
              cachePolicy="memory-disk"
              onError={() => setFailed(true)}
            />
          </>
        ) : (
          // No / failed upload: a quiet dark placeholder, never fabricated art.
          <View style={StyleSheet.absoluteFill} className="items-center justify-center">
            <Gradient colors={['#0F1115', '#1A1D24', '#0F1115']} />
            <Play size={22} color="rgba(255,224,102,0.35)" strokeWidth={2} />
          </View>
        )}

        {/* Bottom dim gradient backing the caption, only when text shows. */}
        {hasOverlayText ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' }}
            className="overflow-hidden"
          >
            <Gradient
              colors={['rgba(15,17,21,0)', 'rgba(15,17,21,0.55)', 'rgba(15,17,21,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        ) : null}

        {/* HOT + JACKPOT badges, top-right. */}
        {showHotBadge && game.isHot ? (
          <View
            style={{ backgroundColor: HOT_BADGE.bg, borderColor: HOT_BADGE.border }}
            className="absolute right-2 top-2 h-5 justify-center rounded-full border px-1.5"
          >
            <Text
              style={{ color: HOT_BADGE.text }}
              className="text-[9px] font-extrabold uppercase tracking-wider"
            >
              {game.hotBadgeText ?? 'HOT'}
            </Text>
          </View>
        ) : null}
        {showHotBadge && game.isJackpot ? (
          <View
            style={{ backgroundColor: JACKPOT_BADGE.bg, borderColor: JACKPOT_BADGE.border }}
            className="absolute right-2 top-9 h-5 justify-center rounded-full border px-1.5"
          >
            <Text
              style={{ color: JACKPOT_BADGE.text }}
              className="text-[9px] font-extrabold uppercase tracking-wider"
            >
              JACKPOT
            </Text>
          </View>
        ) : null}

        {/* Brand leads; provider only when no brand is set. */}
        {showProvider && game.brandName ? (
          <View
            style={{ backgroundColor: BRAND_BADGE.bg, borderColor: BRAND_BADGE.border, maxWidth: '80%' }}
            className="absolute left-2 top-2 h-5 justify-center rounded-full border px-1.5"
          >
            <Text
              numberOfLines={1}
              style={{ color: BRAND_BADGE.text }}
              className="text-[9px] font-extrabold uppercase tracking-wider"
            >
              {game.brandName}
            </Text>
          </View>
        ) : showProvider && game.providerName ? (
          <View
            style={{ backgroundColor: PROVIDER_BADGE.bg, borderColor: PROVIDER_BADGE.border, maxWidth: '70%' }}
            className="absolute left-2 top-2 h-5 justify-center rounded-full border px-1.5"
          >
            <Text
              numberOfLines={1}
              style={{ color: PROVIDER_BADGE.text }}
              className="text-[9px] font-bold uppercase tracking-wider"
            >
              {game.providerName}
            </Text>
          </View>
        ) : null}

        {/* Name + play pill overlay, pinned to the bottom of the image. */}
        {hasOverlayText ? (
          <View className="absolute inset-x-0 bottom-0 px-2.5 pb-2">
            {showName ? (
              <Text
                numberOfLines={1}
                style={nameShadow}
                className="text-sm font-extrabold leading-tight text-white"
              >
                {game.displayName}
              </Text>
            ) : null}
            {showPlay ? (
              <View className="mt-1 h-7 flex-row items-center gap-1 self-start overflow-hidden rounded-full px-2.5">
                <Gradient colors={PLAY_GRADIENT} radius={999} />
                <Play size={12} color={PLAY_INK} strokeWidth={2.5} />
                <Text
                  style={{ color: PLAY_INK }}
                  className="text-[10px] font-extrabold uppercase tracking-wider"
                >
                  {busy ? 'Loading...' : 'Play'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
