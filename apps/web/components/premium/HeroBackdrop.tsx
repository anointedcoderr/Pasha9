// Built by Anointed Coder.
//
// Hero backdrop layer for the Spin and Lotto pages. When the
// operator has uploaded a hero photo to /admin/atelier the image
// renders as a full-bleed dimmed backdrop. When the slot is empty
// we fall back to a CSS-only render that still feels premium
// (radial gradient, gold-dust particles, hairline gold edge).

'use client';

import { useAsset } from '@/lib/atelier/client';
import { cn } from '@/lib/utils/cn';

interface Props {
  slot: string;
  /** Visual scheme used for the CSS fallback when no asset is uploaded. */
  scheme: 'mahogany' | 'sapphire' | 'emerald' | 'onyx';
  className?: string;
}

const SCHEME_BG: Record<Props['scheme'], string> = {
  mahogany: 'var(--pa-grad-mahogany)',
  sapphire: 'var(--pa-grad-sapphire)',
  emerald: 'var(--pa-grad-emerald)',
  onyx: 'var(--pa-grad-onyx)',
};

const SCHEME_GLOW: Record<Props['scheme'], string> = {
  mahogany: 'radial-gradient(60% 40% at 50% 0%, rgba(245,180,0,0.18), transparent 70%)',
  sapphire: 'radial-gradient(60% 40% at 50% 0%, rgba(180,210,255,0.18), transparent 70%)',
  emerald: 'radial-gradient(60% 40% at 50% 0%, rgba(120,255,180,0.16), transparent 70%)',
  onyx: 'radial-gradient(60% 40% at 50% 0%, rgba(245,200,80,0.18), transparent 70%)',
};

export function HeroBackdrop({ slot, scheme, className }: Props) {
  const url = useAsset(slot);

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)} aria-hidden>
      {/* Base color so the surface is never bare during image load. */}
      <div className="absolute inset-0" style={{ background: SCHEME_BG[scheme] }} />

      {/* Operator photo on top, dimmed. */}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          loading="eager"
          decoding="async"
        />
      ) : null}

      {/* Soft warm glow from the top. */}
      <div className="absolute inset-0" style={{ background: SCHEME_GLOW[scheme] }} />

      {/* Vignette pull at the edges. */}
      <div className="pa-vignette absolute inset-0" />

      {/* Suspended gold dust particles. */}
      <div className="pa-dust" />

      {/* Hairline gold edge at the top. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
    </div>
  );
}
