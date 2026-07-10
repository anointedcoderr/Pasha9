// Built by Anointed Coder.
//
// EmptyState: a centered icon + title + message, with an optional action
// button. Used for empty lists, "coming soon" placeholders, and errors.
//
// Props:
//   icon         Ionicons name   glyph in the circle (default 'sparkles')
//   title        string          heading (required)
//   message      string          supporting line
//   actionLabel  string          primary button label (renders when set)
//   onAction     () => void      button handler
//   className    string

import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './Button';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = 'sparkles',
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('items-center justify-center px-6 py-12', className)}>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-gold-500/15">
        <Ionicons name={icon} size={28} color={colors.gold700} />
      </View>
      <Text className="mt-4 text-center text-lg font-extrabold text-ink">{title}</Text>
      {message ? (
        <Text className="mt-1.5 max-w-[280px] text-center text-sm text-ink-mute">{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} className="mt-5" />
      ) : null}
    </View>
  );
}
