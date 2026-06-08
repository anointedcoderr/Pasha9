// Built by Anointed Coder.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Gift, Sparkles } from 'lucide-react';
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
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = banners.length;
  const safeIndex = count ? ((index % count) + count) % count : 0;
  const active = banners[safeIndex];
  const next = useCallback(() => setIndex((current) => current + 1), []);
  const previous = useCallback(() => setIndex((current) => current - 1), []);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = window.setInterval(next, 5000);
    return () => window.clearInterval(timer);
  }, [count, next, paused]);

  if (!active) return null;
  const title = bn && active.titleBn ? active.titleBn : active.titleEn;
  const subtitle = bn && active.subtitleBn ? active.subtitleBn : active.subtitleEn;

  const content = (
    <div
      className="relative min-h-[190px] overflow-hidden rounded-2xl border border-brand-divider bg-gradient-to-br from-[#3b1708] via-[#6a3213] to-[#1e1009] text-white shadow-[0_12px_30px_-16px_rgba(100,48,18,0.7)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStartX.current == null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (distance > 40) previous();
        if (distance < -40) next();
      }}
    >
      {active.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={active.imageUrl}
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            // Full opacity when the banner is image-only so the
            // operator's promotional design is uncompromised. Dim and
            // scrim when text exists so the copy stays legible.
            (title?.trim() || subtitle?.trim()) ? 'opacity-65' : 'opacity-100',
          )}
        />
      ) : null}
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
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {banners.map((banner, bannerIndex) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`Slide ${bannerIndex + 1}`}
                onClick={() => setIndex(bannerIndex)}
                className={cn('h-1.5 rounded-full transition-all', bannerIndex === safeIndex ? 'w-6 bg-brand-yellow-400' : 'w-1.5 bg-white/40')}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );

  return active.ctaUrl ? <Link href={active.ctaUrl} className="block">{content}</Link> : content;
}
