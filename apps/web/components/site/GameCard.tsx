'use client';

import { useState } from 'react';
import { Heart, Play, Wrench } from 'lucide-react';
import type { Game } from '@/types';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { mockProviders } from '@/lib/mock/categories';

interface Props {
  game: Game;
  size?: 'sm' | 'md' | 'lg';
}

const accentMap: Record<Game['accent'], { from: string; to: string; ring: string; text: string }> = {
  gold: { from: 'from-gold-300', to: 'to-gold-700', ring: 'ring-gold-300/40', text: 'text-base-deep' },
  neon: { from: 'from-neon', to: 'to-emerald-700', ring: 'ring-neon/40', text: 'text-base-deep' },
  royal: { from: 'from-fuchsia-500', to: 'to-indigo-700', ring: 'ring-fuchsia-400/40', text: 'text-white' },
  red: { from: 'from-rose-500', to: 'to-orange-700', ring: 'ring-rose-400/40', text: 'text-white' },
};

export function GameCard({ game, size = 'md' }: Props) {
  const { lang } = useLang();
  const [fav, setFav] = useState(false);
  const accent = accentMap[game.accent];
  const provider = mockProviders.find((p) => p.id === game.providerId);
  const name = lang === 'bn' && game.nameBn ? game.nameBn : game.name;
  const maintenance = game.status === 'maintenance';

  const sizes = {
    sm: { card: 'min-h-[180px]', art: 'h-[110px]' },
    md: { card: 'min-h-[220px]', art: 'h-[150px]' },
    lg: { card: 'min-h-[260px]', art: 'h-[180px]' },
  } as const;
  const s = sizes[size];

  return (
    <div className={cn('group relative overflow-hidden rounded-card border border-neon/10 bg-base-panel/50 transition hover:-translate-y-1', s.card)}>
      <button
        type="button"
        aria-label="Favorite"
        onClick={(e) => {
          e.stopPropagation();
          setFav((v) => !v);
        }}
        className={cn(
          'absolute right-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition',
          fav ? 'border-neon/40 bg-neon/15 text-neon' : 'border-white/10 bg-black/40 text-ink-mid opacity-0 group-hover:opacity-100',
        )}
      >
        <Heart className={cn('h-4 w-4', fav && 'fill-current')} />
      </button>

      <div className={cn('relative w-full overflow-hidden', s.art)}>
        <div className={cn('absolute inset-0 bg-gradient-to-br', accent.from, accent.to)} />
        <GameArt iconKey={game.iconKey} accent={accent.text} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-base-deep/85 via-base-deep/30 to-transparent" />
        {maintenance ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-base-deep/70 backdrop-blur-sm">
            <Wrench className="h-5 w-5 text-gold-300" />
            <span className="text-xs text-gold-300">Maintenance</span>
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-semibold text-ink-hi">{name}</h4>
          <span className="text-[10px] uppercase tracking-wider text-ink-lo">{provider?.name ?? ''}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-ink-lo">
            min ৳{game.minBet} <span className="text-ink-mute">|</span> max ৳{game.maxBet.toLocaleString()}
          </span>
          <button
            type="button"
            disabled={maintenance}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              maintenance ? 'cursor-not-allowed bg-base-elev text-ink-lo' : 'btn-gold',
            )}
          >
            <Play className="h-3.5 w-3.5" /> Play
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute inset-0 rounded-card ring-1" />
        <div className={cn('absolute inset-0 rounded-card', 'shadow-glow-gold')} />
      </div>
    </div>
  );
}

function GameArt({ iconKey, accent }: { iconKey: string; accent: string }) {
  const n = Number(iconKey.split('-')[1] ?? 1);
  return (
    <svg viewBox="0 0 200 130" className={cn('absolute inset-0 h-full w-full', accent)} fill="none">
      {n === 1 && (
        <g>
          <circle cx="100" cy="65" r="40" fill="currentColor" opacity="0.18" />
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
