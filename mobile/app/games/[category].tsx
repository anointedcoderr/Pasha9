// Built by Anointed Coder.
//
// Dynamic category grid: reads the route param (e.g. /games/live_casino) and
// renders the provider catalog fixed to that category. A handful of friendly
// aliases map onto the backend category slugs, and the special "featured" /
// "jackpot" params flip the corresponding flag instead of a category filter.
// All data + launch behaviour comes from the shared ProviderGrid.

import { useLocalSearchParams } from 'expo-router';
import { titleCase } from '@/lib/format';
import { ProviderGrid } from './_components/ProviderGrid';

// Friendly URL segments -> backend category slugs used by the games API.
const CATEGORY_ALIASES: Record<string, string> = {
  live: 'live_casino',
  'live-casino': 'live_casino',
  livecasino: 'live_casino',
  casino: 'live_casino',
  fast: 'flash',
  'fast-games': 'flash',
  sports: 'sportsbook',
  sport: 'sportsbook',
  fish: 'fishing',
};

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const raw = (category ?? '').toLowerCase();

  const featured = raw === 'featured' || raw === 'hot';
  const jackpot = raw === 'jackpot';
  const slug = CATEGORY_ALIASES[raw] ?? raw;

  const title = featured
    ? 'Hot Games'
    : jackpot
      ? 'Jackpot Games'
      : category
        ? titleCase(slug)
        : 'Games';

  return (
    <ProviderGrid
      title={title}
      fixedCategory={featured || jackpot ? undefined : slug || undefined}
      featured={featured}
      jackpot={jackpot}
    />
  );
}
