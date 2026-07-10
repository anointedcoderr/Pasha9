// Built by Anointed Coder.
//
// LiveWinnersTicker: a dark marquee strip that endlessly scrolls recent
// wins. Built on react-native-reanimated: the row is rendered twice and
// translated by exactly one copy width, then repeats, so the loop is
// seamless. A fixed "LIVE" label sits on the left.
//
// Props:
//   winners   Winner[]   the wins to scroll (required)
//   speed     number     px per second (default 40)
//   className string

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import type { Winner } from '@/lib/mock/winners';

export interface LiveWinnersTickerProps {
  winners: Winner[];
  speed?: number;
  className?: string;
}

export function LiveWinnersTicker({ winners, speed = 40, className }: LiveWinnersTickerProps) {
  const offset = useSharedValue(0);
  const [copyWidth, setCopyWidth] = useState(0);

  useEffect(() => {
    if (copyWidth <= 0) return;
    offset.value = 0;
    offset.value = withRepeat(
      withTiming(-copyWidth, { duration: (copyWidth / speed) * 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [copyWidth, speed, offset]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View
      className={cn(
        'h-11 flex-row items-center overflow-hidden rounded-2xl border border-gold-600/20 bg-darkbg',
        className,
      )}
    >
      {/* Fixed LIVE label */}
      <View className="h-full flex-row items-center gap-1.5 border-r border-white/10 px-3">
        <View className="h-2 w-2 rounded-full bg-neon" />
        <Text className="text-[10px] font-black uppercase tracking-widest text-neon">Live</Text>
      </View>

      {/* Marquee */}
      <View className="flex-1 overflow-hidden">
        <Animated.View style={[{ flexDirection: 'row' }, animatedStyle]}>
          <WinnerRow winners={winners} onWidth={setCopyWidth} />
          <WinnerRow winners={winners} />
        </Animated.View>
      </View>
    </View>
  );
}

function WinnerRow({
  winners,
  onWidth,
}: {
  winners: Winner[];
  onWidth?: (w: number) => void;
}) {
  return (
    <View
      className="flex-row items-center pl-3"
      onLayout={onWidth ? (e) => onWidth(e.nativeEvent.layout.width) : undefined}
    >
      {winners.map((w) => (
        <View key={w.id} className="mr-5 flex-row items-center gap-1.5">
          <Ionicons name="trophy" size={13} color={colors.gold300} />
          <Text className="text-xs font-bold text-white/90">{w.handle}</Text>
          <Text className="text-xs text-white/45">won</Text>
          <Text className="text-xs font-black" style={{ color: colors.gold300 }}>
            {formatBDT(w.amount)}
          </Text>
          <Text className="text-[10px] text-white/40">- {w.game}</Text>
        </View>
      ))}
    </View>
  );
}
