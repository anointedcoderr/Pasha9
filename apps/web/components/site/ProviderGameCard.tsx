// Built by Anointed Coder.
//
// Shared provider game thumbnail card: the single source of truth for how
// an external provider game tile looks. Used by both the homepage rail
// (ProviderGamesSection) and the full lobby (/games/provider).
//
// This component exists on purpose. The provider thumbnail markup used to
// be copy-pasted in several places, so every visual fix had to be redone
// in each copy and one copy was always missed. That is why the
// crop / too-dark / black-bar reports kept coming back. One component now
// fixes all provider listings at once.
//
// Rendering rules (locked to the operator's stated requirements):
//   - object-contain, so the WHOLE game image is always visible and is
//     never cropped, whatever aspect ratio the provider ships.
//   - any empty space around a non-square image uses the theme surface
//     colour, never black, so there are no black bars.
//   - no dark overlay sits on the artwork (that was the "too dark"
//     report) and there is no per-card blur / backdrop-blur / heavy
//     shadow, so the long lobby list stays within a low-end phone GPU
//     budget (Moto G24 / UNISOC T606 glitch).
//   - the game name and Play pill sit on a solid strip BELOW the image,
//     so the caption never covers the artwork.

'use client';

import { Play } from 'lucide-react';
import { CategoryHeroArt, type CategoryCode } from './CategoryHeroArt';

const CATEGORY_TO_ART: Record<string, CategoryCode> = {
  slots: 'slots',
  flash: 'liveCasino',
  table: 'tableGames',
  fishing: 'fishing',
  crash: 'crash',
};

function artFor(category: string | null | undefined): CategoryCode {
  if (!category) return 'liveCasino';
  return CATEGORY_TO_ART[category.toLowerCase()] ?? 'liveCasino';
}

interface ProviderGameCardProps {
  imageUrl?: string | null;
  displayName: string;
  category?: string | null;
  /** Brand name when known, otherwise the provider/aggregator name. */
  badgeLabel?: string | null;
  busy?: boolean;
  imageFailed?: boolean;
  onImageError?: () => void;
  /** First few above-the-fold cards load eagerly; the rest stay lazy. */
  eager?: boolean;
  lang: 'bn' | 'en';
}

export function ProviderGameCard({
  imageUrl,
  displayName,
  category,
  badgeLabel,
  busy = false,
  imageFailed = false,
  onImageError,
  eager = false,
  lang,
}: ProviderGameCardProps) {
  const showImage = Boolean(imageUrl) && !imageFailed;
  return (
    <div
      // contain:layout paint isolates this card's compositing layer so a
      // re-render of one tile cannot force the whole grid to recomposite
      // (matters on the long lobby list on low-end Mali GPUs).
      style={{ contain: 'layout paint' }}
      className="overflow-hidden rounded-2xl border border-brand-divider/60 bg-brand-paper shadow-[0_4px_12px_-8px_rgba(0,0,0,0.45)]"
    >
      {/* Square image area. The theme gradient shows through wherever a
          non-square image does not reach the edges, so there is never a
          black bar. object-contain keeps the whole image visible. */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-brand-surface to-brand-paper">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl as string}
            alt={displayName}
            width={400}
            height={400}
            onError={onImageError}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            {...({ fetchpriority: eager ? 'high' : 'low' } as Record<string, string>)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <CategoryHeroArt code={artFor(category)} className="absolute inset-0 h-full w-full object-cover opacity-90" />
        )}
      </div>
      {/* Caption strip BELOW the image, on the theme surface so it never
          overlaps the artwork. */}
      <div className="px-2.5 pb-2.5 pt-2 text-left">
        <h3 className="truncate text-sm font-extrabold leading-tight text-brand-ink">{displayName}</h3>
        {badgeLabel ? (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-brand-inkMute">{badgeLabel}</p>
        ) : null}
        <p className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          <Play className="h-3 w-3" />
          {busy ? (lang === 'bn' ? 'লোড...' : 'Loading...') : (lang === 'bn' ? 'খেলুন' : 'Play')}
        </p>
      </div>
    </div>
  );
}
