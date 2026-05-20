'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BRAND } from '@/lib/constants/brand';
import { LifeBuoy, Send, MessageCircle, Mail, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const FAQ = [
  { q: 'How long does a deposit take?', a: 'Most deposits are processed within 5 to 15 minutes after admin verification.' },
  { q: 'When are withdrawals paid out?', a: 'Withdrawals are reviewed and typically processed in under 30 minutes during business hours.' },
  { q: 'How does the referral commission work?', a: 'Three-level commissions of 8 / 4 / 2 percent are calculated from each verified referral deposit.' },
  { q: 'Can I have more than one account?', a: 'Each player must use a single account. Multi-accounting may result in suspension.' },
  { q: 'What is the minimum bet?', a: 'Most games start from 10 BDT minimum bet. Check the game card for the exact range.' },
];

export default function SupportPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <>
      <PageHeader title="Support Center" subtitle="Reach the team, browse common questions, send a ticket" icon={<LifeBuoy className="h-5 w-5" />} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#229ED9]/15 text-[#229ED9]"><Send className="h-5 w-5" /></span>
          <h3 className="mt-3 text-base font-semibold text-ink-hi">Telegram</h3>
          <p className="mt-1 text-xs text-ink-mid">Chat with the team in real time on Telegram.</p>
          <a href={BRAND.telegram} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">Open Telegram →</a>
        </Card>
        <Card padding="md">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]"><MessageCircle className="h-5 w-5" /></span>
          <h3 className="mt-3 text-base font-semibold text-ink-hi">WhatsApp</h3>
          <p className="mt-1 text-xs text-ink-mid">Fastest channel for urgent issues.</p>
          <a href={BRAND.whatsapp} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">Open WhatsApp →</a>
        </Card>
        <Card padding="md">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300"><Mail className="h-5 w-5" /></span>
          <h3 className="mt-3 text-base font-semibold text-ink-hi">Email</h3>
          <p className="mt-1 text-xs text-ink-mid">Use email for account or KYC matters.</p>
          <a href={`mailto:${BRAND.builderEmail}`} className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">{BRAND.builderEmail}</a>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Send a ticket" subtitle="We usually respond within an hour" />
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <FormField label="Subject" required>
              <Input placeholder="Deposit not credited, transaction ID, etc." />
            </FormField>
            <FormField label="Message" required>
              <Textarea rows={6} placeholder="Describe what happened, share TX IDs or screenshots references." />
            </FormField>
            <Button type="submit">Submit ticket</Button>
          </form>
        </Card>

        <Card padding="lg" id="faq">
          <CardHeader title="FAQ" subtitle="Quick answers for the most common questions" />
          <div className="space-y-2">
            {FAQ.map((item, idx) => (
              <button
                key={item.q}
                type="button"
                onClick={() => setOpenIdx((c) => (c === idx ? null : idx))}
                className="w-full rounded-xl border border-neon/10 bg-base-deep/40 px-4 py-3 text-left transition hover:border-neon/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink-hi">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-ink-lo transition ${openIdx === idx ? 'rotate-180 text-neon' : ''}`} />
                </div>
                {openIdx === idx ? <p className="mt-2 text-sm text-ink-mid">{item.a}</p> : null}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
