// Built by Anointed Coder.
// Dark footer with Babu88-inspired sections: Brand Ambassadors, Sponsorships,
// Payment Methods, Responsible Gaming, Follow Us, brand block, SEO description.
// The very bottom line is a small developer credit.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/constants/brand';
import { ROUTES } from '@/lib/constants/routes';
import { useT, useLang } from '@/lib/i18n/context';
import { Send, MessageCircle, Mail, Shield, Facebook, Youtube, Instagram, Twitter } from 'lucide-react';

interface ClientContacts {
  siteName: string;
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
}

interface AmbassadorRow {
  name: string;
  period: string;
}

interface SponsorRow {
  name: string;
  period: string;
}

const AMBASSADORS: AmbassadorRow[] = [
  { name: 'Brand Ambassador One', period: '2025/2026' },
  { name: 'Brand Ambassador Two', period: '2025/2026' },
];

const SPONSORS: SponsorRow[] = [
  { name: 'Pasha 9 Cricket Partner', period: '2025/2026' },
  { name: 'Pasha 9 Football Partner', period: '2025/2026' },
  { name: 'Pasha 9 Esports Partner', period: '2025/2026' },
];

const PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Upay'];

export function Footer() {
  const t = useT();
  const { lang } = useLang();
  const [contacts, setContacts] = useState<ClientContacts | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/contacts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) {
          setContacts({
            siteName: data.siteName ?? BRAND.display,
            telegram: data.telegram ?? null,
            whatsapp: data.whatsapp ?? null,
            email: data.email ?? null,
          });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <footer className="mt-16 border-t border-brand-divider bg-brand-navInk text-white">
      <div className="mx-auto max-w-page px-4 py-12 md:px-6">

        <FooterSection label="Brand Ambassadors">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {AMBASSADORS.map((a) => (
              <div key={a.name} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[10px] uppercase text-white">
                  {a.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{a.name}</p>
                  <p className="text-[11px] text-white/60">{a.period}</p>
                </div>
              </div>
            ))}
          </div>
        </FooterSection>

        <FooterSection label="Sponsorships">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
            {SPONSORS.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-[10px] uppercase text-white">
                  {s.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{s.name}</p>
                  <p className="text-[11px] text-white/60">{s.period}</p>
                </div>
              </div>
            ))}
          </div>
        </FooterSection>

        <div className="grid gap-8 md:grid-cols-2">
          <FooterSection label="Payment Methods">
            <div className="flex flex-wrap gap-3">
              {PAYMENT_METHODS.map((m) => (
                <span key={m} className="inline-flex h-10 items-center rounded-md border border-white/15 bg-white/[0.04] px-3 text-xs font-semibold uppercase text-white/85">
                  {m}
                </span>
              ))}
            </div>
          </FooterSection>

          <FooterSection label="Responsible Gaming">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/85">
                <Shield className="h-5 w-5" />
              </span>
              <span className="flex h-10 items-center rounded-md border border-white/15 bg-white/[0.04] px-3 text-xs font-semibold uppercase text-white/85">
                18+ ONLY
              </span>
            </div>
          </FooterSection>
        </div>

        <div className="my-10 h-px bg-white/10" />

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-lg font-extrabold text-white">{contacts?.siteName ?? BRAND.display}</p>
            <p className="mt-1 text-sm font-semibold text-brand-yellow-400">Official</p>
            <p className="mt-3 text-sm text-white/70">
              {lang === 'bn'
                ? 'বাংলাদেশের প্রিমিয়াম গেমিং এবং বেটিং প্ল্যাটফর্ম। নিরাপদ লেনদেন, দ্রুত পেআউট, ২৪ ঘণ্টা সাপোর্ট।'
                : 'Premium gaming and betting platform built for Bangladesh. Secure transactions, fast payouts, round the clock support.'}
            </p>
            <p className="mt-3 text-xs text-white/45">
              © {new Date().getFullYear()} {contacts?.siteName ?? BRAND.display}. {lang === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All rights reserved.'}
            </p>

            <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
              <Link href={ROUTES.terms}>{lang === 'bn' ? 'শর্তাবলী' : 'Terms'}</Link>
              <Link href={ROUTES.responsible}>{lang === 'bn' ? 'দায়িত্বশীল গেমিং' : 'Responsible Gaming'}</Link>
              <Link href={ROUTES.support}>{lang === 'bn' ? 'সাপোর্ট' : 'Support'}</Link>
              <a href="#privacy">{lang === 'bn' ? 'প্রাইভেসি' : 'Privacy'}</a>
            </nav>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white">{t('footer.follow')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {contacts?.telegram ? (
                <SocialPill href={contacts.telegram} label="Telegram" icon={<Send className="h-4 w-4" />} />
              ) : null}
              {contacts?.whatsapp ? (
                <SocialPill href={contacts.whatsapp} label="WhatsApp" icon={<MessageCircle className="h-4 w-4" />} />
              ) : null}
              {contacts?.email ? (
                <SocialPill href={`mailto:${contacts.email}`} label={contacts.email} icon={<Mail className="h-4 w-4" />} external={false} />
              ) : null}
              <SocialPill href="#facebook" label="Facebook" icon={<Facebook className="h-4 w-4" />} />
              <SocialPill href="#youtube" label="YouTube" icon={<Youtube className="h-4 w-4" />} />
              <SocialPill href="#instagram" label="Instagram" icon={<Instagram className="h-4 w-4" />} />
              <SocialPill href="#x" label="X" icon={<Twitter className="h-4 w-4" />} />
            </div>
            {!contacts?.telegram && !contacts?.whatsapp && !contacts?.email ? (
              <p className="mt-3 text-[11px] text-white/45">
                {lang === 'bn'
                  ? 'অ্যাডমিন থেকে পাবলিক সাপোর্ট চ্যানেল কনফিগার করুন।'
                  : 'Configure public support channels from admin Settings.'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5">
          <p className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/45">
            <span>
              Built by{' '}
              <a
                href={BRAND.developer.website}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline"
              >
                {BRAND.developer.name}
              </a>
            </span>
            <a href={`mailto:${BRAND.developer.email}`} className="inline-flex items-center gap-1.5 hover:text-white">
              <Mail className="h-3 w-3" />
              {BRAND.developer.email}
            </a>
            <a href={BRAND.developer.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
              <Send className="h-3 w-3 text-[#229ED9]" />
              Telegram
            </a>
            <a href={BRAND.developer.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
              <MessageCircle className="h-3 w-3 text-[#25D366]" />
              WhatsApp
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-yellow-400">{label}</p>
      {children}
    </section>
  );
}

function SocialPill({
  href,
  label,
  icon,
  external = true,
}: { href: string; label: string; icon: React.ReactNode; external?: boolean }) {
  const isMailto = href.startsWith('mailto:');
  return (
    <a
      href={href}
      target={external && !isMailto ? '_blank' : undefined}
      rel={external && !isMailto ? 'noreferrer' : undefined}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 text-xs font-semibold text-white/85 hover:border-white/40 hover:text-white"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
