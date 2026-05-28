// Built by Anointed Coder.
'use client';

import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames } from '@/lib/mock/games';
import { useT } from '@/lib/i18n/context';

export default function LiveCasinoPage() {
  const t = useT();
  const games = mockGames.filter((g) => g.categoryId === 'c_live');
  return (
    <div className="space-y-6">
      <CategoryHero
        kicker={t('nav.liveCasino')}
        title={t('home.sectionLive')}
        description={t('home.sectionLiveDesc')}
        accent="royal"
        category="liveCasino"
        chips={[
          { label: 'Live', tone: 'rose' },
          { label: 'Dealer Tables', tone: 'gold' },
          { label: 'Wallet Connected', tone: 'sky' },
        ]}
      />
      <CategoryCatalog games={games} />
    </div>
  );
}
