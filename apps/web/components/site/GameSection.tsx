'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ChevronRight, ChevronLeft, type LucideIcon } from 'lucide-react';
import { GameCard } from './GameCard';
import type { Game } from '@/types';
import { cn } from '@/lib/utils/cn';

interface Props {
  title: string;
  description?: string;
  href?: string;
  games: Game[];
  icon?: LucideIcon;
  layout?: 'scroll' | 'grid';
}

export function GameSection({ title, description, href, games, icon: Icon, layout = 'scroll' }: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon/15 bg-base-panel/70 text-neon">
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <div>
            <h2 className="text-xl font-semibold text-ink-hi md:text-2xl">{title}</h2>
            {description ? <p className="text-sm text-ink-lo">{description}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {layout === 'scroll' ? (
            <>
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scroll(-1)}
                className="hidden h-9 w-9 items-center justify-center rounded-lg border border-neon/15 bg-base-panel/60 text-ink-mid hover:text-ink-hi md:inline-flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scroll(1)}
                className="hidden h-9 w-9 items-center justify-center rounded-lg border border-neon/15 bg-base-panel/60 text-ink-mid hover:text-ink-hi md:inline-flex"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
          {href ? (
            <Link href={href} className="text-sm text-neon hover:text-ink-hi">
              View all
            </Link>
          ) : null}
        </div>
      </div>

      {layout === 'scroll' ? (
        <div ref={scroller} className={cn('mask-fade-x flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}>
          {games.map((g) => (
            <div key={g.id} className="w-[220px] shrink-0 md:w-[260px]">
              <GameCard game={g} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </section>
  );
}
