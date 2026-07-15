// Built by Anointed Coder.
//
// StackScreenHeader: the slim top bar for pushed stack routes (wallet,
// deposit, withdraw, transactions). A back chevron, a bold title with an
// optional subtitle, and an optional right-side node (help icon, quick
// link). Mirrors the compact header baked into ComingSoon so stack screens
// share one look. Pass to <Screen header={<StackScreenHeader .../>}>.
//
// Props:
//   title     string     screen title (required)
//   subtitle  string     optional secondary line under the title
//   right     ReactNode  optional right-aligned control
//   onBack    () => void override the default router.back()

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/theme';

export interface StackScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}

export function StackScreenHeader({ title, subtitle, right, onBack }: StackScreenHeaderProps) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-2 border-b border-divider bg-paper px-3 py-2.5">
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
      >
        <Icon name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-lg font-black text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
