'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { GameSection } from '@/components/site/GameSection';
import { mockGames } from '@/lib/mock/games';
import { Ticket } from 'lucide-react';

export default function LotteryPage() {
  const games = mockGames.filter((g) => g.categoryId === 'c_lottery');
  return (
    <>
      <PageHeader title="Lottery and Number Games" subtitle="Daily and weekly draws with cumulative prize pools" icon={<Ticket className="h-5 w-5" />} />
      <GameSection title="All draws" games={games} layout="grid" />
    </>
  );
}
