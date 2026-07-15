// Built by Anointed Coder.
//
// PromoPair: the two large marketing cards at the foot of the home screen,
// mirroring apps/web/components/site/PromoPair.tsx. Left card = Refer & Earn
// (dark ink gradient, routes to /affiliate), right card = Betting Pass (blue
// gradient, routes to /betting-pass). On phones the two stack; every text,
// link and image is admin-overridable via usePromoPair() and falls back to
// the same bundled copy the website ships, so a fresh database still renders
// the real product cards (parity, not placeholder data).
//
// States: while the fetch is in flight or errors, the whole section stays
// hidden. A card configured image-only but with no image resolves to nothing
// and is dropped; if that leaves both cards empty the section hides.

import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowRight } from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { colors, gradients } from '@/lib/theme';
import { resolveHref } from '@/lib/nav';
import { usePromoPair, type PromoPairSlot } from '@/lib/api/homepage';

// Prefer the English field, fall back to the Bangla field, then to the
// bundled default. The app has no language context yet, so English leads
// (Hind Siliguri covers Bangla glyphs when an operator supplies Bangla copy).
function pick(en: string | null, bn: string | null, fallback: string): string {
  return (en && en.trim()) || (bn && bn.trim()) || fallback;
}

// Bundled defaults, copied 1:1 from the web i18n dictionary (en.json home.pair)
// so an unconfigured slot renders exactly what the website renders.
const DEFAULTS = {
  refer: {
    kicker: 'Refer and Earn',
    title: 'Invite friends, earn lifetime commission',
    body: 'Earn 8 / 4 / 2 percent across three referral levels with daily payouts.',
    cta: 'Open Affiliate',
    href: '/affiliate',
  },
  pass: {
    kicker: 'Exclusive',
    title: 'Pasha 9 Betting Pass',
    body: 'Deposit, level up and unlock real prizes through the season.',
    cta: 'Open Pass',
    href: '/betting-pass',
  },
} as const;

// Card gradients mirror the web tokens: refer = from-brand-ink to-brand-navInkSoft,
// pass = from-brand-blue-700 to-brand-blue-500.
const REFER_GRADIENT = [colors.ink, colors.navInkSoft];
const PASS_GRADIENT = [colors.blue700, colors.blue500];

export function PromoPair() {
  const router = useRouter();
  const { data, isLoading, isError } = usePromoPair();

  // Hidden while loading or on error, never a placeholder.
  if (isLoading || isError || !data) return null;

  const referNode = renderCard(router, data.refer, DEFAULTS.refer, REFER_GRADIENT);
  const passNode = renderCard(router, data.pass, DEFAULTS.pass, PASS_GRADIENT);

  // If neither card has anything to show, hide the whole section.
  if (!referNode && !passNode) return null;

  return (
    <View className="gap-3">
      {referNode}
      {passNode}
    </View>
  );
}

function renderCard(
  router: ReturnType<typeof useRouter>,
  slot: PromoPairSlot,
  fallback: { kicker: string; title: string; body: string; cta: string; href: string },
  gradient: readonly string[],
) {
  const href = slot.href || fallback.href;

  // Image-only mode: show the operator's banner edge to edge, no scrim, no
  // text. With no image there is nothing to render, so the card is dropped.
  if (slot.imageOnly) {
    if (!slot.imageUrl) return null;
    return (
      <Pressable
        key={fallback.href}
        onPress={() => openHref(router, href)}
        className="relative overflow-hidden rounded-2xl active:opacity-95"
      >
        <Image
          source={{ uri: slot.imageUrl }}
          style={{ width: '100%', aspectRatio: 40 / 21 }}
          contentFit="cover"
          transition={200}
        />
      </Pressable>
    );
  }

  const kicker = pick(slot.kicker, slot.kickerBn, fallback.kicker);
  const title = pick(slot.title, slot.titleBn, fallback.title);
  const body = pick(slot.body, slot.bodyBn, fallback.body);
  const cta = pick(slot.cta, slot.ctaBn, fallback.cta);
  // The overlay scrim only makes sense over a real background image.
  const showOverlay = slot.overlayEnabled && !!slot.imageUrl;

  return (
    <Pressable
      key={fallback.href}
      onPress={() => openHref(router, href)}
      className="relative overflow-hidden rounded-2xl active:opacity-95"
      style={{ minHeight: 156 }}
    >
      <Gradient colors={gradient} radius={16} />
      {slot.imageUrl ? (
        <Image
          source={{ uri: slot.imageUrl }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: showOverlay ? 0.55 : 1 }}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      {showOverlay ? (
        <Gradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      ) : null}

      <View className="relative gap-1.5 px-5 py-6">
        <Text className="font-en text-[10px] font-bold uppercase tracking-wider text-brand-yellow-400">
          {kicker}
        </Text>
        <Text className="max-w-[18ch] text-lg font-extrabold leading-snug text-white">{title}</Text>
        <Text className="max-w-[28ch] text-xs leading-relaxed text-white/85">{body}</Text>

        <View className="mt-2 self-start overflow-hidden rounded-lg">
          <Gradient colors={gradients.gold} radius={8} />
          <View className="h-10 flex-row items-center gap-1.5 px-4">
            <Text className="font-en text-sm font-bold text-brand-ink">{cta}</Text>
            <ArrowRight size={16} color={colors.ink} strokeWidth={2} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// Internal app routes (starting with "/") push through expo-router; a full
// URL opens in the in-app browser. Mirrors the home banner-press pattern.
function openHref(router: ReturnType<typeof useRouter>, href: string) {
  if (href.startsWith('/')) {
    router.push(resolveHref(href) as never);
    return;
  }
  WebBrowser.openBrowserAsync(href, { enableBarCollapsing: true, showTitle: true }).catch(() => {});
}
