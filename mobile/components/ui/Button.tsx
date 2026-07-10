// Built by Anointed Coder.
//
// Buttons. Two exported variants share one implementation:
//   PrimaryButton - gold gradient fill, dark ink label (main call to action)
//   GhostButton   - transparent with a hairline border (secondary action)
//
// Shared props:
//   label      string                     button text (required)
//   onPress    () => void
//   icon       Ionicons glyph name        optional leading icon
//   size       'sm' | 'md' | 'lg'         default 'md'
//   fullWidth  boolean                    stretch to container width
//   loading    boolean                    show a spinner, disable press
//   disabled   boolean
//   className  string                     extra classes on the pressable

import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gradient } from './Gradient';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: 'h-9 px-3', text: 'text-sm', icon: 15 },
  md: { box: 'h-12 px-5', text: 'text-base', icon: 18 },
  lg: { box: 'h-14 px-6', text: 'text-lg', icon: 20 },
} as const;

export function PrimaryButton({
  label,
  onPress,
  icon,
  size = 'md',
  fullWidth,
  loading,
  disabled,
  className,
}: ButtonProps) {
  const s = SIZES[size];
  const isOff = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      className={cn(
        'relative overflow-hidden rounded-pill items-center justify-center flex-row',
        s.box,
        fullWidth && 'w-full',
        isOff ? 'opacity-60' : 'active:opacity-90',
        className,
      )}
    >
      <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Ionicons name={icon} size={s.icon} color={colors.ink} /> : null}
          <Text className={cn('font-extrabold text-ink', s.text)}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  size = 'md',
  fullWidth,
  loading,
  disabled,
  className,
}: ButtonProps) {
  const s = SIZES[size];
  const isOff = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      className={cn(
        'rounded-pill items-center justify-center flex-row border border-divider bg-paper',
        s.box,
        fullWidth && 'w-full',
        isOff ? 'opacity-60' : 'active:bg-surfaceAlt',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={colors.inkSoft} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Ionicons name={icon} size={s.icon} color={colors.inkSoft} /> : null}
          <Text className={cn('font-bold text-ink-soft', s.text)}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
