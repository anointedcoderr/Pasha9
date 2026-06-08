// Built by Anointed Coder.
//
// Public Betting Pass hero carousel. Custom lightweight slider, no
// extra dependency. Supports:
//   - touch swipe on mobile
//   - auto-rotate every 5s when more than one banner is active
//   - dot navigation when more than one banner is active
//   - pause on hover (desktop)
// When the banners prop is empty the caller renders its built-in
// hero fallback so the page never looks broken.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export interface BannerRow {
  id: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  imageUrl: string | null;
  ctaUrl: string | null;
}

const AUTO_ROTATE_MS = 5000;

export function BettingPassBannerSlider({ banners }: { banners: BannerRow[] }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const count = banners.length;
  const safeIndex = count === 0 ? 0 : ((index % count) + count) % count;
  const active = banners[safeIndex];

  const next = useCallback(() => setIndex((i) => i + 1), []);
  const prev = useCallback(() => setIndex((i) => i - 1), []);

  // Auto-rotate. Pauses while hovered (desktop) or while the page
  // tab is in the background (browsers throttle anyway).
  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = window.setInterval(() => setIndex((i) => i + 1), AUTO_ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count, paused]);

  // Touch swipe for mobile.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (dx > 40) prev();
    else if (dx < -40) next();
  };

  if (count === 0 || !active) return null;

  const title = bn && active.titleBn ? active.titleBn : active.titleEn;
  const subtitle = bn && active.subtitleBn ? active.subtitleBn : active.subtitleEn;

  const inner = (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-brand-divider bg-gradient-to-br from-indigo-700 via-indigo-800 to-brand-ink text-white shadow-[0_10px_28px_-14px_rgba(67,56,202,0.55)]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {active.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={active.imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      {(title?.trim() || subtitle?.trim()) ? (
        <div className="relative flex h-full min-h-[180px] flex-col justify-center gap-2 px-5 py-6 md:px-8">
          <p className="inline-flex w-max items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300 shadow-sm">
            <Sparkles className="h-3 w-3" />
            {bn ? 'পাশা ৯ বেটিং পাস' : 'Pasha 9 Betting Pass'}
          </p>
          {title?.trim() ? <h2 className="text-xl font-extrabold leading-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.85)] md:text-2xl">{title}</h2> : null}
          {subtitle?.trim() ? <p className="max-w-md text-sm text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">{subtitle}</p> : null}
        </div>
      ) : (
        // Image-only mode: reserve a respectable height so the banner
        // renders cleanly without the text column.
        <div className="relative aspect-[16/7] w-full md:aspect-[16/6]" />
      )}

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label={bn ? 'আগের' : 'Previous'}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 md:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label={bn ? 'পরবর্তী' : 'Next'}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 md:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={bn ? `স্লাইড ${i + 1}` : `Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === safeIndex ? 'w-6 bg-brand-yellow-400' : 'w-1.5 bg-white/40 hover:bg-white/60',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );

  if (active.ctaUrl) {
    return (
      <Link href={active.ctaUrl} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
