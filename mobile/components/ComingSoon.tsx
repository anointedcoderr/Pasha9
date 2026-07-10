// Built by Anointed Coder.
//
// ComingSoon: the placeholder body for routes whose full screen ships in a
// later phase. Renders the shared AppHeader (or a compact back header for
// stack routes) plus a centered EmptyState with the route title.
//
// Props:
//   title     string   screen title (required)
//   subtitle  string   optional supporting line
//   icon      Ionicons name  glyph in the empty state (default 'construct')
//   variant   'tab' | 'stack'  'tab' shows the full AppHeader; 'stack'
//              shows a slim back header (default 'tab')

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, EmptyState } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { colors } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export interface ComingSoonProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  variant?: 'tab' | 'stack';
}

export function ComingSoon({
  title,
  subtitle = 'This screen is on the way. The shared component kit is ready, so it lands in the next phase.',
  icon = 'construct',
  variant = 'tab',
}: ComingSoonProps) {
  const router = useRouter();

  const header =
    variant === 'tab' ? (
      <AppHeader />
    ) : (
      <View className="flex-row items-center gap-2 border-b border-divider bg-paper px-3 py-2.5">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-lg font-black text-ink">{title}</Text>
      </View>
    );

  return (
    <Screen header={header} scroll={false} contentClassName="flex-1 justify-center">
      <EmptyState icon={icon} title={title} message={subtitle} />
    </Screen>
  );
}
