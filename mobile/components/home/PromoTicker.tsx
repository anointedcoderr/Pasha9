// Built by Anointed Coder.
//
// PromoTicker: the horizontally scrolling promo marquee under the category
// strip, mirroring the website PromoTicker
// (apps/web/components/site/PromoTicker.tsx).
//
// Self-fetching via usePromoText(): active promo lines, ordered by position. A
// light card (white surface, brand divider) with a gold "Live" chip carrying a
// megaphone glyph, then the messages scrolling right-to-left forever. The
// endless scroll uses the same reanimated pattern as LiveWinnersTicker: the row
// is rendered twice and translated by exactly one copy width, then repeats, so
// the loop is seamless.
//
// Hidden entirely when there are no active promo lines. No mock copy ever shows.

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Megaphone } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { usePromoText, type PromoTextItem } from '@/lib/api/homepage';

const SPEED = 45; // px per second

export function PromoTicker() {
  const { data } = usePromoText();

  const items = (data ?? [])
    .filter((i) => i.status === 'active' && i.message.trim().length > 0)
    .sort((a, b) => a.position - b.position);

  const offset = useSharedValue(0);
  const [copyWidth, setCopyWidth] = useState(0);

  useEffect(() => {
    if (copyWidth <= 0) return;
    offset.value = 0;
    offset.value = withRepeat(
      withTiming(-copyWidth, { duration: (copyWidth / SPEED) * 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [copyWidth, offset]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  // Hidden when there is nothing active to scroll.
  if (items.length === 0) return null;

  return (
    <View className="flex-row items-center gap-3 overflow-hidden rounded-xl border border-brand-divider bg-brand-paper px-3 py-2">
      <View className="flex-row items-center gap-1.5 rounded-pill bg-brand-yellow-500/15 px-2.5 py-1">
        <Megaphone size={14} color={colors.gold700} strokeWidth={2} />
        <Text className="text-[11px] font-semibold text-brand-yellow-700">Live</Text>
      </View>

      <View className="flex-1 overflow-hidden">
        <Animated.View style={[{ flexDirection: 'row' }, animatedStyle]}>
          <MessageRow items={items} onWidth={setCopyWidth} />
          <MessageRow items={items} />
        </Animated.View>
      </View>
    </View>
  );
}

function MessageRow({
  items,
  onWidth,
}: {
  items: PromoTextItem[];
  onWidth?: (w: number) => void;
}) {
  return (
    <View
      className="flex-row items-center"
      onLayout={onWidth ? (e) => onWidth(e.nativeEvent.layout.width) : undefined}
    >
      {items.map((m) => (
        <Text key={m.id} className="mr-10 text-sm text-brand-inkSoft" numberOfLines={1}>
          {m.message}
        </Text>
      ))}
    </View>
  );
}
