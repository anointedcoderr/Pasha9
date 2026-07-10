// Built by Anointed Coder.
//
// Support. Contact channels as tappable rows: Telegram, WhatsApp, email, and
// live chat. Visual only this phase, so the rows show intent without opening
// a real link. Topped with a quick note on response times.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Card, Badge } from '@/components/ui';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { LegalHeader } from './index';

type IconName = keyof typeof Ionicons.glyphMap;

interface Channel {
  icon: IconName;
  tint: string;
  iconColor: string;
  title: string;
  handle: string;
  meta: string;
  badge?: string;
}

const CHANNELS: Channel[] = [
  {
    icon: 'chatbubbles-outline',
    tint: 'bg-gold-500/15',
    iconColor: colors.gold700,
    title: 'Live chat',
    handle: 'In-app chat',
    meta: 'Fastest reply, open 24 hours',
    badge: 'FASTEST',
  },
  {
    icon: 'paper-plane-outline',
    tint: 'bg-blue-500/15',
    iconColor: colors.blue600,
    title: 'Telegram',
    handle: '@Pasha9Support',
    meta: 'Replies in a few minutes',
  },
  {
    icon: 'logo-whatsapp',
    tint: 'bg-newg/15',
    iconColor: colors.newg,
    title: 'WhatsApp',
    handle: '+880 1300 000000',
    meta: 'Messages and voice notes welcome',
  },
  {
    icon: 'mail-outline',
    tint: 'bg-hot/15',
    iconColor: colors.hot,
    title: 'Email',
    handle: 'help@pasha9.com',
    meta: 'Best for documents, replies within a day',
  },
];

export default function SupportScreen() {
  const router = useRouter();
  return (
    <Screen header={<LegalHeader title="Support" />} contentClassName="gap-5 pb-16">
      <View className="gap-1">
        <Text className="text-2xl font-black text-ink">We are here to help</Text>
        <Text className="text-sm text-ink-mute">
          Pick the channel that suits you. Our team answers every day of the week.
        </Text>
      </View>

      {/* Response time note */}
      <Card className="border-gold-600/25 bg-gold-500/10">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500">
            <Ionicons name="time-outline" size={19} color={colors.ink} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-ink">Around the clock</Text>
            <Text className="mt-0.5 text-xs text-ink-soft">
              Live chat and Telegram usually reply within minutes.
            </Text>
          </View>
        </View>
      </Card>

      <View className="gap-3">
        {CHANNELS.map((c) => (
          <Card key={c.title} padded={false} onPress={() => {}}>
            <View className="flex-row items-center gap-3 p-3.5">
              <View className={cn('h-11 w-11 items-center justify-center rounded-xl', c.tint)}>
                <Ionicons name={c.icon} size={21} color={c.iconColor} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-extrabold text-ink">{c.title}</Text>
                  {c.badge ? <Badge label={c.badge} variant="gold" /> : null}
                </View>
                <Text className="mt-0.5 text-sm font-semibold text-ink-soft">{c.handle}</Text>
                <Text className="mt-0.5 text-xs text-ink-mute">{c.meta}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkMute} />
            </View>
          </Card>
        ))}
      </View>

      {/* Help hours strip */}
      <Card>
        <Text className="text-sm font-extrabold text-ink">Before you message us</Text>
        <Text className="mt-1.5 text-xs leading-5 text-ink-mute">
          Have your username ready, and a screenshot if something looks wrong. It helps us sort
          things out on the first reply.
        </Text>
        <Pressable
          onPress={() => router.push('/legal/faq')}
          className="mt-3 flex-row items-center gap-1.5 self-start active:opacity-70"
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.blue600} />
          <Text className="text-xs font-bold text-blue-600">Check the FAQ first</Text>
        </Pressable>
      </Card>

      <Text className="text-center text-[11px] text-ink-mute">
        Pasha9 support will never ask for your password. Keep it private.
      </Text>
    </Screen>
  );
}
