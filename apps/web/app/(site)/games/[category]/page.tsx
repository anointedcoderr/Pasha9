'use client';

import { useParams } from 'next/navigation';
import { GameSection } from '@/components/site/GameSection';
import { PageHeader } from '@/components/site/PageHeader';
import { gamesByCategory } from '@/lib/mock/games';
import { mockCategories } from '@/lib/mock/categories';
import { useLang } from '@/lib/i18n/context';
import { Sparkles } from 'lucide-react';

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const { lang } = useLang();
  const slug = params.category;
  const category = mockCategories.find((c) => c.slug === slug);
  const games = gamesByCategory(slug);

  const title = category ? (lang === 'bn' ? category.nameBn : category.nameEn) : slug;

  return (
    <>
      <PageHeader title={title} subtitle={`${games.length} games available`} icon={<Sparkles className="h-5 w-5" />} />
      <GameSection title="All in this category" games={games} layout="grid" />
    </>
  );
}
