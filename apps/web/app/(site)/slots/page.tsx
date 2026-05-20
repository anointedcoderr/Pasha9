'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { GameSection } from '@/components/site/GameSection';
import { mockGames } from '@/lib/mock/games';
import { Cherry } from 'lucide-react';

export default function SlotsPage() {
  const games = mockGames.filter((g) => g.categoryId === 'c_slots');
  return (
    <>
      <PageHeader title="Slots Arena" subtitle="Spin reels, hit jackpots, daily draws" icon={<Cherry className="h-5 w-5" />} />
      <GameSection title="Popular Slots" games={games} layout="grid" />
    </>
  );
}
