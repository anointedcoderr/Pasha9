// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useLang } from '@/lib/i18n/context';
import { LifeBuoy, Send, MessageCircle, Mail, ChevronDown, AlertCircle, Phone, CheckCircle2 } from 'lucide-react';

interface ClientContacts {
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
}

// FAQ copy is bilingual and deliberately avoids hardcoded commission
// percentages: rates are operator-configurable tiers, so the answer
// points players at the affiliate page which always shows live values.
function buildFaq(bn: boolean): Array<{ q: string; a: string }> {
  return [
    {
      q: bn ? 'ডিপোজিট হতে কত সময় লাগে?' : 'How long does a deposit take?',
      a: bn
        ? 'অ্যাডমিন যাচাইয়ের পর বেশিরভাগ ডিপোজিট ৫ থেকে ১৫ মিনিটের মধ্যে প্রসেস হয়।'
        : 'Most deposits are processed within 5 to 15 minutes after admin verification.',
    },
    {
      q: bn ? 'উইথড্রয়াল কখন পরিশোধ করা হয়?' : 'When are withdrawals paid out?',
      a: bn
        ? 'উইথড্রয়াল পর্যালোচনার পর সাধারণত কর্মঘণ্টার মধ্যে ৩০ মিনিটেরও কম সময়ে প্রসেস হয়।'
        : 'Withdrawals are reviewed and typically processed in under 30 minutes during business hours.',
    },
    {
      q: bn ? 'রেফারেল কমিশন কীভাবে কাজ করে?' : 'How does the referral commission work?',
      a: bn
        ? 'তিন স্তরের রেফারেল কমিশন আপনার অ্যাফিলিয়েট টিয়ার অনুযায়ী নির্ধারিত হয়। বর্তমান রেট দেখতে অ্যাফিলিয়েট পেজ দেখুন।'
        : 'Commission is paid across three referral levels and the rate depends on your affiliate tier. See the Affiliate page for the current rates.',
    },
    {
      q: bn ? 'আমি কি একাধিক অ্যাকাউন্ট রাখতে পারি?' : 'Can I have more than one account?',
      a: bn
        ? 'প্রতিটি প্লেয়ারের জন্য একটি অ্যাকাউন্ট। একাধিক অ্যাকাউন্ট ব্যবহারে অ্যাকাউন্ট স্থগিত হতে পারে।'
        : 'Each player must use a single account. Multi-accounting may result in suspension.',
    },
    {
      q: bn ? 'সর্বনিম্ন বেট কত?' : 'What is the minimum bet?',
      a: bn
        ? 'বেশিরভাগ গেমে সর্বনিম্ন বেট ১০ টাকা থেকে শুরু। সঠিক রেঞ্জ জানতে গেম কার্ড দেখুন।'
        : 'Most games start from 10 BDT minimum bet. Check the game card for the exact range.',
    },
  ];
}

interface AuthInfo { signedIn: boolean; username: string | null; phone: string | null }

