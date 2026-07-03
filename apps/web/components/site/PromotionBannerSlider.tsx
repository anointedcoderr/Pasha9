// Built by Anointed Coder.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Gift, Sparkles, Pause, Play } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export interface PromotionBannerRow {
  id: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  imageUrl: string | null;
  ctaUrl: string | null;
}
export function PromotionBannerSlider({ banners }: { banners: PromotionBannerRow[] }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [index, setIndex] = useState(0);
  // `paused` is the player's explicit pause/play choice. `hovered` is a
  // transient pause on hover or keyboard focus. `reducedMotion` mirrors
  // the OS prefers-reduced-motion setting and hard-stops auto-rotation.
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = banners.length;
  const safeIndex = count ? ((index % count) + count) % count : 0;
  const active = banners[safeIndex];
  const next = useCallback(() => setIndex((current) => current + 1), []);
  const previous = useCallback(() => setIndex((current) => current - 1), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (count <= 1 || paused || hovered || reducedMotion) return;
    const timer = window.setInterval(next, 5000);
    return () => window.clearInterval(timer);
  }, [count, next, paused, hovered, reducedMotion]);

  if (!active) return null;
  const title = bn && active.titleBn ? active.titleBn : active.titleEn;
  const subtitle = bn && active.subtitleBn ? active.subtitleBn : active.subtitleEn;

  const content = (
    <div
      className="relative min-h-[190px] overflow-hidden rounded-2xl border border-brand-divider bg-gradient-to-br from-[#3b1708] via-[#6a3213] to-[#1e1009] text-white shadow-[0_12px_30px_-16px_rgba(100,48,18,0.7)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
      }}
      onTouchStart={(event) => {
        // Touch pause: auto-rotation stops while a finger rests on the
        // banner, reusing the same transient pause state hover uses.
        setHovered(true);
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        // Resume rotation only once the last finger lifts.
        if (event.touches.length === 0) setHovered(false);
        if (touchStartX.current == null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (distance > 40) previous();
        if (distance < -40) next();
      }}
      onTouchCancel={() => {
        touchStartX.current = null;
        setHovered(false);
      }}
    >
      {active.imageUrl ? (() => {
        // When text is present the image is decorative chrome (the
        // headline/subtitle carry the meaning) so we mark it
        // aria-hidden with alt="". When the banner is image-only
        // the image IS the content - we promote alt text so screen
        // reader users still get a hint about what the promotion
        // is. The fallback "Promotion banner" label is intentional:
        // operator-uploaded images do not carry an inherent
        // description.
        const hasText = Boolean(title?.trim() || subtitle?.trim());
        const altText = hasText ? '' : (bn ? 'প্রমোশনাল ব্যানার' : 'Promotion banner');
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.imageUrl}
            alt={altText}
            aria-hidden={hasText ? true : undefined}
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              hasText ? 'opacity-65' : 'opacity-100',
            )}
          />
        );
      })() : null}
      {(title?.trim() || subtitle?.trim()) ? (
        <>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
          <div className="relative flex min-h-[190px] max-w-xl flex-col justify-center gap-2 px-5 py-6 md:px-8">
            <p className="inline-flex w-max items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-yellow-300">
              <Sparkles className="h-3 w-3" />
              {bn ? 'প্রমোশন এবং রিওয়ার্ড' : 'Promotions and Rewards'}
            </p>
            {title?.trim() ? <h2 className="text-2xl font-extrabold leading-tight text-white">{title}</h2> : null}
            {subtitle?.trim() ? <p className="text-sm text-white/85">{subtitle}</p> : null}
          </div>
          <Gift className="absolute right-8 top-1/2 h-16 w-16 -translate-y-1/2 text-brand-yellow-300/80" />
        </>
      ) : (
        // Image-only mode: reserve a respectable aspect ratio so the
        // banner is large enough on mobile without scrim or text.
        <div className="relative aspect-[16/7] w-full md:aspect-[16/6]" />
      )}

      {count > 1 ? (
        <>
          <button type="button" aria-label="Previous" onClick={previous} className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 md:flex">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next" onClick={next} className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 md:flex">
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* Slide indicator dots stay visible; the rotation pause /
              play toggle is visually hidden so operator banner artwork
              shows with no floating control on top of it, on mobile
              and desktop. The toggle stays in the tab order (same
              sr-only plus focus:not-sr-only pattern as the skip link)
              and pops in above the dots while keyboard focused, so
              auto-rotating content keeps a working pause affordance.
              Touch users get an implicit pause via the touch handlers
              on the banner. The toggle is omitted when reduced motion
              has already stopped auto-rotation. */}
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
            {banners.map((banner, bannerIndex) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`Slide ${bannerIndex + 1}`}
                onClick={() => setIndex(bannerIndex)}
                className={cn('h-1.5 rounded-full transition-all', bannerIndex === safeIndex ? 'w-6 bg-brand-yellow-400' : 'w-1.5 bg-white/40')}
              />
            ))}
            {!reducedMotion ? (
              <button
                type="button"
                aria-pressed={paused}
                aria-label={
                  paused
                    ? (bn ? 'স্বয়ংক্রিয় স্লাইড চালু করুন' : 'Play automatic slideshow')
                    : (bn ? 'স্বয়ংক্রিয় স্লাইড থামান' : 'Pause automatic slideshow')
                }
                onClick={(event) => {
                  // The whole banner may be wrapped in a link; keep this
                  // control from navigating.
                  event.preventDefault();
                  event.stopPropagation();
                  setPaused((current) => !current);
                }}
                className="sr-only focus:not-sr-only focus:absolute focus:bottom-full focus:left-1/2 focus:z-30 focus:mb-2 focus:inline-flex focus:h-6 focus:w-6 focus:-translate-x-1/2 focus:items-center focus:justify-center focus:rounded-full focus:bg-black/45 focus:text-white focus:backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-400/60"
              >
                {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );

  return active.ctaUrl ? <Link href={active.ctaUrl} className="block">{content}</Link> : content;
}
