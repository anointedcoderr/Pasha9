'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/lib/i18n/context';
import { ChevronLeft, ChevronRight, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface Slide {
  titleKey: string;
  subKey: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  art: 'royal' | 'live' | 'referral';
}

const SLIDES: Slide[] = [
  { titleKey: 'home.heroTitle1', subKey: 'home.heroSub1', primary: { label: 'home.heroCtaPrimary', href: '/' }, secondary: { label: 'home.heroCtaSecondary', href: '/promotions' }, art: 'royal' },
  { titleKey: 'home.heroTitle2', subKey: 'home.heroSub2', primary: { label: 'home.heroCtaPrimary', href: '/live-casino' }, art: 'live' },
  { titleKey: 'home.heroTitle3', subKey: 'home.heroSub3', primary: { label: 'common.signup', href: '/referral' }, art: 'referral' },
];

export function HeroSlider() {
  const t = useT();
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 6500);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[i];
  const coins = useMemo(() => Array.from({ length: 14 }).map(() => ({
    x: Math.random() * 100,
    y: 30 + Math.random() * 60,
    delay: Math.random() * 4,
    size: 8 + Math.random() * 14,
  })), []);

  return (
    <section className="relative overflow-hidden rounded-card border border-neon/10 bg-base-panel/50 shadow-glow">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[110%] -translate-x-1/2 rounded-full bg-grad-radial-glow blur-2xl" />
        <div className="absolute inset-0 opacity-60 mix-blend-screen">
          {coins.map((c, idx) => (
            <span
              key={idx}
              className="glow-coin animate-floaty"
              style={{
                left: `${c.x}%`,
                bottom: `${c.y}%`,
                width: c.size,
                height: c.size,
                animationDelay: `${c.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-gold-700/10 via-gold-500/5 to-transparent" />
      </div>

      <div className="relative grid min-h-[360px] grid-cols-1 items-center gap-6 px-6 py-10 md:min-h-[420px] md:grid-cols-2 md:px-12 md:py-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs text-gold-300">
              <Sparkles className="h-3.5 w-3.5" /> {t('home.tickerLabel')}
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight text-ink-hi md:text-5xl">
              <span className="text-gradient-gold">{t(slide.titleKey)}</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-mid md:text-lg">{t(slide.subKey)}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={slide.primary.href}>
                <Button size="lg" leftIcon={<Sparkles className="h-4 w-4" />}>{t(slide.primary.label)}</Button>
              </Link>
              {slide.secondary ? (
                <Link href={slide.secondary.href}>
                  <Button size="lg" variant="neon" leftIcon={<Gift className="h-4 w-4" />}>{t(slide.secondary.label)}</Button>
                </Link>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="relative hidden h-full min-h-[280px] md:block">
          <HeroArt variant={slide.art} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Slide ${idx + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all',
              idx === i ? 'w-8 bg-grad-gold' : 'w-4 bg-white/15',
            )}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => setI((p) => (p - 1 + SLIDES.length) % SLIDES.length)}
        className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neon/20 bg-base-deep/60 text-ink-mid hover:text-ink-hi md:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => setI((p) => (p + 1) % SLIDES.length)}
        className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neon/20 bg-base-deep/60 text-ink-mid hover:text-ink-hi md:inline-flex"
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
