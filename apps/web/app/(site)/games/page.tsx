'use client';

import { GameCard } from '@/components/site/GameCard';
import { PageHeader } from '@/components/site/PageHeader';
import { mockGames } from '@/lib/mock/games';
import { mockCategories } from '@/lib/mock/categories';
import { Gamepad2 } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

export default function GamesPage() {
  const { lang } = useLang();
  const [active, setActive] = useState<string>('all');
  const games = active === 'all' ? mockGames : mockGames.filter((g) => g.categoryId === active);

  return (
    <>
      <PageHeader title="Game Library" subtitle="Browse the full catalogue across categories" icon={<Gamepad2 className="h-5 w-5" />} />

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActive('all')}
          className={cn(
            'rounded-pill px-4 py-2 text-sm transition',
            active === 'all' ? 'btn-gold' : 'border border-neon/15 bg-base-panel/60 text-ink-mid hover:text-ink-hi',
          )}
        >
          All
        </button>
        {mockCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={cn(
              'rounded-pill px-4 py-2 text-sm transition',
              active === c.id ? 'btn-gold' : 'border border-neon/15 bg-base-panel/60 text-ink-mid hover:text-ink-hi',
            )}
          >
            {lang === 'bn' ? c.nameBn : c.nameEn}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
    </>
  );
}
