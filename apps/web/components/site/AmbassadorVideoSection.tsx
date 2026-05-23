// Built by Anointed Coder.
// Brand ambassador + promo video section. Placeholders use original Pasha 9
// custom SVG art so no copyrighted material is referenced. The admin can
// replace these with real assets in Phase 5 via the ambassador admin page.

'use client';

import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

interface AmbassadorData {
  name: string;
  caption: string;
  imageUrl?: string | null;
}

interface VideoData {
  title: string;
  caption: string;
  posterUrl?: string | null;
  videoUrl?: string | null;
}

export function AmbassadorVideoSection() {
  const t = useT();
  const [ambassador, setAmbassador] = useState<AmbassadorData | null>(null);
  const [video, setVideo] = useState<VideoData | null>(null);

  useEffect(() => {
    let alive = true;
    // Admin-editable assets land via SystemSetting in Phase 5. For now we
    // request them and fall back to brand defaults if not present.
    fetch('/api/content/homepage')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.sections) return;
        const find = (key: string) => (data.sections as Array<{ section: string; titleEn?: string; bodyEn?: string; imageUrl?: string }>).find((s) => s.section === key);
        const a = find('ambassador');
        const v = find('promo_video');
        if (a) setAmbassador({ name: a.titleEn ?? 'Pasha 9 Ambassador', caption: a.bodyEn ?? t('home.ambassador.caption'), imageUrl: a.imageUrl });
        if (v) setVideo({ title: v.titleEn ?? t('home.video.title'), caption: v.bodyEn ?? t('home.video.caption'), posterUrl: v.imageUrl });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [t]);

  const a = ambassador ?? {
    name: t('home.ambassador.fallbackName'),
    caption: t('home.ambassador.caption'),
    imageUrl: null,
  };
  const v = video ?? {
    title: t('home.video.title'),
    caption: t('home.video.caption'),
    posterUrl: null,
    videoUrl: null,
  };

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <AmbassadorCard {...a} />
      <VideoCard {...v} />
    </section>
  );
}

function AmbassadorCard({ name, caption, imageUrl }: AmbassadorData) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-yellow-500/30 via-transparent to-brand-blue-500/30" />
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-6 md:px-7 md:py-8">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-400">
            Brand Ambassador
          </p>
          <h3 className="mt-2 text-xl font-extrabold leading-tight md:text-2xl">{name}</h3>
          <p className="mt-2 max-w-md text-sm text-white/75">{caption}</p>
        </div>
        <div className="relative h-32 w-24 shrink-0 md:h-40 md:w-32">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="absolute inset-0 h-full w-full rounded-xl object-cover" />
          ) : (
            <PortraitArt />
          )}
        </div>
      </div>
    </article>
  );
}

function VideoCard({ title, caption, posterUrl }: VideoData) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink text-white">
      <div className="absolute inset-0">
        {posterUrl ? (
          <img src={posterUrl} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <VideoBgArt />
        )}
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-ink via-brand-ink/55 to-transparent" />
      </div>
      <div className="relative flex h-full flex-col justify-between gap-4 px-5 py-6 md:px-7 md:py-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-400">
            Promo Video
          </p>
          <h3 className="mt-2 text-xl font-extrabold leading-tight md:text-2xl">{title}</h3>
          <p className="mt-2 max-w-md text-sm text-white/75">{caption}</p>
        </div>
        <button
          type="button"
          aria-label="Play promo video"
          className="inline-flex h-12 w-12 items-center justify-center self-start rounded-full bg-brand-yellow-500 text-brand-ink shadow-lg transition group-hover:scale-105"
        >
          <Play className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

function PortraitArt() {
  return (
    <svg viewBox="0 0 160 200" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="pasha9-portrait" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFCC00" />
          <stop offset="100%" stopColor="#F5B400" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="148" height="188" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" />
      <circle cx="80" cy="78" r="32" fill="url(#pasha9-portrait)" />
      <path d="M30 200 C 30 150, 130 150, 130 200 Z" fill="url(#pasha9-portrait)" opacity="0.85" />
    </svg>
  );
}

function VideoBgArt() {
  return (
    <svg viewBox="0 0 400 220" className="h-full w-full">
      <defs>
        <linearGradient id="vbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1659C2" />
          <stop offset="100%" stopColor="#FFCC00" />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill="url(#vbg)" opacity="0.5" />
      <g opacity="0.55" stroke="#fff" strokeWidth="1.5" fill="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <path key={i} d={`M0 ${30 + i * 24} Q 200 ${i * 16} 400 ${30 + i * 24}`} />
        ))}
      </g>
    </svg>
  );
}
