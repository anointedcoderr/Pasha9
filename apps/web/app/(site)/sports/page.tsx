'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Trophy, Activity } from 'lucide-react';
import { mockGames } from '@/lib/mock/games';
import { GameSection } from '@/components/site/GameSection';
import { useT } from '@/lib/i18n/context';

export default function SportsPage() {
  const t = useT();
  const games = mockGames.filter((g) => g.categoryId === 'c_sports');

  const matches = [
    { league: 'Bangladesh Premier League', home: 'Dhaka Dynamos', away: 'Chattogram Kings', time: 'Tonight 19:30', odds: ['1.85', '3.20', '2.40'] },
    { league: 'International Friendly', home: 'Bangladesh', away: 'Indonesia', time: 'Tomorrow 17:00', odds: ['1.75', '3.10', '4.20'] },
    { league: 'Asian Champions League', home: 'Mohun Bagan', away: 'Bashundhara Kings', time: 'Sat 22:00', odds: ['2.10', '3.00', '3.40'] },
  ];

  return (
    <>
      <PageHeader title="Sports Book" subtitle="Pre-match and in-play markets across leagues" icon={<Trophy className="h-5 w-5" />} />

      <div className="mb-8 space-y-3">
        {matches.map((m) => (
          <div key={m.home} className="card-glow flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gold-300">{m.league}</p>
              <h3 className="mt-1 text-base font-semibold text-ink-hi">{m.home} <span className="text-ink-lo">vs</span> {m.away}</h3>
              <p className="mt-1 text-xs text-ink-lo">{m.time}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:w-[300px]">
              {['Home', 'Draw', 'Away'].map((label, i) => (
                <button key={label} className="flex flex-col items-center rounded-xl border border-neon/15 bg-base-elev/70 py-2 transition hover:border-neon/40 hover:text-ink-hi">
                  <span className="text-[10px] uppercase tracking-wider text-ink-lo">{label}</span>
                  <span className="text-base font-semibold text-ink-hi">{m.odds[i]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 inline-flex items-center gap-2 text-xs text-ink-lo">
        <Activity className="h-3.5 w-3.5 text-neon" /> Markets shown are placeholders. Live odds appear after provider connection.
      </div>

      <GameSection title="More sports" games={games} layout="grid" />
    </>
  );
}
