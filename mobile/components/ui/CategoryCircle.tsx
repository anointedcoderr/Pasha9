// Built by Anointed Coder.
//
// CategoryCircle: a round gradient icon tile with a label underneath, used
// in the horizontal Jackpot / Hot / Slot / Casino / Crash strip on Home.
//
// Props:
//   label   string          caption under the circle (required)
//   icon    Ionicons name   glyph inside the circle (required)
//   tone    CategoryTone    gradient theme (default 'gold')
//   onPress () => void
//   size    number          circle diameter in px (default 58)

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gradient } from './Gradient';
import { cn } from '@/lib/cn';
import type { CategoryTone } from '@/lib/mock/categories';

type IconName = keyof typeof Ionicons.glyphMap;

const TONE_GRADIENT: Record<CategoryTone, readonly string[]> = {
  gold: ['#FFE066', '#FFCC00', '#F5B400'],
  hot: ['#FF7A1A', '#FF4E3A'],
  blue: ['#1E73E8', '#1659C2'],
  violet: ['#a855f7', '#6d28d9'],
  teal: ['#2dd4bf', '#0f766e'],
  orange: ['#fb923c', '#ea580c'],
  cyan: ['#22d3ee', '#0e7490'],
};

export interface CategoryCircleProps {
  label: string;
  icon: IconName;
  tone?: CategoryTone;
  onPress?: () => void;
  size?: number;
  className?: string;
}

export function CategoryCircle({
  label,
  icon,
  tone = 'gold',
  onPress,
  size = 58,
  className,
}: CategoryCircleProps) {
  return (
    <Pressable onPress={onPress} className={cn('items-center active:opacity-80', className)}>
      <View
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="relative items-center justify-center overflow-hidden"
      >
        <Gradient colors={TONE_GRADIENT[tone]} radius={size / 2} />
        <Ionicons name={icon} size={size * 0.42} color="#FFFFFF" />
      </View>
      <Text className="mt-1.5 text-[11px] font-semibold text-ink-soft" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
