// Built by Anointed Coder.
//
// Responsible Gaming. A calm, supportive page with the tools players can use
// to stay in control, plus where to find help. Static placeholder content.

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/lib/theme';
import { LegalHeader } from './index';

type IconName = string;

const TOOLS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'wallet-outline',
    title: 'Deposit limits',
    body: 'Set a daily, weekly, or monthly cap so your spending stays where you want it.',
  },
  {
    icon: 'time-outline',
    title: 'Session reminders',
    body: 'Get a gentle nudge after a set time so you always know how long you have played.',
  },
  {
    icon: 'pause-circle-outline',
    title: 'Take a break',
    body: 'Pause your account for a day, a week, or longer whenever you need to step away.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Self-exclusion',
    body: 'Close access for a longer period when you want a firm line rather than a short break.',
  },
];

export default function ResponsibleGamingScreen() {
  return (
    <Screen
      header={<LegalHeader title="Responsible Gaming" />}
      contentClassName="gap-6 pb-16"
    >
      <View className="gap-1">
        <Text className="text-2xl font-black text-ink">Play should stay fun</Text>
        <Text className="text-sm text-ink-mute">
          Gaming is entertainment, not a way to make money. These tools help you keep it that
          way.
        </Text>
      </View>

      <Card className="border-newg/25 bg-newg/10">
        <View className="flex-row gap-3">
          <Icon name="heart-outline" size={20} color={colors.newg} />
          <Text className="flex-1 text-sm leading-6 text-ink-soft">
            Only play with money you can afford to set aside. If a session stops feeling fun,
            that is the right moment to take a break.
          </Text>
        </View>
      </Card>

      <Section title="Tools you can use">
        <View className="gap-3">
          {TOOLS.map((t) => (
            <Card key={t.title} padded={false}>
              <View className="flex-row items-start gap-3 p-3.5">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
                  <Icon name={t.icon} size={19} color={colors.gold700} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-ink">{t.title}</Text>
                  <Text className="mt-0.5 text-xs leading-5 text-ink-mute">{t.body}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Signs to watch for">
        <P>
          Chasing losses, playing longer than you meant to, or borrowing money to keep going
          are all signs that play may no longer be healthy. If any of these feel familiar, it
          helps to pause and talk to someone.
        </P>
      </Section>

      <Section title="Where to get help">
        <P>
          Support is not only about your account. If gaming is affecting your life, please
          reach out to a local support service, and know that our team can guide you to the
          break and self-exclusion tools whenever you ask.
        </P>
      </Section>

      <Card className="items-center">
        <Text className="text-center text-sm font-extrabold text-ink">
          You are always in control
        </Text>
        <Text className="mt-1 text-center text-xs leading-5 text-ink-mute">
          Set a limit today, or message Support and we will help you set one up. There is no
          judgement here, only help.
        </Text>
      </Card>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-base font-extrabold text-ink">{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Text className="text-sm leading-6 text-ink-soft">{children}</Text>;
}
