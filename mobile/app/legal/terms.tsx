// Built by Anointed Coder.
//
// Terms of Service. Static, readable placeholder copy grouped into short
// sections. Reuses the shared Screen plus the slim back header from the hub.

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card } from '@/components/ui';
import { LegalHeader } from './index';

export default function TermsScreen() {
  return (
    <Screen header={<LegalHeader title="Terms of Service" />} contentClassName="gap-6 pb-16">
      <View className="gap-1">
        <Text className="text-2xl font-black text-ink">Terms of Service</Text>
        <Text className="text-xs text-ink-mute">Last updated 1 July 2026</Text>
      </View>

      <Card className="border-gold-600/25 bg-gold-500/10">
        <Text className="text-sm leading-6 text-ink-soft">
          These terms explain how you may use Pasha9. By creating an account or placing a
          wager you agree to everything on this page. Please read it carefully and keep a
          copy for your records.
        </Text>
      </Card>

      <Section title="1. Eligibility">
        <P>
          You must be at least 18 years old and legally allowed to take part in online gaming
          where you live. We may ask you to verify your age and identity at any time, and we
          may hold or close accounts that do not meet these requirements.
        </P>
      </Section>

      <Section title="2. Your account">
        <P>
          Each player may hold one account. Keep your username and password private, and let
          us know right away if you think someone else has used your login. You are
          responsible for every action taken from your account.
        </P>
      </Section>

      <Section title="3. Deposits and withdrawals">
        <P>
          Funds added to your wallet are meant for play on Pasha9. Withdrawals are paid back
          to a verified method in your name. We may review any transaction to protect players
          and to meet our legal duties before a payout is released.
        </P>
      </Section>

      <Section title="4. Bonuses and promotions">
        <P>
          Every bonus carries its own rules, including wagering requirements and time limits.
          Bonuses are a reward for genuine play. Attempts to abuse an offer may lead to the
          bonus and any winnings from it being removed.
        </P>
      </Section>

      <Section title="5. Fair play">
        <P>
          Games run on tested random outcomes. Using automated tools, exploiting faults, or
          working with others to gain an unfair edge is not allowed and may result in a
          permanent ban.
        </P>
      </Section>

      <Section title="6. Changes to these terms">
        <P>
          We may update these terms as the service grows or as the law changes. When we make a
          meaningful change we will post the new version here and update the date at the top of
          this page. Continued play means you accept the latest version.
        </P>
      </Section>

      <Text className="text-xs leading-5 text-ink-mute">
        Questions about these terms? Reach us any time through the Support page.
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
