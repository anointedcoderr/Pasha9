// Built by Anointed Coder.
'use client';

import { useState } from 'react';
import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames } from '@/lib/mock/games';
import { mockCategories } from '@/lib/mock/categories';
import { useT, useLang } from '@/lib/i18n/context';

export default function GamesPage() {
  const t = useT();
  const { lang } = useLang();
  const [category, setCategory] = useState<string>('all');
  const filtered = category === 'all' ? mockGames : mockGames.filter((g) => g.categoryId === category);

  return (
    <div className="space-y-6">
      <CategoryHero
        kicker={t('navx.slots').replace(/.*/, t('home.sectionHot').toUpperCase())}
        title={t('home.sectionHot')}
        description={t('home.sectionHotDesc')}
        accent="navy"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className="pill-provider"
          data-active={category === 'all'}
        >
          {t('common.all')}
        </button>
        {mockCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className="pill-provider"
            data-active={category === c.id}
          >
            {lang === 'bn' ? c.nameBn : c.nameEn}
          </button>
        ))}
      </div>

      <CategoryCatalog games={filtered} />
    </div>
  );
}
