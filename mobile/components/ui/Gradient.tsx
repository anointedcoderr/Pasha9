// Built by Anointed Coder.
//
// Gradient: a lightweight linear-gradient fill built on react-native-svg
// (React Native has no native CSS gradient). Drop it as the first child of
// a `relative`, `overflow-hidden` container and layer real content above
// it. Used by PrimaryButton, BalanceCard, HeroCarousel and other premium
// surfaces so the look matches the web gold/dark gradients.
//
// Props:
//   colors     string[]  gradient stops, first -> last (required)
//   start/end  {x,y}     direction in unit space (default left->right)
//   locations  number[]  optional 0..1 offsets, else evenly spaced
//   radius     number    corner radius so the fill respects rounded cards
//
// Example:
//   <View className="relative overflow-hidden rounded-2xl">
//     <Gradient colors={gradients.gold} radius={16} />
//     <Text>...</Text>
//   </View>

import { useId } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

export interface GradientProps {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  radius?: number;
  style?: ViewStyle;
}

export function Gradient({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  locations,
  radius = 0,
  style,
}: GradientProps) {
  // useId guarantees a unique <defs> id per instance so multiple gradients
  // on one screen never collide.
  const gid = `grad-${useId().replace(/:/g, '')}`;
  const stops = colors.map((c, i) => {
    const offset = locations?.[i] ?? (colors.length === 1 ? 0 : i / (colors.length - 1));
    return <Stop key={i} offset={offset} stopColor={c} stopOpacity={1} />;
  });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id={gid} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
            {stops}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}
