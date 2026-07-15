// Built by Anointed Coder.
//
// FAQ. A tappable accordion list. One item opens at a time; the chevron
// flips and the answer expands. Static placeholder questions and answers.

import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from 'react-native';
import { Screen } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { LegalHeader } from './index';

// Enable the simple expand animation on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'How do I create an account?',
    a: 'Tap Register, add a username, your Bangladesh phone number, and a password, then agree to the terms. Your account is ready straight away.',
  },
  {
    q: 'How long do deposits take?',
    a: 'Most deposits land in your wallet within a minute. If a payment is still pending after a few minutes, message Support with your reference and we will check it.',
  },
  {
    q: 'When will my withdrawal arrive?',
    a: 'Withdrawals are reviewed and then paid to a verified method in your name. Standard payouts complete within a few hours, and larger amounts may take a little longer.',
  },
  {
    q: 'Why do I need to verify my identity?',
    a: 'Verification keeps accounts safe and meets our legal duties. It is a one-time step for most players and helps your withdrawals clear faster.',
  },
  {
    q: 'How do bonus wagering requirements work?',
    a: 'A wagering requirement is how many times you play through a bonus before it can be withdrawn. Each promotion lists its own requirement in the offer details.',
  },
  {
    q: 'I forgot my password. What now?',
    a: 'Open the login screen, tap Forgot password, and enter your phone number. We send a one-time code so you can set a new password in seconds.',
  },
  {
    q: 'Can I set limits on my play?',
    a: 'Yes. The Responsible Gaming page lets you set deposit limits, session reminders, and breaks. Support can also set these up for you on request.',
  },
];

export default function FaqScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((cur) => (cur === i ? null : i));
  };

  return (
    <Screen header={<LegalHeader title="FAQ" />} contentClassName="gap-5 pb-16">
      <View className="gap-1">
        <Text className="text-2xl font-black text-ink">Frequently asked</Text>
        <Text className="text-sm text-ink-mute">
          Tap a question to see the answer. Still stuck? Support is one tap away.
        </Text>
      </View>

      <View className="gap-3">
        {FAQS.map((item, i) => {
          const open = openIndex === i;
          return (
            <View
              key={item.q}
              className={cn(
                'overflow-hidden rounded-2xl border bg-paper',
                open ? 'border-gold-600/40' : 'border-divider',
              )}
            >
              <Pressable
                onPress={() => toggle(i)}
                className="flex-row items-center gap-3 p-4 active:bg-surfaceAlt"
              >
                <Text className="flex-1 text-sm font-extrabold text-ink">{item.q}</Text>
                <View
                  className={cn(
                    'h-7 w-7 items-center justify-center rounded-full',
                    open ? 'bg-gold-500' : 'bg-surfaceAlt',
                  )}
                >
                  <Icon
                    name={open ? 'remove' : 'add'}
                    size={18}
                    color={open ? colors.ink : colors.inkSoft}
                  />
                </View>
              </Pressable>
              {open ? (
                <View className="border-t border-divider px-4 pb-4 pt-3">
                  <Text className="text-sm leading-6 text-ink-soft">{item.a}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
