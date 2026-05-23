// Built by Anointed Coder.
// Two large promotional cards stacked or side by side: Refer & Earn,
// Exclusive Betting Pass. Link to /affiliate and /betting-pass.

'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

export function PromoPair() {
  const t = useT();
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <PromoCard
        kicker={t('home.pair.referKicker')}
        title={t('home.pair.referTitle')}
        body={t('home.pair.referBody')}
        cta={t('home.pair.referCta')}
        href="/affiliate"
        art={<ReferArt />}
        gradient="from-brand-ink to-brand-navInkSoft"
      />
      <PromoCard
        kicker={t('home.pair.passKicker')}
        title={t('home.pair.passTitle')}
        body={t('home.pair.passBody')}
        cta={t('home.pair.passCta')}
        href="/betting-pass"
        art={<PassArt />}
        gradient="from-brand-blue-700 to-brand-blue-500"
      />
    </section>
  );
}

function PromoCard({
  kicker,
  title,
  body,
  cta,
  href,
  art,
  gradient,
}: {
  kicker: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  art: React.ReactNode;
  gradient: string;
}) {
  return (
    <article className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} text-white`}>
      <div aria-hidden className="absolute inset-0 opacity-90">{art}</div>
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-6 md:px-7 md:py-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-400">{kicker}</p>
          <h3 className="mt-1.5 text-xl font-extrabold leading-tight md:text-2xl">{title}</h3>
          <p className="mt-2 max-w-sm text-sm text-white/80">{body}</p>
          <Link
            href={href}
            className="btn-yellow mt-4 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold text-brand-ink"
          >
            {cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function ReferArt() {
  return (
    <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full">
      <g transform="translate(260 50)">
        <rect x="0" y="0" width="120" height="120" rx="14" fill="#FFCC00" />
        <rect x="0" y="50" width="120" height="18" fill="#0F1115" opacity="0.35" />
        <rect x="51" y="0" width="18" height="120" fill="#0F1115" opacity="0.35" />
        <circle cx="60" cy="14" r="14" fill="#FFCC00" stroke="#0F1115" strokeWidth="2.5" />
        <path d="M52 18 L60 8 L68 18" stroke="#0F1115" strokeWidth="2.5" fill="none" />
      </g>
      <g transform="translate(60 130)" stroke="#FFCC00" strokeWidth="2" fill="none">
        <circle cx="20" cy="20" r="14" />
        <circle cx="56" cy="20" r="14" />
        <path d="M34 20 L42 20" />
      </g>
    </svg>
  );
}

function PassArt() {
  return (
    <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full">
      <g transform="translate(250 20)" opacity="0.95">
        <rect x="0" y="0" width="120" height="180" rx="18" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.45)" />
        <rect x="14" y="14" width="92" height="38" rx="6" fill="#FFCC00" />
        <text x="60" y="40" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0F1115">PASS</text>
        <rect x="14" y="62" width="92" height="6" rx="3" fill="rgba(255,255,255,0.6)" />
        <rect x="14" y="74" width="72" height="6" rx="3" fill="rgba(255,255,255,0.4)" />
        <rect x="14" y="92" width="92" height="42" rx="6" fill="rgba(255,255,255,0.15)" />
        <text x="60" y="118" textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFFFFF" letterSpacing="2">VIP</text>
      </g>
    </svg>
  );
}