export default function SupportPage() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [contacts, setContacts] = useState<ClientContacts | null>(null);
  const [auth, setAuth] = useState<AuthInfo>({ signedIn: false, username: null, phone: null });
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ subject?: string; message?: string; email?: string; phone?: string; form?: string }>({});
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const FAQ = buildFaq(bn);

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
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.username) {
          setAuth({ signedIn: true, username: data.user.username, phone: data.user.phone ?? null });
        } else {
          setAuth({ signedIn: false, username: null, phone: null });
        }
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmittedId(null);
    // Inline validation mirrors the server schema.
    const next: typeof errors = {};
    if (subject.trim().length < 3) next.subject = bn ? 'বিষয় কমপক্ষে ৩ অক্ষরের হতে হবে।' : 'Subject must be at least 3 characters.';
    if (message.trim().length < 10) next.message = bn ? 'বার্তা কমপক্ষে ১০ অক্ষরের হতে হবে।' : 'Message must be at least 10 characters.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = bn ? 'সঠিক ইমেইল দিন।' : 'Enter a valid email.';
    if (!auth.signedIn && !email.trim() && !phone.trim()) next.form = bn ? 'আপনার সাথে যোগাযোগের জন্য একটি ইমেইল বা ফোন নম্বর দিন।' : 'Provide an email or phone so we can reach you back.';
    if (Object.keys(next).length > 0) { setErrors(next); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          name: name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        if (r.status === 429) {
          setErrors({ form: bn ? 'অনেকবার জমা দেওয়া হয়েছে। এক ঘণ্টা পরে আবার চেষ্টা করুন।' : 'Too many submissions. Please wait an hour and try again.' });
        } else {
          setErrors({ form: j?.message ?? j?.code ?? (bn ? 'টিকিট জমা দেওয়া যায়নি।' : 'Could not submit ticket.') });
        }
        return;
      }
      setSubmittedId(j?.ticket?.id ?? 'ok');
      setSubject(''); setMessage(''); setName(''); setEmail(''); setPhone('');
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : (bn ? 'নেটওয়ার্ক ত্রুটি।' : 'Network error.') });
    } finally {
      setSubmitting(false);
    }
  };

  const noContacts = contacts !== null && !contacts.telegram && !contacts.whatsapp && !contacts.email && !contacts.phone;

  return (
    <>
      <PageHeader
        title={bn ? 'সাপোর্ট সেন্টার' : 'Support Center'}
        subtitle={bn ? 'টিমের সাথে যোগাযোগ করুন, সাধারণ প্রশ্ন দেখুন, টিকিট পাঠান' : 'Reach the team, browse common questions, send a ticket'}
        icon={<LifeBuoy className="h-5 w-5" />}
      />

      {noContacts ? (
        <Card padding="md" className="mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
            <p className="text-sm text-ink-mid">
              {bn
                ? 'পাবলিক সাপোর্ট কন্টাক্ট এখনো কনফিগার করা হয়নি। নিচের সাপোর্ট টিকিট ফর্মের মাধ্যমে টিমের সাথে যোগাযোগ করুন।'
                : 'Public support contacts are not configured yet. Reach the team via the support ticket form below.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {contacts?.telegram ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#229ED9]/15 text-[#229ED9]"><Send className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">{bn ? 'টেলিগ্রাম' : 'Telegram'}</h3>
              <p className="mt-1 text-sm text-ink-mid">{bn ? 'টেলিগ্রামে টিমের সাথে সরাসরি চ্যাট করুন।' : 'Chat with the team in real time on Telegram.'}</p>
              <a href={contacts.telegram} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">{bn ? 'টেলিগ্রাম খুলুন' : 'Open Telegram'}</a>
            </Card>
          ) : null}
          {contacts?.whatsapp ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]"><MessageCircle className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">{bn ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</h3>
              <p className="mt-1 text-sm text-ink-mid">{bn ? 'জরুরি সমস্যার জন্য দ্রুততম চ্যানেল।' : 'Fastest channel for urgent issues.'}</p>
              <a href={contacts.whatsapp} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">{bn ? 'হোয়াটসঅ্যাপ খুলুন' : 'Open WhatsApp'}</a>
            </Card>
          ) : null}
          {contacts?.email ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300"><Mail className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">{bn ? 'ইমেইল' : 'Email'}</h3>
              <p className="mt-1 text-sm text-ink-mid">{bn ? 'অ্যাকাউন্ট বা কেওয়াইসি বিষয়ে ইমেইল ব্যবহার করুন।' : 'Use email for account or KYC matters.'}</p>
              <a href={`mailto:${contacts.email}`} className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">{contacts.email}</a>
            </Card>
          ) : null}
          {contacts?.phone ? (
            <Card padding="md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Phone className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-ink-hi">{bn ? 'ফোন' : 'Phone'}</h3>
              <p className="mt-1 text-sm text-ink-mid">{bn ? 'কর্মঘণ্টার মধ্যে উপলব্ধ।' : 'Available during business hours.'}</p>
              <a href={`tel:${contacts.phone.replace(/[^+\d]/g, '')}`} className="mt-3 inline-block text-sm text-neon hover:text-ink-hi">{contacts.phone}</a>
            </Card>
          ) : null}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader
            title={bn ? 'টিকিট পাঠান' : 'Send a ticket'}
            subtitle={auth.signedIn
              ? (bn ? `${auth.username} হিসেবে পোস্ট করছেন` : `Posting as ${auth.username}`)
              : (bn ? 'আমরা সাধারণত এক ঘণ্টার মধ্যে উত্তর দিই' : 'We usually respond within an hour')}
          />
          {submittedId ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-signal-ok">
                  <CheckCircle2 className="h-4 w-4" /> {bn ? 'টিকিট জমা হয়েছে' : 'Ticket submitted'}
                </p>
                <p className="mt-1 text-xs text-signal-ok">
                  {bn ? 'রেফারেন্স' : 'Reference'}: <code className="font-mono">{submittedId}</code>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-signal-ok">
                  {bn
                    ? 'আপনার দেওয়া কন্টাক্টে আমাদের টিম উত্তর দেবে। ফলো-আপের জন্য রেফারেন্সটি সংরক্ষণ করুন।'
                    : 'Our team will respond on the contact you provided. Keep this reference for follow-up.'}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setSubmittedId(null)}>{bn ? 'আরেকটি পাঠান' : 'Send another'}</Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              {!auth.signedIn ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField label={bn ? 'আপনার নাম (ঐচ্ছিক)' : 'Your name (optional)'}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={bn ? 'পুরো নাম' : 'Full name'} />
                  </FormField>
                  <FormField label={bn ? 'ইমেইল' : 'Email'} error={errors.email}>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </FormField>
                  <FormField label={bn ? 'ফোন (ঐচ্ছিক)' : 'Phone (optional)'} error={errors.phone}>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                  </FormField>
                </div>
              ) : null}
              <FormField label={bn ? 'বিষয়' : 'Subject'} required error={errors.subject}>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={bn ? 'ডিপোজিট ক্রেডিট হয়নি, ট্রানজেকশন আইডি, ইত্যাদি' : 'Deposit not credited, transaction ID, etc.'} />
              </FormField>
              <FormField label={bn ? 'বার্তা' : 'Message'} required error={errors.message}>
                <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={bn ? 'কী ঘটেছে বর্ণনা করুন, টিএক্স আইডি বা স্ক্রিনশট রেফারেন্স দিন।' : 'Describe what happened, share TX IDs or screenshot references.'} />
              </FormField>
              {errors.form ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
              ) : null}
              <Button type="submit" loading={submitting}>{bn ? 'টিকিট জমা দিন' : 'Submit ticket'}</Button>
            </form>
          )}
        </Card>

        <Card padding="lg" id="faq">
          <CardHeader
            title={bn ? 'সাধারণ প্রশ্ন' : 'FAQ'}
            subtitle={bn ? 'সবচেয়ে বেশি জিজ্ঞাসিত প্রশ্নের দ্রুত উত্তর' : 'Quick answers for the most common questions'}
          />
          <div className="space-y-2">
            {FAQ.map((item, idx) => (
              <button
                key={item.q}
                type="button"
                onClick={() => setOpenIdx((c) => (c === idx ? null : idx))}
                aria-expanded={openIdx === idx}
                aria-controls={`support-faq-panel-${idx}`}
                className="w-full rounded-xl border border-neon/10 bg-base-deep/40 px-4 py-3 text-left transition hover:border-neon/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink-hi">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-ink-lo transition ${openIdx === idx ? 'rotate-180 text-neon' : ''}`} />
                </div>
                {openIdx === idx ? <p id={`support-faq-panel-${idx}`} className="mt-2 text-sm text-ink-mid">{item.a}</p> : null}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
