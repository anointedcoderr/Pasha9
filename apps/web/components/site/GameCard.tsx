// Built by Anointed Coder.
//
// Premium 3D game card. Used by GameSection on sports + lottery
// surfaces. Mirrors the visual language of GameTile (gradient
// background + gold ring + shine sweep) at a larger size so it
// reads well in lower-density rows.

'use client';

import { useState } from 'react';
import { Heart, Play, Lock } from 'lucide-react';
import type { Game } from '@/types';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { mockProviders } from '@/lib/mock/categories';

interface Props {
  game: Game;
  size?: 'sm' | 'md' | 'lg';
}

const accentMap: Record<Game['accent'], { gradient: string; ink: string; ring: string }> = {
  gold:  { gradient: 'from-amber-300 via-amber-500 to-amber-800', ink: 'text-amber-950', ring: 'ring-amber-300/40' },
  neon:  { gradient: 'from-emerald-400 via-emerald-600 to-emerald-900', ink: 'text-emerald-950', ring: 'ring-emerald-300/40' },
  royal: { gradient: 'from-fuchsia-500 via-purple-700 to-indigo-900', ink: 'text-white', ring: 'ring-fuchsia-400/40' },
  red:   { gradient: 'from-rose-500 via-red-700 to-orange-800', ink: 'text-white', ring: 'ring-rose-400/40' },
};

export function GameCard({ game, size = 'md' }: Props) {
  const { lang } = useLang();
  const [fav, setFav] = useState(false);
  const accent = accentMap[game.accent];
  const provider = mockProviders.find((p) => p.id === game.providerId);
  const name = lang === 'bn' && game.nameBn ? game.nameBn : game.name;
  const maintenance = game.status === 'maintenance';

  const sizes = {
    sm: { card: 'min-h-[200px]', art: 'h-[130px]' },
    md: { card: 'min-h-[240px]', art: 'h-[170px]' },
    lg: { card: 'min-h-[280px]', art: 'h-[200px]' },
  } as const;
  const s = sizes[size];

  return (
    <div
      className={cn(
        'png-card group relative overflow-hidden rounded-2xl border border-white/10',
        'bg-gradient-to-b from-[#1a1029] to-[#0a0613] text-white',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_28px_-14px_rgba(0,0,0,0.65)]',
        'ring-1', accent.ring,
        s.card,
      )}
    >
      <button
        type="button"
        aria-label="Favorite"
        onClick={(e) => { e.stopPropagation(); setFav((v) => !v); }}
        className={cn(
          'absolute right-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition',
          fav ? 'border-rose-400 bg-rose-500 text-white' : 'border-white/30 bg-black/40 text-white/85 opacity-0 backdrop-blur group-hover:opacity-100',
        )}
      >
        <Heart className={cn('h-4 w-4', fav && 'fill-current')} />
      </button>

      <div className={cn('relative w-full overflow-hidden', s.art)}>
        <div className={cn('absolute inset-0 bg-gradient-to-br', accent.gradient)} />
        <div aria-hidden className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
        <GameArt iconKey={game.iconKey} accent={accent.ink} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        {maintenance ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 backdrop-blur-[2px]">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300/60 bg-black/60 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-100">
              <Lock className="h-3 w-3" />
              {lang === 'bn' ? 'শীঘ্রই আসছে' : 'Coming Soon'}
            </span>
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-bold text-white">{name}</h4>
          <span className="text-[10px] uppercase tracking-wider text-white/55">{provider?.name ?? ''}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-white/65">
            min ৳{game.minBet} <span className="text-white/30">|</span> max ৳{game.maxBet.toLocaleString()}
          </span>
          <button
            type="button"
            disabled={maintenance}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider transition',
              maintenance
                ? 'cursor-not-allowed bg-white/5 text-white/40'
                : 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-6px_rgba(245,180,0,0.7)] hover:brightness-105',
            )}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {maintenance ? (lang === 'bn' ? 'অনুপলব্ধ' : 'Unavailable') : (lang === 'bn' ? 'খেলুন' : 'Play')}
          </button>
        </div>
      </div>
    </div>
  );
}

function GameArt({ iconKey, accent }: { iconKey: string; accent: string }) {
  const n = Number(iconKey.split('-')[1] ?? 1);
  return (
    <svg viewBox="0 0 200 130" className={cn('absolute inset-0 h-full w-full opacity-95', accent)} fill="none">
      {n === 1 && (
        <g>
          <circle cx="100" cy="65" r="40" fill="currentColor" opacity="0.2" />
          <path d="M70 40 L130 40 L120 90 L80 90 Z" stroke="currentColor" strokeWidth="2.5" />
          <path d="M85 60 L100 50 L115 60 L100 80 Z" fill="currentColor" />
        </g>
      )}
      {n === 2 && (
        <g>
          <circle cx="60" cy="65" r="22" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="100" cy="65" r="22" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="140" cy="65" r="22" stroke="currentColor" strokeWidth="2.5" />
          <text x="60" y="71" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700">7</text>
          <text x="100" y="71" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700">7</text>
          <text x="140" y="71" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700">7</text>
        </g>
      )}
      {n === 3 && (
        <g>
          <path d="M40 90 C 60 60, 80 60, 100 80 S 140 100, 160 70" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="60" cy="55" r="8" fill="currentColor" />
          <circle cx="120" cy="80" r="10" fill="currentColor" />
        </g>
      )}
      {n === 4 && (
        <g>
          <rect x="55" y="35" width="40" height="60" rx="6" stroke="currentColor" strokeWidth="2.5" />
          <rect x="105" y="35" width="40" height="60" rx="6" stroke="currentColor" strokeWidth="2.5" />
          <text x="75" y="75" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="800">A</text>
          <text x="125" y="75" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="800">K</text>
        </g>
      )}
      {n === 5 && (
        <g>
          <path d="M100 25 L125 60 L100 95 L75 60 Z" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="100" cy="60" r="10" fill="currentColor" />
        </g>
      )}
      {n === 6 && (
        <g>
          <path d="M50 95 L100 30 L150 95 Z" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="100" cy="75" r="6" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}
