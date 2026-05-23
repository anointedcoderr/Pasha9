// Built by Anointed Coder.
'use client';

import { useParams } from 'next/navigation';
import { CategoryHero } from '@/components/site/CategoryHero';
import { CategoryCatalog } from '@/components/site/CategoryCatalog';
import { mockGames, gamesByCategory } from '@/lib/mock/games';
import { mockCategories } from '@/lib/mock/categories';
import { useT, useLang } from '@/lib/i18n/context';

type Accent = 'yellow' | 'blue' | 'royal' | 'red' | 'green' | 'navy';
type SyntheticSlug = 'crash' | 'table' | 'fast';

const ACCENT_BY_SLUG: Record<string, Accent> = {
  hot: 'red',
  slots: 'yellow',
  'live-casino': 'royal',
  fishing: 'blue',
  sports: 'green',
  lottery: 'yellow',
  poker: 'navy',
  esports: 'blue',
  crash: 'red',
  table: 'navy',
  fast: 'red',
};

function isSyntheticSlug(s: string): s is SyntheticSlug {
  return s === 'crash' || s === 'table' || s === 'fast';
}

function syntheticGames(slug: SyntheticSlug) {
  if (slug === 'crash') return mockGames.filter((g) => ['c_hot', 'c_lottery'].includes(g.categoryId)).slice(0, 24);
  if (slug === 'table') return mockGames.filter((g) => ['c_poker', 'c_live'].includes(g.categoryId)).slice(0, 24);
  return mockGames.filter((g) => ['c_slots', 'c_hot'].includes(g.categoryId)).slice(0, 24);
}

const SYNTHETIC_TITLES: Record<SyntheticSlug, { bn: string; en: string; desc: string }> = {
  crash: { bn: 'ক্র্যাশ গেম', en: 'Crash Games', desc: 'Quick rounds and high multipliers' },
  table: { bn: 'টেবিল গেম', en: 'Table Games', desc: 'Classic table action with multiple variants' },
  fast: { bn: 'ফাস্ট গেম', en: 'Fast Games', desc: 'Fast paced bets with rapid results' },
};

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const slug = params.category;
  const t = useT();
  const { lang } = useLang();

  const synthetic = isSyntheticSlug(slug);
  const category = mockCategories.find((c) => c.slug === slug);
  const games = synthetic ? syntheticGames(slug) : gamesByCategory(slug);

  const title = synthetic
    ? (lang === 'bn' ? SYNTHETIC_TITLES[slug].bn : SYNTHETIC_TITLES[slug].en)
    : category
      ? (lang === 'bn' ? category.nameBn : category.nameEn)
      : slug;

  const description = synthetic
    ? SYNTHETIC_TITLES[slug].desc
    : t('home.sectionHotDesc');

  const accent = ACCENT_BY_SLUG[slug] ?? 'navy';

  return (
    <div className="space-y-6">
      <CategoryHero kicker={title} title={title} description={description} accent={accent} />
      <CategoryCatalog games={games} />
    </div>
  );
}
