// Built by Anointed Coder.
//
// Homepage ambassador video carousel. Auto-rotates every 7 seconds,
// supports touch swipe on mobile, pauses while the operator hovers
// (desktop) or while the embedded video is playing. YouTube rows
// render as a clickable thumbnail that swaps into an inline iframe on
// tap; direct uploads render with a native <video> element with
// preload='metadata' so the browser only fetches the poster. The
// parent decides whether to render this at all (empty deck means the
// caller falls back to its previous content).

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { youtubeEmbedUrl, youtubeThumbnailUrl } from '@/lib/homepage/youtube';

export interface VideoRow {
  id: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  sourceType: 'youtube' | 'upload';
  youtubeVideoId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  ctaUrl: string | null;
}

const AUTO_ROTATE_MS = 7000;

export function HomepageVideoCarousel({ videos }: { videos: VideoRow[] }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playingYouTube, setPlayingYouTube] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const count = videos.length;
  const safeIndex = count === 0 ? 0 : ((index % count) + count) % count;
  const active = videos[safeIndex];

  useEffect(() => {
    if (count <= 1 || paused || playingYouTube) return;
    const t = window.setInterval(() => setIndex((i) => i + 1), AUTO_ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count, paused, playingYouTube]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (dx > 40) setIndex((i) => i - 1);
    else if (dx < -40) setIndex((i) => i + 1);
  };

  if (count === 0 || !active) return null;

  const title = bn && active.titleBn ? active.titleBn : active.titleEn;
  const subtitle = bn && active.subtitleBn ? active.subtitleBn : active.subtitleEn;
  const isYouTube = active.sourceType === 'youtube' && !!active.youtubeVideoId;
  const isUpload = active.sourceType === 'upload' && !!active.videoUrl;
  const thumbnail = active.thumbnailUrl ?? (isYouTube && active.youtubeVideoId ? youtubeThumbnailUrl(active.youtubeVideoId, 'hq') : null);
  const playerActive = playingYouTube === active.id;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
        <div className="relative aspect-video bg-black md:aspect-auto md:min-h-[280px]">
          {isYouTube && playerActive ? (
            <iframe
              src={`${youtubeEmbedUrl(active.youtubeVideoId!)}&autoplay=1`}
              title={title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : isUpload ? (
            <video
              key={active.id}
              src={active.videoUrl ?? ''}
              poster={thumbnail ?? undefined}
              controls
              preload="metadata"
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              onPlay={() => setPaused(true)}
              onPause={() => setPaused(false)}
            />
          ) : (
            <>
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnail}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-indigo-800 to-brand-ink" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              {isYouTube ? (
                <button
                  type="button"
                  aria-label={bn ? 'প্লে' : 'Play'}
                  onClick={() => setPlayingYouTube(active.id)}
                  className="absolute inset-0 flex items-center justify-center text-white transition hover:text-brand-yellow-300"
                >
                  <PlayCircle className="h-16 w-16 drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]" />
                </button>
              ) : null}
            </>
          )}
        </div>
        <div className="relative flex flex-col justify-center gap-2 bg-gradient-to-br from-brand-ink via-brand-ink to-indigo-900 px-5 py-6 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300">
            {bn ? 'অ্যাম্বাসেডর' : 'Ambassador'}
          </p>
          <h2 className="text-xl font-extrabold leading-tight md:text-2xl">{title}</h2>
          {subtitle ? <p className="text-sm text-white/85">{subtitle}</p> : null}
          {active.ctaUrl ? (
            <Link
              href={active.ctaUrl}
              className="mt-3 inline-flex w-max items-center gap-1 rounded-lg bg-brand-yellow-500 px-3 py-1.5 text-xs font-bold text-brand-ink shadow transition hover:bg-brand-yellow-400"
            >
              {bn ? 'বিস্তারিত' : 'Learn more'}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label={bn ? 'আগের' : 'Previous'}
            onClick={() => {
              setPlayingYouTube(null);
              setIndex((i) => i - 1);
            }}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 md:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={bn ? 'পরবর্তী' : 'Next'}
            onClick={() => {
              setPlayingYouTube(null);
              setIndex((i) => i + 1);
            }}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 md:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {videos.map((v, i) => (
              <button
                key={v.id}
                type="button"
                aria-label={bn ? `স্লাইড ${i + 1}` : `Slide ${i + 1}`}
                onClick={() => {
                  setPlayingYouTube(null);
                  setIndex(i);
                }}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === safeIndex ? 'w-6 bg-brand-yellow-400' : 'w-1.5 bg-white/40 hover:bg-white/60',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
