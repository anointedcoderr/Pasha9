'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { GameSection } from '@/components/site/GameSection';
import { mockGames } from '@/lib/mock/games';
import { Fish } from 'lucide-react';

export default function FishingPage() {
  const games = mockGames.filter((g) => g.categoryId === 'c_fish');
  return (
    <>
      <PageHeader title="Fishing Games" subtitle="Fast paced arcade style cannon games" icon={<Fish className="h-5 w-5" />} />
      <GameSection title="Featured fishing titles" games={games} layout="grid" />
    </>
  );
}
