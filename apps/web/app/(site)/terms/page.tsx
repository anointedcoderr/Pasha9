import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { ScrollText } from 'lucide-react';

const SECTIONS = [
  { t: 'Eligibility', b: 'Users must be of legal age in their jurisdiction to register. By creating an account, you confirm you meet all local requirements for participating on this platform.' },
  { t: 'Account Use', b: 'One account per person. Sharing credentials, multi-accounting, or using automated tools is not allowed and may result in suspension.' },
  { t: 'Deposits', b: 'Deposits become available after admin verification. Always confirm the destination details before sending a payment.' },
  { t: 'Withdrawals', b: 'Withdrawals are processed manually by the admin team. Standard turnaround is under 30 minutes during operating hours.' },
  { t: 'Bonuses', b: 'Each bonus carries its own conditions including minimum deposit, expiry, and wagering requirements. Review the promotion page before claiming.' },
  { t: 'Fair Play', b: 'Game outcomes are determined by licensed providers or audited RNG logic. The platform does not interfere with individual player outcomes.' },
  { t: 'Disputes', b: 'Open a support ticket with all references for any dispute. We aim to respond within one hour and resolve issues within one business day.' },
  { t: 'Changes', b: 'These terms may be updated. Continued use of the platform constitutes acceptance of any future updates.' },
];

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms and Conditions" subtitle="Plain language summary of how the platform operates" icon={<ScrollText className="h-5 w-5" />} />
      <Card padding="lg" className="space-y-5">
        {SECTIONS.map((s, i) => (
          <article key={s.t}>
            <h2 className="text-base font-semibold text-ink-hi">{i + 1}. {s.t}</h2>
            <p className="mt-1 max-w-[70ch] text-base leading-relaxed text-ink-mid">{s.b}</p>
          </article>
        ))}
      </Card>
    </>
  );
}
