// Built by Anointed Coder.
//
// Badge + Pill.
//   Badge - tiny uppercase status chip. Variants: hot (red), new (green),
//           gold, blue, neutral. Used on GameTile corners and section tags.
//   Pill  - larger rounded label, optionally with a leading Ionicons icon.
//           Used for the language toggle, "View all" pills, filters, etc.

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/cn';
import { colors } from '@/lib/theme';

export type BadgeVariant = 'hot' | 'new' | 'gold' | 'blue' | 'neutral';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  hot: 'bg-hot',
  new: 'bg-newg',
  gold: 'bg-gold-500',
  blue: 'bg-blue-500',
  neutral: 'bg-surfaceAlt',
};

const BADGE_TEXT: Record<BadgeVariant, string> = {
  hot: 'text-white',
  new: 'text-white',
  gold: 'text-ink',
  blue: 'text-white',
  neutral: 'text-ink-soft',
};

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ label, variant = 'neutral', className }: BadgeProps) {
  return (
    <View className={cn('rounded-md px-1.5 py-0.5', BADGE_STYLES[variant], className)}>
      <Text className={cn('text-[10px] font-black uppercase tracking-wider', BADGE_TEXT[variant])}>
        {label}
      </Text>
    </View>
  );
}

type IconName = keyof typeof Ionicons.glyphMap;

export interface PillProps {
  label?: string;
  icon?: IconName;
  children?: ReactNode;
  tone?: 'light' | 'gold' | 'dark';
  className?: string;
}

export function Pill({ label, icon, children, tone = 'light', className }: PillProps) {
  const toneClass =
    tone === 'gold'
      ? 'bg-gold-500/15 border-gold-600/30'
      : tone === 'dark'
        ? 'bg-white/10 border-white/15'
        : 'bg-surface border-divider';
  const iconColor = tone === 'dark' ? colors.gold300 : colors.gold700;
  const textClass = tone === 'dark' ? 'text-white' : 'text-ink-soft';
  return (
    <View className={cn('flex-row items-center gap-1 rounded-pill border px-2.5 py-1', toneClass, className)}>
      {icon ? <Ionicons name={icon} size={13} color={iconColor} /> : null}
      {label ? <Text className={cn('text-xs font-bold', textClass)}>{label}</Text> : null}
      {children}
    </View>
  );
}
