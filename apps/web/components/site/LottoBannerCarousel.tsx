// Built by Anointed Coder.
//
// Carousel of admin-managed Lotto banners. Each banner is either an
// image or an MP4 video. Multiple active banners rotate every N
// seconds; video banners pause the rotation while playing.
//
// Player controls:
//   - tap left/right edge or dots to switch slides
//   - per-slide play/pause and mute/unmute for video
//   - autoplay + muted defaults follow what the admin saved on the row
//     (most mobile browsers require muted autoplay)
//
// When no banners are active the component returns null - the /lotto
// page just shows the regular layout with no slot taken up.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

interface BannerRow {
  id: string;
  kind: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  titleEn: string | null;
  titleBn: string | null;
  ctaUrl: string | null;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  sortOrder: number;
}

const ROTATE_MS = 6000;

export function LottoBannerCarousel() {
  const { lang } = useLang();
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/lotto/banners', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        const arr = Array.isArray(data?.banners) ? (data.banners as BannerRow[]) : [];
        setBanners(arr);
        if (arr[0]) {
          setMuted(arr[0].muted);
          setPlaying(arr[0].autoplay);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Auto-rotate between slides. Video slides skip the timer (the video
  // duration drives progression naturally; if loop is true the slide
  // stays until the operator taps the next arrow).
  useEffect(() => {
    if (banners.length <= 1) return;
    const current = banners[active];
    if (current?.kind === 'video') return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % banners.length), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [active, banners]);

  // Sync video element state with the per-slide controls.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (playing) v.play().catch(() => undefined);
    else v.pause();
  }, [muted, playing, active]);

  const advance = useCallback((dir: 1 | -1) => {
    setActive((i) => (i + dir + banners.length) % banners.length);
    setPlaying(true);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const current = banners[active];
  const title = lang === 'bn' && current.titleBn ? current.titleBn : current.titleEn;

  const slideInner = (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-brand-ink/5 sm:aspect-[5/2]">
      {current.kind === 'image' ? (
        current.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt={title ?? 'Lotto banner'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null
      ) : current.videoUrl ? (
        <video
          ref={videoRef}
          src={current.videoUrl}
          poster={current.posterUrl ?? undefined}
          autoPlay={current.autoplay}
          muted={muted}
          loop={current.loop}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      ) : null}

      {title ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/80 via-brand-ink/30 to-transparent px-3 py-3 text-white">
          <p className="text-sm font-bold sm:text-base">{title}</p>
        </div>
      ) : null}

      {current.kind === 'video' ? (
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setPlaying((p) => !p); }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setMuted((m) => !m); }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      ) : null}

      {banners.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); advance(-1); }}
            className="absolute left-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/65 sm:inline-flex"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); advance(1); }}
            className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/65 sm:inline-flex"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={(e) => { e.preventDefault(); setActive(i); }}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/55',
                )}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );

  return current.ctaUrl ? (
    <Link href={current.ctaUrl} className="block">
      {slideInner}
    </Link>
  ) : (
    slideInner
  );
}
