// Built by Anointed Coder.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/constants/brand';
import { ROUTES } from '@/lib/constants/routes';
import { useT, useLang } from '@/lib/i18n/context';
import { Send, MessageCircle, Mail } from 'lucide-react';
import { Logo } from './Logo';

interface ClientContacts {
  siteName: string;
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
}

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

  const hasAnyClientContact = !!(contacts?.telegram || contacts?.whatsapp || contacts?.email);

  return (
    <footer className="mt-16 border-t border-neon/10 bg-base-deep/80">
      <div className="mx-auto max-w-page px-4 py-12 md:px-6">
        <div className={`grid gap-10 ${hasAnyClientContact ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <div>
            <Logo />
            <p className="mt-4 text-sm text-ink-mid">{t('footer.tagline')}</p>
            <p className="mt-3 text-xs text-ink-lo">{t('footer.compliance')}</p>
          </div>

          <FooterCol title={t('footer.support')}>
            <Link href={ROUTES.support}>{lang === 'bn' ? 'সাপোর্ট সেন্টার' : 'Support Center'}</Link>
            <a href="#faq">{lang === 'bn' ? 'প্রশ্নোত্তর' : 'FAQ'}</a>
            <Link href={ROUTES.terms}>{lang === 'bn' ? 'শর্তাবলী' : 'Terms'}</Link>
            <Link href={ROUTES.responsible}>{lang === 'bn' ? 'দায়িত্বশীল গেমিং' : 'Responsible Gaming'}</Link>
          </FooterCol>

          <FooterCol title={t('footer.legal')}>
            <a href="#privacy">{lang === 'bn' ? 'প্রাইভেসি' : 'Privacy'}</a>
            <a href="#about">{lang === 'bn' ? 'আমাদের সম্পর্কে' : 'About'}</a>
            <a href="#kyc">{lang === 'bn' ? 'কেওয়াইসি নীতি' : 'KYC Policy'}</a>
          </FooterCol>

          {hasAnyClientContact ? (
            <FooterCol title={t('footer.follow')}>
              {contacts?.telegram ? (
                <a href={contacts.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#229ED9]/15 text-[#229ED9]"><Send className="h-3.5 w-3.5" /></span>
                  Telegram
                </a>
              ) : null}
              {contacts?.whatsapp ? (
                <a href={contacts.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#25D366]/15 text-[#25D366]"><MessageCircle className="h-3.5 w-3.5" /></span>
                  WhatsApp
                </a>
              ) : null}
              {contacts?.email ? (
                <a href={`mailto:${contacts.email}`} className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold-500/15 text-gold-300"><Mail className="h-3.5 w-3.5" /></span>
                  {contacts.email}
                </a>
              ) : null}
            </FooterCol>
          ) : null}
        </div>

        <div className="mt-10 border-t border-neon/10 pt-6">
          <p className="text-xs text-ink-lo">
            © {new Date().getFullYear()} {contacts?.siteName ?? BRAND.display}.{' '}
            {lang === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All rights reserved.'}
          </p>

          <p className="mt-3 inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
            <span>{BRAND.developer.label}</span>
            <a href={`mailto:${BRAND.developer.email}`} className="inline-flex items-center gap-1.5 hover:text-ink-mid">
              <Mail className="h-3 w-3" />
              {BRAND.developer.email}
            </a>
            <a href={BRAND.developer.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink-mid">
              <Send className="h-3 w-3 text-[#229ED9]" />
              Telegram
            </a>
            <a href={BRAND.developer.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink-mid">
              <MessageCircle className="h-3 w-3 text-[#25D366]" />
              WhatsApp
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-hi">{title}</h4>
      <div className="flex flex-col gap-2 text-sm text-ink-mid [&_a]:transition hover:[&_a]:text-ink-hi">{children}</div>
    </div>
  );
}
