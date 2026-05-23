// Built by Anointed Coder.
// Image-first game tile for the light public theme. Renders a tall artwork
// area with a HOT/NEW marker, the game name beneath, the provider, and a
// hover Play overlay. Maintenance state replaces the Play overlay with a
// dim wrench icon.

'use client';

import { useState } from 'react';
import { Heart, Play, Wrench } from 'lucide-react';
import type { Game } from '@/types';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { mockProviders } from '@/lib/mock/categories';
import { MarkerHot, MarkerNew } from './markers';

const accentMap: Record<Game['accent'], { from: string; to: string; ink: string }> = {
  gold: { from: 'from-amber-300', to: 'to-amber-700', ink: 'text-amber-950' },
  neon: { from: 'from-emerald-400', to: 'to-emerald-700', ink: 'text-emerald-950' },
  royal: { from: 'from-fuchsia-500', to: 'to-indigo-700', ink: 'text-white' },
  red: { from: 'from-rose-500', to: 'to-orange-700', ink: 'text-white' },
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
    <div className="group overflow-hidden rounded-xl bg-brand-paper transition-transform hover:-translate-y-0.5">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-brand-divider">
        <div className={cn('absolute inset-0 bg-gradient-to-br', accent.from, accent.to)} />
        <GameArt iconKey={game.iconKey} className={accent.ink} />

        {marker ? (
          <div className="absolute left-2 top-2">
            {marker === 'hot' ? <MarkerHot /> : <MarkerNew />}
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Favorite"
          onClick={(e) => { e.stopPropagation(); setFav((v) => !v); }}
          className={cn(
            'absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border transition',
            fav
              ? 'border-rose-500 bg-rose-500 text-white'
              : 'border-white/40 bg-white/85 text-brand-inkSoft opacity-0 backdrop-blur group-hover:opacity-100',
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
        </button>

        {maintenance ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-brand-ink/65 text-white">
            <Wrench className="h-5 w-5 text-brand-yellow-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Maintenance</span>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2 opacity-0 transition group-hover:opacity-100">
            <span className="btn-yellow inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs">
              <Play className="h-3.5 w-3.5" /> Play
            </span>
          </div>
        )}
      </div>

      <div className="px-1 pt-2">
        <p className="truncate text-[13px] font-semibold text-brand-ink">{name}</p>
        <p className="truncate text-[11px] uppercase tracking-wider text-brand-inkMute">
          {provider?.name ?? ''}
        </p>
      </div>
    </div>
  );
}

function GameArt({ iconKey, className }: { iconKey: string; className?: string }) {
  const n = Number(iconKey.split('-')[1] ?? 1);
  return (
    <svg viewBox="0 0 200 240" className={cn('absolute inset-0 h-full w-full opacity-90', className)} fill="none">
      {n === 1 && (
        <g>
          <circle cx="100" cy="130" r="55" fill="currentColor" opacity="0.18" />
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
