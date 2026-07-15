// Built by Anointed Coder.
//
// BottomTabBar: the mobile tab bar, aligned to the Pasha9 website mobile nav
// (apps/web/components/site/StickyBottomNav.tsx). Five slots in the same order,
// with a raised gold Home FAB in the centre:
//
//   Promotion | Lotto (NEW) | HOME (raised centre) | Betting Pass | Referral
//
// Side slots mirror the web .bnav-btn: a 32px rounded-10 gold-tint icon tile
// that flips to a solid gold gradient tile with an ink glyph and a gold
// underline when active. lucide-react-native icons match the web (Gift, Ticket,
// Home, Star, Users). Labels switch EN/BN with the shared language store. Fed by
// expo-router <Tabs tabBar={(p) => <BottomTabBar {...p} />}>.

import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Gift, Home, Star, Ticket, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gradient } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useAppLang, type AppLang } from '@/lib/lang';

interface TabMeta {
  icon: LucideIcon;
  labels: Record<AppLang, string>;
  isNew?: boolean;
}

// Display order (left -> right). "index" (Home) sits in the raised centre.
const ORDER = ['promotions', 'lotto', 'index', 'betting-pass', 'referral'] as const;

// Icons + bilingual labels taken 1:1 from the web nav (navx.* / nav.home).
const META: Record<string, TabMeta> = {
  index: { icon: Home, labels: { en: 'Home', bn: 'হোম' } },
  promotions: { icon: Gift, labels: { en: 'Promotion', bn: 'প্রমোশন' } },
  lotto: { icon: Ticket, labels: { en: 'Lotto', bn: 'লটো' }, isNew: true },
  'betting-pass': { icon: Star, labels: { en: 'Betting Pass', bn: 'বেটিং পাস' } },
  referral: { icon: Users, labels: { en: 'Referral', bn: 'রেফারেল' } },
};

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { lang } = useAppLang();
  const font = lang === 'bn' ? 'font-bn' : 'font-en';

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
        const label = meta.labels[lang];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (name === 'index') {
          return <HomeFab key={route.key} focused={focused} onPress={onPress} label={label} font={font} />;
        }

        const Icon = meta.icon;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityLabel={label}
            className="relative flex-1 items-center gap-1 py-1 active:opacity-70"
          >
            <View className="relative">
              <View
                className={cn(
                  'relative h-8 w-8 items-center justify-center overflow-hidden rounded-chip',
                  focused ? '' : 'bg-gold-500/10',
                )}
                style={
                  focused
                    ? {
                        transform: [{ translateY: -1 }],
                        shadowColor: colors.gold600,
                        shadowOpacity: 0.5,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 4,
                      }
                    : undefined
                }
              >
                {focused ? <Gradient colors={gradients.gold} radius={10} /> : null}
                <Icon size={18} color={focused ? colors.ink : colors.gold700} strokeWidth={2} />
              </View>
              {meta.isNew ? (
                <View className="absolute -right-2 -top-1.5 rounded bg-newg px-1">
                  <Text className={cn(font, 'text-[8px] font-black text-ink')}>
                    {lang === 'bn' ? 'নতুন' : 'NEW'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              className={cn(font, 'text-[10px] font-semibold', focused ? 'text-ink' : 'text-ink-soft')}
              numberOfLines={1}
            >
              {label}
            </Text>
            {focused ? (
              <View className="absolute inset-x-0 bottom-0 items-center">
                <View
                  className="h-[3px] w-5 rounded-full bg-gold-500"
                  style={{
                    shadowColor: colors.gold500,
                    shadowOpacity: 0.7,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />
              </View>
            ) : null}
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
  font,
}: {
  focused: boolean;
  onPress: () => void;
  label: string;
  font: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} className="flex-1 items-center active:opacity-90">
      <View
        className={cn(
          'relative -mt-6 h-14 w-14 items-center justify-center overflow-hidden rounded-full border-4 border-paper',
          focused ? 'opacity-100' : 'opacity-95',
        )}
        style={{
          shadowColor: colors.gold600,
          shadowOpacity: 0.55,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <Gradient colors={gradients.gold} radius={999} />
        <Home size={26} color={colors.ink} strokeWidth={2.25} />
      </View>
      <Text className={cn(font, 'mt-0.5 text-[10px] font-black text-ink')}>{label}</Text>
    </Pressable>
  );
}
