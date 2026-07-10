// Built by Anointed Coder.
//
// SectionHeader: a row title with an optional right-aligned "View all"
// action. Sits above game grids, promotion rows and list sections.
//
// Props:
//   title      string        section title (required)
//   subtitle   string        optional secondary line under the title
//   icon       Ionicons name optional leading accent icon
//   actionLabel string       right-side action text (default "View all")
//   onAction   () => void    tapping the action; when omitted no action shows

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/cn';
import { colors } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  actionLabel = 'View all',
  onAction,
  className,
}: SectionHeaderProps) {
  return (
    <View className={cn('flex-row items-center justify-between', className)}>
      <View className="flex-row items-center gap-2 flex-1 pr-2">
        {icon ? (
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-gold-500/15">
            <Ionicons name={icon} size={16} color={colors.gold700} />
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="text-base font-extrabold text-ink" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-xs text-ink-mute" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {onAction ? (
        <Pressable onPress={onAction} className="flex-row items-center gap-0.5 active:opacity-70">
          <Text className="text-xs font-bold text-blue-600">{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.blue600} />
        </Pressable>
      ) : null}
    </View>
  );
}
