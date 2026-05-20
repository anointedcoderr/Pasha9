'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { GameSection } from '@/components/site/GameSection';
import { mockGames } from '@/lib/mock/games';
import { Tv2 } from 'lucide-react';

export default function LiveCasinoPage() {
  const games = mockGames.filter((g) => g.categoryId === 'c_live');
  return (
    <>
      <PageHeader
        title="Live Casino"
        subtitle="Real dealers, real action, low latency tables"
        icon={<Tv2 className="h-5 w-5" />}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          { t: 'Live Baccarat', d: 'Royal table with side bets' },
          { t: 'Live Roulette', d: 'European wheel, multi-camera' },
          { t: 'Andar Bahar', d: 'Authentic Bangla dealers' },
        ].map((b) => (
          <div key={b.t} className="card-glow p-5">
            <p className="text-xs uppercase tracking-wider text-gold-300">Tonight</p>
            <h3 className="mt-1 font-semibold text-ink-hi">{b.t}</h3>
            <p className="mt-1 text-sm text-ink-lo">{b.d}</p>
          </div>
        ))}
      </div>
      <GameSection title="All live tables" games={games} layout="grid" />
    </>
  );
}
