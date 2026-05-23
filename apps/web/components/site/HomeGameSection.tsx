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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow-500 text-brand-ink">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <div>
            <h2 className="text-lg font-extrabold text-brand-ink md:text-xl">{title}</h2>
            {description ? <p className="text-xs text-brand-inkMute">{description}</p> : null}
          </div>
        </div>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink hover:text-brand-yellow-600">
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
