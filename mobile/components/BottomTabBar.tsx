// Built by Anointed Coder.
//
// BottomTabBar: the premium custom tab bar for the (tabs) group. Five slots
// laid out as on the web player app:
//
//   Promotions | Lotto (NEW) | HOME (raised center) | Betting Pass | Referral
//
// The center Home slot is a raised gold FAB; side slots use a gold active
// state. Light bar with a top border and safe-area bottom padding. Fed by
// expo-router <Tabs tabBar={(p) => <BottomTabBar {...p} />}>.

import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gradient } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabMeta {
  label: string;
  icon: IconName;
  isNew?: boolean;
}

// Display order (left -> right). "index" (Home) sits in the middle.
const ORDER = ['promotions', 'lotto', 'index', 'betting-pass', 'referral'] as const;

const META: Record<string, TabMeta> = {
  index: { label: 'Home', icon: 'home' },
  promotions: { label: 'Promotions', icon: 'gift' },
  lotto: { label: 'Lotto', icon: 'ticket', isNew: true },
  'betting-pass': { label: 'Pass', icon: 'star' },
  referral: { label: 'Referral', icon: 'people' },
};

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      className="flex-row items-end justify-between border-t border-divider bg-paper px-2 pt-2"
    >
      {ORDER.map((name) => {
        const route = state.routes.find((r) => r.name === name);
        if (!route) return null;
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const focused = state.index === routeIndex;
        const meta = META[name];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (name === 'index') {
          return <HomeFab key={route.key} focused={focused} onPress={onPress} label={meta.label} />;
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            className="flex-1 items-center gap-1 py-1 active:opacity-70"
          >
            <View className="relative">
              <View
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-xl',
                  focused ? 'bg-gold-500/15' : 'bg-transparent',
                )}
              >
                <Ionicons
                  name={meta.icon}
                  size={20}
                  color={focused ? colors.gold700 : colors.inkMute}
                />
              </View>
              {meta.isNew ? (
                <View className="absolute -right-1.5 -top-1 rounded-full bg-newg px-1">
                  <Text className="text-[8px] font-black text-white">NEW</Text>
                </View>
              ) : null}
            </View>
            <Text
              className={cn('text-[10px] font-semibold', focused ? 'text-ink' : 'text-ink-mute')}
              numberOfLines={1}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HomeFab({
  focused,
  onPress,
  label,
}: {
  focused: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center active:opacity-90">
      <View
        className={cn(
          'relative -mt-6 h-14 w-14 items-center justify-center overflow-hidden rounded-full border-4 border-paper',
          focused ? 'opacity-100' : 'opacity-95',
        )}
        style={{
          shadowColor: colors.gold600,
          shadowOpacity: 0.5,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Gradient colors={gradients.gold} radius={999} />
        <Ionicons name="home" size={26} color={colors.ink} />
      </View>
      <Text className={cn('mt-0.5 text-[10px] font-bold', focused ? 'text-ink' : 'text-ink-soft')}>
        {label}
      </Text>
    </Pressable>
  );
}
