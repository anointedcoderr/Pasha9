// Built by Anointed Coder.
//
// Legal + help hub. A single entry point that links to every policy page and
// to player support. Each row reuses the same tappable pattern as the rest
// of the app: an icon tile, a title, a short description, and a chevron.

import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = string;

interface HubLink {
  route: string;
  icon: IconName;
  tint: string;
  iconColor: string;
  title: string;
  subtitle: string;
}

const LINKS: HubLink[] = [
  {
    route: '/legal/terms',
    icon: 'document-text-outline',
    tint: 'bg-gold-500/15',
    iconColor: colors.gold700,
    title: 'Terms of Service',
    subtitle: 'The rules for using Pasha9.',
  },
  {
    route: '/legal/privacy',
    icon: 'lock-closed-outline',
    tint: 'bg-blue-500/15',
    iconColor: colors.blue600,
    title: 'Privacy Policy',
    subtitle: 'What we collect and how we protect it.',
  },
  {
    route: '/legal/responsible-gaming',
    icon: 'heart-outline',
    tint: 'bg-newg/15',
    iconColor: colors.newg,
    title: 'Responsible Gaming',
    subtitle: 'Tools and limits to keep play safe.',
  },
  {
    route: '/legal/faq',
    icon: 'help-circle-outline',
    tint: 'bg-gold-500/15',
    iconColor: colors.gold700,
    title: 'FAQ',
    subtitle: 'Quick answers to common questions.',
  },
  {
    route: '/legal/support',
    icon: 'chatbubbles-outline',
    tint: 'bg-hot/15',
    iconColor: colors.hot,
    title: 'Support',
    subtitle: 'Reach our team around the clock.',
  },
];

export default function LegalHubScreen() {
  const router = useRouter();

  return (
    <Screen header={<LegalHeader title="Help & Legal" />} contentClassName="gap-5">
      <View className="gap-1">
        <Text className="text-2xl font-black text-ink">How can we help?</Text>
        <Text className="text-sm text-ink-mute">
          Read our policies or get in touch with support. We are here every day.
        </Text>
      </View>

      <View className="gap-3">
        {LINKS.map((l) => (
          <Card key={l.route} padded={false} onPress={() => router.push(l.route)}>
            <View className="flex-row items-center gap-3 p-3.5">
              <View className={cn('h-11 w-11 items-center justify-center rounded-xl', l.tint)}>
                <Icon name={l.icon} size={20} color={l.iconColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-ink">{l.title}</Text>
                <Text className="mt-0.5 text-xs text-ink-mute" numberOfLines={1}>
                  {l.subtitle}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.inkMute} />
            </View>
          </Card>
        ))}
      </View>

      {/* Support highlight */}
      <Card onPress={() => router.push('/legal/support')} className="border-gold-600/25 bg-gold-500/10">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-gold-500">
            <Icon name="headset-outline" size={20} color={colors.ink} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-ink">Need a hand right now?</Text>
            <Text className="mt-0.5 text-xs text-ink-soft">
              Live chat and Telegram reply in minutes.
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.gold700} />
        </View>
      </Card>

      <Text className="pt-2 text-center text-[11px] text-ink-mute">
        Pasha9 is for players aged 18 and over. Play responsibly.
      </Text>
    </Screen>
  );
}

// Slim back header shared by the legal pages.
export function LegalHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-2 border-b border-divider bg-paper px-3 py-2.5">
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/legal'))}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
      >
        <Icon name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text className="text-lg font-black text-ink" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}
