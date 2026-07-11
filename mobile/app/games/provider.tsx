// Built by Anointed Coder.
//
// Provider games lobby. The deep-dive surface for the aggregator catalog:
// real search, category + brand filters and Load-more over every active
// provider game. Deep-link params from the lobby (category / brand / q /
// providerKey / featured / jackpot) seed the initial filters. All of the data
// + launch behaviour lives in the shared ProviderGrid.

import { useLocalSearchParams } from 'expo-router';
import { ProviderGrid } from './_components/ProviderGrid';

export default function ProviderScreen() {
  const params = useLocalSearchParams<{
    title?: string;
    category?: string;
    brand?: string;
    brandKey?: string;
    q?: string;
    provider?: string;
    providerKey?: string;
    featured?: string;
    jackpot?: string;
  }>();

  const brand = (params.brand ?? params.brandKey ?? '').toUpperCase() || undefined;
  const providerKey = params.provider ?? params.providerKey ?? undefined;
  const featured = params.featured === '1';
  const jackpot = params.jackpot === '1';

  const title =
    params.title ??
    (featured ? 'Hot Games' : jackpot ? 'Jackpot Games' : 'Provider Games');

  return (
    <ProviderGrid
      title={title}
      subtitle="Slots, live casino, table games and more"
      // Category + brand stay switchable chips here; an incoming deep link only
      // seeds their starting value so /games/provider?category=slots lands on
      // Slots but the player can still change it.
      initialCategory={params.category}
      initialBrand={brand}
      featured={featured}
      jackpot={jackpot}
      initialQuery={params.q}
      initialProviderKey={providerKey}
    />
  );
}
