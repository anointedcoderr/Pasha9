// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LifeBuoy, Send, MessageCircle, Mail, ChevronDown, AlertCircle, Phone } from 'lucide-react';

interface ClientContacts {
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
}

const FAQ = [
  { q: 'How long does a deposit take?', a: 'Most deposits are processed within 5 to 15 minutes after admin verification.' },
  { q: 'When are withdrawals paid out?', a: 'Withdrawals are reviewed and typically processed in under 30 minutes during business hours.' },
  { q: 'How does the referral commission work?', a: 'Three-level commissions of 8 / 4 / 2 percent are calculated from each verified referral deposit.' },
  { q: 'Can I have more than one account?', a: 'Each player must use a single account. Multi-accounting may result in suspension.' },
  { q: 'What is the minimum bet?', a: 'Most games start from 10 BDT minimum bet. Check the game card for the exact range.' },
];

export default function SupportPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [contacts, setContacts] = useState<ClientContacts | null>(null);

  useEffect(() => {
    fetch('/api/content/contacts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setContacts({
          telegram: data.telegram ?? null,
          whatsapp: data.whatsapp ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
        });
      })
      .catch(() => {});
  }, []);

  const noContacts = contacts !== null && !contacts.telegram && !contacts.whatsapp && !contacts.email && !contacts.phone;

  return (
    <>
      <PageHeader title="Support Center" subtitle="Reach the team, browse common questions, send a ticket" icon={<LifeBuoy className="h-5 w-5" />} />

      {noContacts ? (
        <Card padding="md" className="mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
            <p className="text-sm text-ink-mid">
              Public support contacts are not configured yet. Reach the team via the support ticket form below.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {contacts?.telegram ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#229ED9]/15 text-[#229ED9]"><Send className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">Telegram</h3>
              <p className="mt-1 text-xs text-ink-mid">Chat with the team in real time on Telegram.</p>
              <a href={contacts.telegram} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">Open Telegram</a>
            </Card>
          ) : null}
          {contacts?.whatsapp ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]"><MessageCircle className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">WhatsApp</h3>
              <p className="mt-1 text-xs text-ink-mid">Fastest channel for urgent issues.</p>
              <a href={contacts.whatsapp} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">Open WhatsApp</a>
            </Card>
          ) : null}
          {contacts?.email ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300"><Mail className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">Email</h3>
              <p className="mt-1 text-xs text-ink-mid">Use email for account or KYC matters.</p>
              <a href={`mailto:${contacts.email}`} className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">{contacts.email}</a>
            </Card>
          ) : null}
          {contacts?.phone ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Phone className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">Phone</h3>
              <p className="mt-1 text-xs text-ink-mid">Available during business hours.</p>
              <a href={`tel:${contacts.phone.replace(/[^+\d]/g, '')}`} className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">{contacts.phone}</a>
            </Card>
          ) : null}
        </div>
      )}

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
