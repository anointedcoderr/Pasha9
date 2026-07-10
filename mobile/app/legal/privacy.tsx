// Built by Anointed Coder.
//
// Privacy Policy. Static, readable placeholder copy. Same Screen + hub
// header pattern as the other legal pages.

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card } from '@/components/ui';
import { LegalHeader } from './index';

export default function PrivacyScreen() {
  return (
    <Screen header={<LegalHeader title="Privacy Policy" />} contentClassName="gap-6 pb-16">
      <View className="gap-1">
        <Text className="text-2xl font-black text-ink">Privacy Policy</Text>
        <Text className="text-xs text-ink-mute">Last updated 1 July 2026</Text>
      </View>

      <Card className="border-blue-500/25 bg-blue-500/10">
        <Text className="text-sm leading-6 text-ink-soft">
          Your trust matters to us. This policy sets out what we collect, why we collect it,
          and the choices you have. We only ask for the details we need to run your account
          safely.
        </Text>
      </Card>

      <Section title="What we collect">
        <P>
          When you sign up we store your username, phone number, and login details. As you
          play we record wallet activity, game history, and the device you use so we can keep
          your account secure and support you when something goes wrong.
        </P>
      </Section>

      <Section title="How we use it">
        <P>
          We use your data to run games, process deposits and withdrawals, prevent fraud, and
          send account updates. We may also use it to shape the promotions you see, so the
          offers feel relevant rather than random.
        </P>
      </Section>

      <Section title="Who we share with">
        <P>
          We do not sell your personal data. We share it only with the payment and verification
          partners that help us run the service, and with authorities when the law requires it.
          Every partner is held to strict handling rules.
        </P>
      </Section>

      <Section title="How we protect it">
        <P>
          Sensitive details are encrypted in transit, access is limited to staff who need it,
          and we monitor for unusual activity. No system is perfect, so we also ask you to
          guard your password and use a strong one.
        </P>
      </Section>

      <Section title="Your choices">
        <P>
          You can ask to see the data we hold, correct it, or request that we close your
          account. You can also turn off marketing messages while still receiving the account
          alerts you need. Reach out through Support to make any of these requests.
        </P>
      </Section>

      <Section title="Cookies and analytics">
        <P>
          We use a small set of tools to understand how the app is used so we can make it
          faster and clearer. These tools work with grouped data and are not used to track you
          across other apps.
        </P>
      </Section>

      <Text className="text-xs leading-5 text-ink-mute">
        Want a copy of your data or have a privacy question? The Support page is the fastest
        way to reach us.
      </Text>
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
