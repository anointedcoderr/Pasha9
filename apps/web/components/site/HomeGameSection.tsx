// Built by Anointed Coder.
// Homepage game row. Renders a small heading with optional View All link,
// then a 3-up (mobile) / 4-up (md) / 5-up (lg) / 6-up (xl) grid of GameTiles.

'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { Game } from '@/types';
import { GameTile } from './GameTile';

interface Props {
  title: string;
  description?: string;
  href?: string;
  games: Game[];
  icon?: LucideIcon;
  limit?: number;
  featuredMarker?: 'hot' | 'new' | null;
}

export function HomeGameSection({ title, description, href, games, icon: Icon, limit = 12, featuredMarker = null }: Props) {
  const visible = games.slice(0, limit);
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-6px_rgba(245,180,0,0.7)]">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="inline-flex items-baseline gap-2 truncate text-lg font-extrabold text-brand-ink md:text-xl">
              <span>{title}</span>
              <span aria-hidden className="h-[2px] w-10 rounded-full bg-gradient-to-r from-brand-yellow-500/80 to-transparent" />
            </h2>
            {description ? <p className="text-xs text-brand-inkMute">{description}</p> : null}
          </div>
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 text-xs font-bold uppercase tracking-wider text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface"
          >
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visible.map((g, i) => (
          <GameTile key={g.id} game={g} marker={i === 0 ? featuredMarker : null} />
        ))}
      </div>
    </section>
  );
}
