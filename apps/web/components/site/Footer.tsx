// Built by Anointed Coder.
'use client';

import Link from 'next/link';
import { BRAND } from '@/lib/constants/brand';
import { ROUTES } from '@/lib/constants/routes';
import { useT, useLang } from '@/lib/i18n/context';
import { Send, MessageCircle, Mail } from 'lucide-react';
import { Logo } from './Logo';

export function Footer() {
  const t = useT();
  const { lang } = useLang();

  return (
    <footer className="mt-16 border-t border-neon/10 bg-base-deep/80">
      <div className="mx-auto max-w-page px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-ink-mid">{t('footer.tagline')}</p>
            <p className="mt-3 text-xs text-ink-lo">{t('footer.compliance')}</p>
          </div>
          <FooterCol title={t('footer.support')}>
            <Link href={ROUTES.support}>{lang === 'bn' ? 'সাপোর্ট সেন্টার' : 'Support Center'}</Link>
            <a href="#faq">{lang === 'bn' ? 'প্রশ্নোত্তর' : 'FAQ'}</a>
            <a href={BRAND.telegram} target="_blank" rel="noreferrer">Telegram</a>
            <a href={BRAND.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          </FooterCol>
          <FooterCol title={t('footer.legal')}>
            <Link href={ROUTES.terms}>{lang === 'bn' ? 'শর্তাবলী' : 'Terms'}</Link>
            <Link href={ROUTES.responsible}>{lang === 'bn' ? 'দায়িত্বশীল গেমিং' : 'Responsible Gaming'}</Link>
            <a href="#privacy">{lang === 'bn' ? 'প্রাইভেসি' : 'Privacy'}</a>
          </FooterCol>
          <FooterCol title={t('footer.follow')}>
            <a href={BRAND.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#229ED9]/15 text-[#229ED9]"><Send className="h-3.5 w-3.5" /></span>
              t.me/AnointedCoder
            </a>
            <a href={BRAND.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#25D366]/15 text-[#25D366]"><MessageCircle className="h-3.5 w-3.5" /></span>
              wa.link/fi5z8a
            </a>
            <a href={`mailto:${BRAND.builderEmail}`} className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold-500/15 text-gold-300"><Mail className="h-3.5 w-3.5" /></span>
              {BRAND.builderEmail}
            </a>
          </FooterCol>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-neon/10 pt-6 md:flex-row md:items-center">
          <p className="text-xs text-ink-lo">
            © {new Date().getFullYear()} {BRAND.display}. {lang === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All rights reserved.'}
          </p>
          <p className="text-xs text-ink-mid">
            <span className="text-ink-lo">{BRAND.builtBy}</span>
            <span className="mx-2 text-ink-mute">|</span>
            <a href={`mailto:${BRAND.builderEmail}`} className="hover:text-ink-hi">{BRAND.builderEmail}</a>
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
