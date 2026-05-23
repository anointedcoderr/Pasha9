// Built by Anointed Coder.
//
// Hero slider for the homepage. Supports image AND video banners as set
// from /admin/banners. Video slides autoplay muted (browser policy
// compliant), loop, show a poster while loading and expose a mute /
// unmute button. Image slides render as a full-bleed picture. Multi-
// slide auto-rotation is preserved; when a slide is a video the rotation
// pauses until the video finishes or 12s elapses (whichever comes first)
// so the user can actually watch it.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useT, useLang } from '@/lib/i18n/context';
import { ChevronLeft, ChevronRight, Sparkles, Gift, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

type Accent = 'gold' | 'neon' | 'mixed' | 'royal' | 'red';
type MediaType = 'image' | 'video';

interface Slide {
  title: string;
  subtitle: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  art: 'royal' | 'live' | 'referral';
  mediaType?: MediaType;
  imageUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  accent?: Accent;
}

interface LiveBanner {
  id: string;
  title: string;
  titleEn?: string | null;
  subtitle?: string | null;
  subtitleEn?: string | null;
  ctaLabel?: string | null;
  link?: string | null;
  accent: Accent;
  mediaType?: MediaType | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
}

const IMAGE_ROTATE_MS = 6500;
const VIDEO_MAX_DWELL_MS = 12_000;

function fallbackSlides(t: (k: string) => string): Slide[] {
  return [
    { title: t('home.heroTitle1'), subtitle: t('home.heroSub1'), primary: { label: t('home.heroCtaPrimary'), href: '/' }, secondary: { label: t('home.heroCtaSecondary'), href: '/promotions' }, art: 'royal' },
    { title: t('home.heroTitle2'), subtitle: t('home.heroSub2'), primary: { label: t('home.heroCtaPrimary'), href: '/live-casino' }, art: 'live' },
    { title: t('home.heroTitle3'), subtitle: t('home.heroSub3'), primary: { label: t('common.signup'), href: '/referral' }, art: 'referral' },
  ];
}

function artForAccent(accent: Accent): Slide['art'] {
  if (accent === 'neon') return 'live';
  if (accent === 'royal' || accent === 'mixed') return 'referral';
  return 'royal';
}

export function HeroSlider() {
  const t = useT();
  const { lang } = useLang();
  const [live, setLive] = useState<LiveBanner[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/banners')
      .then((r) => r.json())
      .then((data) => {
        if (alive) setLive((data.banners ?? []) as LiveBanner[]);
      })
      .catch(() => { if (alive) setLive([]); });
    return () => { alive = false; };
  }, []);

  const slides: Slide[] = useMemo(() => {
    if (!live || live.length === 0) return fallbackSlides(t);
    return live.map<Slide>((b) => ({
      title: (lang === 'en' && b.titleEn) ? b.titleEn : b.title,
      subtitle: ((lang === 'en' && b.subtitleEn) ? b.subtitleEn : b.subtitle) ?? '',
      primary: { label: b.ctaLabel ?? t('home.heroCtaPrimary'), href: b.link ?? '/' },
      art: artForAccent(b.accent),
      mediaType: (b.mediaType ?? 'image') as MediaType,
      imageUrl: b.imageUrl,
      videoUrl: b.videoUrl,
      posterUrl: b.posterUrl,
      accent: b.accent,
    }));
  }, [live, lang, t]);

  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => { setI(0); }, [slides.length]);

  // Auto-rotate. Use the longer dwell when the active slide is a video so
  // the visitor can actually watch some of it before we move on.
  useEffect(() => {
    if (slides.length <= 1) return;
    const active = slides[i];
    const dwell = active?.mediaType === 'video' && active.videoUrl ? VIDEO_MAX_DWELL_MS : IMAGE_ROTATE_MS;
    const id = setTimeout(() => setI((p) => (p + 1) % slides.length), dwell);
    return () => clearTimeout(id);
  }, [slides, i]);

  // Keep <video> in sync with the mute toggle.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, i]);

  const slide = slides[i] ?? slides[0];
  const hasVideo = slide.mediaType === 'video' && !!slide.videoUrl;
  const hasImage = slide.mediaType === 'image' && !!slide.imageUrl;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink text-white shadow-sm">
      {/* Media layer */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            {hasVideo ? (
              <video
                ref={videoRef}
                src={slide.videoUrl ?? undefined}
                poster={slide.posterUrl ?? undefined}
                autoPlay
                muted={muted}
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  // Fall back to poster if the browser cannot decode the source.
                  (e.currentTarget as HTMLVideoElement).style.display = 'none';
                }}
              />
            ) : hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.imageUrl ?? ''}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : null}
            {/* dim overlay so text on image / video stays readable */}
            {(hasVideo || hasImage) ? (
              <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Decorative glow when there is no media */}
        {!hasVideo && !hasImage ? (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,204,0,0.20),transparent_60%)] blur-2xl" />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-brand-blue-500/15 via-brand-blue-500/5 to-transparent" />
          </div>
        ) : null}
      </div>

      <div className="relative grid min-h-[260px] grid-cols-1 items-center gap-6 px-5 py-8 md:min-h-[360px] md:grid-cols-2 md:px-10 md:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-yellow-500/20 px-3 py-1 text-xs font-semibold text-brand-yellow-400">
              <Sparkles className="h-3.5 w-3.5" /> {t('home.tickerLabel')}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold leading-tight md:text-4xl">
              {slide.title}
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/80 md:text-base">{slide.subtitle}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href={slide.primary.href}>
                <Button size="lg" variant="yellow" leftIcon={<Sparkles className="h-4 w-4" />}>{slide.primary.label}</Button>
              </Link>
              {slide.secondary ? (
                <Link href={slide.secondary.href}>
                  <Button size="lg" variant="blue" leftIcon={<Gift className="h-4 w-4" />}>{slide.secondary.label}</Button>
                </Link>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {!hasVideo && !hasImage ? (
          <div className="relative hidden h-full min-h-[260px] md:block">
            <HeroArt variant={slide.art} />
          </div>
        ) : null}
      </div>

      {/* Mute / unmute, only visible on video slides */}
      {hasVideo ? (
        <button
          type="button"
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          aria-pressed={!muted}
          onClick={() => setMuted((m) => !m)}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-500/60"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      ) : null}

      <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Slide ${idx + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all',
              idx === i ? 'w-8 bg-brand-yellow-500' : 'w-4 bg-white/30',
            )}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => setI((p) => (p - 1 + slides.length) % slides.length)}
        className="absolute left-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30 md:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => setI((p) => (p + 1) % slides.length)}
        className="absolute right-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30 md:inline-flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function HeroArt({ variant }: { variant: 'royal' | 'live' | 'referral' }) {
  if (variant === 'royal') {
    return (
      <svg viewBox="0 0 420 360" className="h-full w-full">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f5d061" />
            <stop offset="100%" stopColor="#7a5810" />
          </linearGradient>
          <radialGradient id="g2" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#36ff9a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#36ff9a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="210" cy="180" rx="190" ry="120" fill="url(#g2)" />
        <g transform="translate(210 180)">
          <path d="M-80 -60 L80 -60 L96 -10 L60 60 L-60 60 L-96 -10 Z" fill="rgba(245,208,97,0.08)" stroke="url(#g1)" strokeWidth="2" />
          <circle r="44" fill="url(#g1)" />
          <path d="M-22 0 L0 -28 L22 0 L0 28 Z" fill="#06120c" />
          <g stroke="#f5d061" strokeWidth="2">
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const x1 = Math.cos(a) * 64;
              const y1 = Math.sin(a) * 64;
              const x2 = Math.cos(a) * 78;
              const y2 = Math.sin(a) * 78;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>
        </g>
      </svg>
    );
  }
  if (variant === 'live') {
    return (
      <svg viewBox="0 0 420 360" className="h-full w-full">
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#36ff9a" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#36ff9a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="40" y="60" width="340" height="220" rx="22" fill="rgba(54,255,154,0.05)" stroke="#36ff9a" strokeOpacity="0.35" />
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} cx={80 + i * 50} cy={170} r={i === 2 ? 28 : 18} fill={i === 2 ? '#f5d061' : 'rgba(245,208,97,0.4)'} />
        ))}
        <rect x="60" y="290" width="300" height="6" rx="3" fill="url(#lg1)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 420 360" className="h-full w-full">
      <defs>
        <linearGradient id="rg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5d061" />
          <stop offset="100%" stopColor="#36ff9a" />
        </linearGradient>
      </defs>
      <g stroke="url(#rg1)" strokeWidth="2" fill="none">
        <circle cx="210" cy="180" r="40" />
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const rad = (a * Math.PI) / 180;
          const x = 210 + Math.cos(rad) * 110;
          const y = 180 + Math.sin(rad) * 110;
          return (
            <g key={a}>
              <line x1={210 + Math.cos(rad) * 45} y1={180 + Math.sin(rad) * 45} x2={x - Math.cos(rad) * 25} y2={y - Math.sin(rad) * 25} />
              <circle cx={x} cy={y} r="22" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
