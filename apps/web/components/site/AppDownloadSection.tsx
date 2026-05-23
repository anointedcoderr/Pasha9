// Built by Anointed Coder.
// App download promo with a phone mock SVG on the right and a Download Now
// button on the left. The actual APK download link is sourced from the
// SystemSetting `apk_download_url` via /api/content/apk; until it is set,
// the CTA links to /apk with a placeholder visual.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

export function AppDownloadSection() {
  const t = useT();
  const [apk, setApk] = useState<{ url: string | null; version: string | null }>({ url: null, version: null });

  useEffect(() => {
    let alive = true;
    fetch('/api/content/apk')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data) setApk({ url: data.url ?? null, version: data.version ?? null }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const href = apk.url ?? '/apk';
  const external = !!apk.url;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
      <div className="grid items-center gap-4 px-5 py-6 md:grid-cols-[1fr_auto] md:gap-8 md:px-8 md:py-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-700">
            {t('home.app.kicker')}
          </p>
          <h3 className="mt-1.5 text-xl font-extrabold leading-tight text-brand-ink md:text-2xl">
            {t('home.app.title')}
          </h3>
          <p className="mt-2 max-w-md text-sm text-brand-inkSoft">{t('home.app.subtitle')}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              className="btn-yellow inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm"
            >
              <Download className="h-4 w-4" /> {t('home.app.download')}
            </Link>
            <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-divider bg-brand-surface px-4 text-xs font-semibold text-brand-inkSoft">
              <Smartphone className="h-4 w-4" />
              {apk.version ? `v${apk.version}` : t('home.app.android')}
            </span>
          </div>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto h-[220px] w-[140px] md:h-[260px] md:w-[160px]">
      <svg viewBox="0 0 160 260" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1659C2" />
            <stop offset="100%" stopColor="#0F1115" />
          </linearGradient>
          <linearGradient id="phoneScr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFCC00" />
            <stop offset="100%" stopColor="#F5B400" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="152" height="252" rx="20" fill="url(#phoneGrad)" />
        <rect x="14" y="22" width="132" height="216" rx="8" fill="#0F1115" />
        <rect x="20" y="32" width="120" height="60" rx="6" fill="url(#phoneScr)" />
        <rect x="20" y="100" width="56" height="56" rx="6" fill="rgba(255,204,0,0.3)" />
        <rect x="84" y="100" width="56" height="56" rx="6" fill="rgba(30,115,232,0.4)" />
        <rect x="20" y="164" width="120" height="14" rx="4" fill="rgba(255,255,255,0.12)" />
        <rect x="20" y="184" width="120" height="14" rx="4" fill="rgba(255,255,255,0.10)" />
        <rect x="20" y="204" width="80" height="14" rx="4" fill="rgba(255,255,255,0.08)" />
        <circle cx="80" cy="248" r="4" fill="rgba(255,255,255,0.4)" />
      </svg>
    </div>
  );
}
