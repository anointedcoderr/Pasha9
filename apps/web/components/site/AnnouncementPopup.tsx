// Built by Anointed Coder.
// First-visit announcement popup. Reads the latest active popup from
// /api/content/popups and dismisses via the pasha9_popup_seen cookie.
// Supports carousel of multiple slides if the API returns more than one item.

'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { useT } from '@/lib/i18n/context';

const COOKIE_KEY = 'pasha9_popup_seen';
const COOKIE_DAYS = 1;

interface PopupSlide {
  id: string;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
}

function hasSeenCookie() {
  if (typeof document === 'undefined') return true;
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE_KEY}=`));
}

function setSeenCookie() {
  if (typeof document === 'undefined') return;
  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_KEY}=1; max-age=${maxAge}; path=/; samesite=lax`;
}

export function AnnouncementPopup() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<PopupSlide[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (hasSeenCookie()) return;
    fetch('/api/content/popups')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const popups: PopupSlide[] = Array.isArray(data?.popup) ? data.popup : data?.popup ? [data.popup] : [];
        if (popups.length > 0) {
          setSlides(popups);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const close = () => {
    setSeenCookie();
    setOpen(false);
  };

  if (!open || slides.length === 0) return null;
  const slide = slides[idx] ?? slides[0];

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-brand-paper shadow-2xl">
          <div className="relative">
            <div className="flex items-center justify-between border-b border-brand-divider px-5 py-3">
              <Dialog.Title className="text-sm font-semibold text-brand-ink">
                {t('home.announcementHeader')}
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-brand-inkMute hover:bg-brand-surface"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="relative">
              <div className="relative aspect-[5/4] w-full overflow-hidden bg-gradient-to-br from-brand-yellow-300 via-brand-yellow-500 to-brand-blue-500">
                <PopupArt variant={(idx % 3) as 0 | 1 | 2} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent p-5">
                  <h3 className="text-lg font-extrabold leading-tight text-white drop-shadow">
                    {slide.title}
                  </h3>
                </div>
              </div>

              {slides.length > 1 ? (
                <>
                  <button
                    aria-label="Previous"
                    onClick={() => setIdx((p) => (p - 1 + slides.length) % slides.length)}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-ink shadow"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Next"
                    onClick={() => setIdx((p) => (p + 1) % slides.length)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-ink shadow"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-brand-inkSoft">{slide.body}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button onClick={close} className="btn-outline-ink inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm">
                  {t('common.cancel')}
                </button>
                {slide.ctaLabel && slide.ctaHref ? (
                  <Link
                    href={slide.ctaHref}
                    onClick={close}
                    className="btn-yellow inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm"
                  >
                    {slide.ctaLabel}
                  </Link>
                ) : null}
              </div>
            </div>

            {slides.length > 1 ? (
              <div className="flex items-center justify-center gap-1.5 pb-4">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setIdx(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      idx === i ? 'w-6 bg-brand-yellow-500' : 'w-2 bg-brand-divider',
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PopupArt({ variant }: { variant: 0 | 1 | 2 }) {
  if (variant === 0) {
    return (
      <svg viewBox="0 0 400 320" className="absolute inset-0 h-full w-full" fill="none">
        <circle cx="320" cy="60" r="14" fill="#FFF" opacity="0.6" />
        <circle cx="80" cy="60" r="8" fill="#FFF" opacity="0.4" />
        <g transform="translate(110 90)">
          <rect x="0" y="50" width="180" height="120" rx="14" fill="rgba(255,255,255,0.18)" stroke="#FFFFFF" strokeOpacity="0.5" />
          <text x="90" y="120" textAnchor="middle" fill="#FFF" fontSize="36" fontWeight="800">9</text>
        </g>
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg viewBox="0 0 400 320" className="absolute inset-0 h-full w-full" fill="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} cx={60 + i * 60} cy={140 + Math.sin(i) * 24} r={12 + (i % 3) * 4} fill="rgba(255,255,255,0.35)" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 320" className="absolute inset-0 h-full w-full" fill="none">
      <path d="M30 200 Q 200 60 370 200" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="3" fill="none" />
      <circle cx="200" cy="180" r="34" fill="#FFFFFF" />
      <path d="M186 162 L222 180 L186 198 Z" fill="#0F1115" />
    </svg>
  );
}
