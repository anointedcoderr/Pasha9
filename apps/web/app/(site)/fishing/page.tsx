// Built by Anointed Coder.
'use client';

import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames } from '@/lib/mock/games';
import { useT } from '@/lib/i18n/context';

export default function FishingPage() {
  const t = useT();
  const games = mockGames.filter((g) => g.categoryId === 'c_fish');
  return (
    <div className="space-y-6">
      <CategoryHero
        kicker={t('nav.fishing')}
        title={t('home.sectionFish')}
        description={t('home.sectionFishDesc')}
        accent="blue"
        category="fishing"
        chips={[
          { label: 'Arcade', tone: 'sky' },
          { label: 'Instant Play', tone: 'gold' },
        ]}
      />
      <CategoryCatalog games={games} />
    </div>
  );
}
