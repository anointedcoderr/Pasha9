// Built by Anointed Coder.
//
// Premium 3D-style game tile. Used by HomeGameSection rows on the
// homepage and the dense grid in CategoryCatalog (/games + category
// pages). Layered gradients, gold border accent, inner highlight,
// outer glow on hover, and an animated shine sweep deliver a
// casino-grade feel without copying any third-party game art.
//
// Inactive / maintenance games keep the same premium frame and
// show a "Coming Soon" badge so empty surfaces still feel intentional.

'use client';

import { useState } from 'react';
import { Heart, Play, Lock } from 'lucide-react';
import type { Game } from '@/types';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { mockProviders } from '@/lib/mock/categories';
import { MarkerHot, MarkerNew } from './markers';

type Accent = Game['accent'];

const accentMap: Record<Accent, { gradient: string; ink: string; ring: string }> = {
  gold:  { gradient: 'from-amber-300 via-amber-500 to-amber-800', ink: 'text-amber-950', ring: 'ring-amber-300/40' },
  neon:  { gradient: 'from-emerald-400 via-emerald-600 to-emerald-900', ink: 'text-emerald-950', ring: 'ring-emerald-300/40' },
  royal: { gradient: 'from-fuchsia-500 via-purple-700 to-indigo-900', ink: 'text-white', ring: 'ring-fuchsia-400/40' },
  red:   { gradient: 'from-rose-500 via-red-700 to-orange-800', ink: 'text-white', ring: 'ring-rose-400/40' },
};

interface Props {
  game: Game;
  marker?: 'hot' | 'new' | null;
}

export function GameTile({ game, marker }: Props) {
  const { lang } = useLang();
  const [fav, setFav] = useState(false);
  const accent = accentMap[game.accent];
  const provider = mockProviders.find((p) => p.id === game.providerId);
  const name = lang === 'bn' && game.nameBn ? game.nameBn : game.name;
  const maintenance = game.status === 'maintenance';

  return (
    <article className="group">
      <div
        className={cn(
          'png-card relative overflow-hidden rounded-2xl border border-white/10',
          'bg-gradient-to-b from-[#1a1029] to-[#0a0613]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_24px_-12px_rgba(0,0,0,0.6)]',
          'ring-1', accent.ring,
        )}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
          {/* Layered art background */}
          <div className={cn('absolute inset-0 bg-gradient-to-br', accent.gradient)} />
          <div aria-hidden className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
          <GameArt iconKey={game.iconKey} className={accent.ink} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {/* Top-left chips: HOT / NEW / FEATURED */}
          <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
            {marker === 'hot' ? <MarkerHot /> : null}
            {marker === 'new' ? <MarkerNew /> : null}
            {game.isFeatured && !marker ? <PremiumChip tone="gold">{lang === 'bn' ? 'ফিচার্ড' : 'Featured'}</PremiumChip> : null}
          </div>

          {/* Favorite */}
          <button
            type="button"
            aria-label="Favorite"
            onClick={(e) => { e.stopPropagation(); setFav((v) => !v); }}
            className={cn(
              'absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border transition',
              fav
                ? 'border-rose-400 bg-rose-500 text-white'
                : 'border-white/40 bg-black/40 text-white/85 opacity-0 backdrop-blur group-hover:opacity-100',
            )}
          >
            <Heart className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
          </button>

          {/* Maintenance / Coming Soon overlay (premium, not broken) */}
          {maintenance ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 backdrop-blur-[2px]">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300/60 bg-black/60 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-100">
                <Lock className="h-3 w-3" />
                {lang === 'bn' ? 'শীঘ্রই আসছে' : 'Coming Soon'}
              </span>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-4 text-xs font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-6px_rgba(245,180,0,0.7)]">
                <Play className="h-3.5 w-3.5 fill-current" />
                {lang === 'bn' ? 'খেলুন' : 'Play'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Caption sits outside the framed art so the card stays compact */}
      <div className="mt-2 px-0.5">
        <p className="truncate text-[13px] font-bold text-brand-ink">{name}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-brand-inkMute">
          <span className="truncate">{provider?.name ?? ''}</span>
          <span className="shrink-0 tabular-nums">৳{game.minBet}+</span>
        </div>
      </div>
    </article>
  );
}

function PremiumChip({ tone, children }: { tone: 'gold' | 'rose' | 'sky'; children: React.ReactNode }) {
  const map = {
    gold: 'border-amber-300/60 bg-amber-300/15 text-amber-100',
    rose: 'border-rose-300/50 bg-rose-500/15 text-rose-100',
    sky:  'border-sky-300/50 bg-sky-500/15 text-sky-100',
  } as const;
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur', map[tone])}>
      {children}
    </span>
  );
}

function GameArt({ iconKey, className }: { iconKey: string; className?: string }) {
  const n = Number(iconKey.split('-')[1] ?? 1);
  return (
    <svg viewBox="0 0 200 240" className={cn('absolute inset-0 h-full w-full opacity-95', className)} fill="none">
      {n === 1 && (
        <g>
          <circle cx="100" cy="130" r="55" fill="currentColor" opacity="0.20" />
          <path d="M60 90 L140 90 L128 180 L72 180 Z" stroke="currentColor" strokeWidth="3" />
          <path d="M82 130 L100 110 L118 130 L100 156 Z" fill="currentColor" />
        </g>
      )}
      {n === 2 && (
        <g>
          <circle cx="60" cy="130" r="24" stroke="currentColor" strokeWidth="3" />
          <circle cx="100" cy="130" r="24" stroke="currentColor" strokeWidth="3" />
          <circle cx="140" cy="130" r="24" stroke="currentColor" strokeWidth="3" />
          <text x="60" y="138" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="800">7</text>
          <text x="100" y="138" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="800">7</text>
          <text x="140" y="138" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="800">7</text>
        </g>
      )}
      {n === 3 && (
        <g>
          <path d="M30 170 C 60 120, 100 120, 130 150 S 170 180, 190 130" stroke="currentColor" strokeWidth="3" />
          <circle cx="64" cy="124" r="10" fill="currentColor" />
          <circle cx="130" cy="160" r="12" fill="currentColor" />
        </g>
      )}
      {n === 4 && (
        <g>
          <rect x="56" y="82" width="42" height="76" rx="6" stroke="currentColor" strokeWidth="3" />
          <rect x="106" y="82" width="42" height="76" rx="6" stroke="currentColor" strokeWidth="3" />
          <text x="77" y="130" textAnchor="middle" fill="currentColor" fontSize="26" fontWeight="800">A</text>
          <text x="127" y="130" textAnchor="middle" fill="currentColor" fontSize="26" fontWeight="800">K</text>
        </g>
      )}
      {n === 5 && (
        <g>
          <path d="M100 60 L140 120 L100 200 L60 120 Z" stroke="currentColor" strokeWidth="3" />
          <circle cx="100" cy="130" r="12" fill="currentColor" />
        </g>
      )}
      {n === 6 && (
        <g>
          <path d="M40 200 L100 80 L160 200 Z" stroke="currentColor" strokeWidth="3" />
          <circle cx="100" cy="160" r="8" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}
