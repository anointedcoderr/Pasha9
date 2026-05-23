// Built by Anointed Coder.
// Reusable filtered game catalog for category pages. Provider filter pills,
// sort dropdown, search input, and a paginated dense grid of GameTile.

'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Game, GameProvider } from '@/types';
import { useT } from '@/lib/i18n/context';
import { mockProviders } from '@/lib/mock/categories';
import { GameTile } from './GameTile';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  /** Initial game pool. */
  games: Game[];
  /** Override available providers (default: all mock providers). */
  providers?: GameProvider[];
  /** Page size for the grid. */
  pageSize?: number;
}

type Sort = 'featured' | 'name' | 'maxbet';

export function CategoryCatalog({ games, providers = mockProviders, pageSize = 24 }: Props) {
  const t = useT();
  const [providerId, setProviderId] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('featured');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let next = games;
    if (providerId !== 'all') next = next.filter((g) => g.providerId === providerId);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      next = next.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        (g.nameBn ?? '').toLowerCase().includes(q),
      );
    }
    if (sort === 'name') {
      next = [...next].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'maxbet') {
      next = [...next].sort((a, b) => Number(b.maxBet) - Number(a.maxBet));
    } else {
      next = [...next].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    }
    return next;
  }, [games, providerId, query, sort]);

  const visible = filtered.slice(0, page * pageSize);
  const hasMore = filtered.length > visible.length;

  return (
    <section className="space-y-4">
      {/* Provider filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setProviderId('all'); setPage(1); }}
          className="pill-provider"
          data-active={providerId === 'all'}
        >
          {t('common.all')}
        </button>
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setProviderId(p.id); setPage(1); }}
            className="pill-provider"
            data-active={providerId === p.id}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Sort and search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-brand-inkMute">{t('cat.sort')}</label>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }}
            className="h-9 rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink focus:border-brand-yellow-500 focus:outline-none"
          >
            <option value="featured">{t('cat.sortFeatured')}</option>
            <option value="name">{t('cat.sortName')}</option>
            <option value="maxbet">{t('cat.sortMaxBet')}</option>
          </select>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-inkMute" />
          <input
            type="search"
            placeholder={t('cat.searchPlaceholder')}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border border-brand-divider bg-brand-paper pl-9 pr-3 text-sm text-brand-ink focus:border-brand-yellow-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-brand-inkMute">
        {filtered.length} {t('cat.results')}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card-light p-6">
          <EmptyState
            title={t('cat.emptyTitle')}
            description={t('cat.emptyDescription')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((g) => (
            <GameTile key={g.id} game={g} />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="btn-outline-ink inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm"
          >
            {t('cat.loadMore')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
