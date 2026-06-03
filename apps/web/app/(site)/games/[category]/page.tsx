// Built by Anointed Coder.
//
// /games/<category> is a friendly URL that mirrors the public lobby's
// category filter. We translate the slug into the canonical category
// the importer normalised onto, then forward to /games/provider with
// the matching ?category= query so the lobby preselects the filter
// and lists real ExternalGame rows.
//
// Catch-alls (`hot`, unknown slugs) route to the unfiltered lobby
// where the user can browse everything.

import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

const CANONICAL: Record<string, string> = {
  slots: 'slots',
  slot: 'slots',
  'live-casino': 'live_casino',
  live_casino: 'live_casino',
  live: 'live_casino',
  casino: 'live_casino',
  table: 'table',
  fishing: 'fishing',
  fish: 'fishing',
  crash: 'crash',
  fast: 'flash',
  flash: 'flash',
  sports: 'sportsbook',
  sportsbook: 'sportsbook',
  esports: 'sportsbook',
  hot: '',
  featured: '',
};

export default function GamesCategoryPage({ params }: { params: { category: string } }): never {
  const slug = (params?.category ?? '').toLowerCase();
  const category = CANONICAL[slug];
  if (category === undefined) redirect('/games/provider');
  if (slug === 'hot' || slug === 'featured') redirect('/games/provider?featured=1');
  redirect(category ? `/games/provider?category=${category}` : '/games/provider');
}
