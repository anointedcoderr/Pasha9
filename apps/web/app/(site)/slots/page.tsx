// Built by Anointed Coder.
'use client';

import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames } from '@/lib/mock/games';
import { useT } from '@/lib/i18n/context';

export default function SlotsPage() {
  const t = useT();
  const games = mockGames.filter((g) => g.categoryId === 'c_slots');
  return (
    <div className="space-y-6">
      <CategoryHero
        kicker={t('nav.slots')}
        title={t('home.sectionSlots')}
        description={t('home.sectionSlotsDesc')}
        accent="yellow"
      />
      <CategoryCatalog games={games} />
    </div>
  );
}
