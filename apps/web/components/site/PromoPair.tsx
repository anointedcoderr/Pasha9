// Built by Anointed Coder.
// Two large promotional cards stacked or side by side: Refer & Earn,
// Exclusive Betting Pass. Defaults link to /affiliate and /betting-pass
// but every text + link + image is admin-overridable via the
// /api/content/homepage-promo-pair endpoint which reads SystemSetting
// rows. Empty admin values fall back to the bundled i18n strings + art
// so a fresh database still renders something meaningful.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';

interface PromoPairConfig {
  refer: {
    kicker: string | null;
    kickerBn: string | null;
    title: string | null;
    titleBn: string | null;
    body: string | null;
    bodyBn: string | null;
    cta: string | null;
    ctaBn: string | null;
    href: string | null;
    imageUrl: string | null;
  };
  pass: {
    kicker: string | null;
    kickerBn: string | null;
    title: string | null;
    titleBn: string | null;
    body: string | null;
    bodyBn: string | null;
    cta: string | null;
    ctaBn: string | null;
    href: string | null;
    imageUrl: string | null;
  };
}

const pickLang = (en: string | null, bn: string | null, fallback: string, lang: 'en' | 'bn'): string => {
  if (lang === 'bn') return (bn && bn.trim()) || (en && en.trim()) || fallback;
  return (en && en.trim()) || fallback;
};

export function PromoPair() {
  const t = useT();
  const { lang } = useLang();
  const [config, setConfig] = useState<PromoPairConfig | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/homepage-promo-pair', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.refer && j?.pass) setConfig(j as PromoPairConfig);
      })
      .catch(() => { /* defaults render */ });
    return () => { alive = false; };
  }, []);

  const refer = config?.refer;
  const pass = config?.pass;

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <PromoCard
        kicker={pickLang(refer?.kicker ?? null, refer?.kickerBn ?? null, t('home.pair.referKicker'), lang)}
        title={pickLang(refer?.title ?? null, refer?.titleBn ?? null, t('home.pair.referTitle'), lang)}
        body={pickLang(refer?.body ?? null, refer?.bodyBn ?? null, t('home.pair.referBody'), lang)}
        cta={pickLang(refer?.cta ?? null, refer?.ctaBn ?? null, t('home.pair.referCta'), lang)}
        href={refer?.href || '/affiliate'}
        imageUrl={refer?.imageUrl ?? null}
        art={<ReferArt />}
        gradient="from-brand-ink to-brand-navInkSoft"
      />
      <PromoCard
        kicker={pickLang(pass?.kicker ?? null, pass?.kickerBn ?? null, t('home.pair.passKicker'), lang)}
        title={pickLang(pass?.title ?? null, pass?.titleBn ?? null, t('home.pair.passTitle'), lang)}
        body={pickLang(pass?.body ?? null, pass?.bodyBn ?? null, t('home.pair.passBody'), lang)}
        cta={pickLang(pass?.cta ?? null, pass?.ctaBn ?? null, t('home.pair.passCta'), lang)}
        href={pass?.href || '/betting-pass'}
        imageUrl={pass?.imageUrl ?? null}
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
  imageUrl,
  art,
  gradient,
}: {
  kicker: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  imageUrl: string | null;
  art: React.ReactNode;
  gradient: string;
}) {
  return (
    <article className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} text-white`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-55" />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-90">{art}</div>
      )}
      {/* Right-side fade so the SVG art / image never visually
          collides with the headline at narrow widths. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-black/45 to-transparent md:w-1/2" />
      <div className="relative flex min-h-[160px] flex-col justify-center gap-2 px-4 py-5 md:px-7 md:py-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-yellow-400 [text-shadow:0_1px_4px_rgba(0,0,0,0.85)] md:text-[11px]">{kicker}</p>
        <h3 className="max-w-[18ch] text-lg font-extrabold leading-snug [text-shadow:0_1px_8px_rgba(0,0,0,0.85)] md:text-2xl">{title}</h3>
        <p className="max-w-[28ch] text-xs leading-relaxed text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,0.75)] md:max-w-sm md:text-sm">{body}</p>
        <Link
          href={href}
          className="btn-yellow mt-2 inline-flex h-10 w-max items-center gap-2 rounded-lg px-4 text-sm font-bold text-brand-ink"
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </Link>
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
