// Built by Anointed Coder.
//
// Full provider games lobby. Lists every active ExternalGame across
// every Live provider, with search, category pills, brand filter
// and Load-more pagination. Used as the deep-dive surface for
// players (the homepage rail caps at ~20 curated games and links
// here for the rest).
//
// Launch flow mirrors the homepage rail: prefetch wallet balance,
// gate against per-provider launchMinBalance, open the existing
// DepositRequiredModal when the player is under-funded. Token and
// secret are never exposed to the browser.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Plug, Play, Search } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { CategoryHeroArt, type CategoryCode } from '@/components/site/CategoryHeroArt';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';

interface ProviderRow { providerKey: string; name: string; launchMinBalance: number }
interface BrandRow { brandKey: string; brandName: string; count: number; providerKey: string }
interface LobbyGame {
  providerKey: string;
  providerName: string;
  gameUid: string;
  displayName: string;
  category: string | null;
  imageUrl: string | null;
  brandKey: string | null;
  brandName: string | null;
  launchMinBalance: number;
}

const CATEGORIES = [
  { key: '', en: 'All', bn: 'সব' },
  { key: 'slots', en: 'Slots', bn: 'স্লট' },
  { key: 'flash', en: 'Flash', bn: 'ফ্ল্যাশ' },
  { key: 'table', en: 'Table', bn: 'টেবিল' },
  { key: 'fishing', en: 'Fishing', bn: 'ফিশিং' },
  { key: 'crash', en: 'Crash', bn: 'ক্র্যাশ' },
];

const CATEGORY_TO_ART: Record<string, CategoryCode> = {
  slots: 'slots', flash: 'liveCasino', table: 'tableGames', fishing: 'fishing', crash: 'crash',
};
function artFor(cat: string | null | undefined): CategoryCode {
  if (!cat) return 'liveCasino';
  return CATEGORY_TO_ART[cat.toLowerCase()] ?? 'liveCasino';
}

const PAGE_SIZE = 60;

export default function ProviderLobbyPage() {
  const { lang } = useLang();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [providerKey, setProviderKey] = useState<string>('');
  const [brandKey, setBrandKey] = useState<string>('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [category, setCategory] = useState<string>('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [total, setTotal] = useState(0);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInfo, setDepositInfo] = useState<{ balance: number; required: number }>({ balance: 0, required: 0 });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // 1. Load providers once. Default to the single Live provider if
  //    only one is configured.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/providers', { cache: 'no-store' });
        if (!r.ok) { if (alive) setLoaded(true); return; }
        const j = await r.json().catch(() => null);
        const list: ProviderRow[] = Array.isArray(j?.providers) ? j.providers : [];
        if (!alive) return;
        setProviders(list);
        if (list.length === 1) setProviderKey(list[0].providerKey);
      } finally { if (alive) setLoaded(true); }
    })();
    return () => { alive = false; };
  }, []);

  // 2. Reload games whenever filters change. Reset offset and the
  //    failed-image set so the new page renders fresh.
  const loadPage = useCallback(async (nextOffset: number, append = false) => {
    if (!loaded) return;
    setBusy(true);
    try {
      const targets = providerKey ? [providers.find((p) => p.providerKey === providerKey)].filter(Boolean) as ProviderRow[] : providers;
      const collected: LobbyGame[] = [];
      let aggregatedTotal = 0;
      const cats: Record<string, number> = {};
      const aggregatedBrands: BrandRow[] = [];
      for (const p of targets) {
        const params = new URLSearchParams();
        if (debouncedQ) params.set('q', debouncedQ);
        if (category) params.set('category', category);
        if (brandKey) params.set('brand', brandKey);
        params.set('offset', String(nextOffset));
        params.set('limit', String(PAGE_SIZE));
        const r = await fetch(`/api/providers/${encodeURIComponent(p.providerKey)}/games?${params}`, { cache: 'no-store' });
        if (!r.ok) continue;
        const j = await r.json().catch(() => null);
        const rows = Array.isArray(j?.games) ? j.games : [];
        for (const g of rows) {
          collected.push({
            providerKey: p.providerKey,
            providerName: p.name,
            gameUid: String(g.gameUid),
            displayName: String(g.displayName),
            category: g.category ?? null,
            imageUrl: g.imageUrl ?? null,
            brandKey: g.brandKey ?? null,
            brandName: g.brandName ?? null,
            launchMinBalance: Number(j?.provider?.launchMinBalance ?? p.launchMinBalance ?? 0),
          });
        }
        aggregatedTotal += Number(j?.counts?.total ?? 0);
        const cb = j?.counts?.byCategory ?? {};
        for (const k of Object.keys(cb)) cats[k] = (cats[k] ?? 0) + Number(cb[k]);
        const bb = Array.isArray(j?.counts?.byBrand) ? j.counts.byBrand as Array<{ brandKey: string; brandName: string; count: number }> : [];
        for (const b of bb) aggregatedBrands.push({ providerKey: p.providerKey, brandKey: b.brandKey, brandName: b.brandName, count: b.count });
      }
      setGames((prev) => (append ? [...prev, ...collected] : collected));
      setTotal(aggregatedTotal);
      setByCategory(cats);
      // Only refresh the brand list on the first page so the dropdown
      // stays stable while the user pages.
      if (!append) setBrands(aggregatedBrands.sort((a, b) => b.count - a.count));
      setOffset(nextOffset + PAGE_SIZE);
    } finally { setBusy(false); }
  }, [loaded, providerKey, providers, debouncedQ, category, brandKey]);

  useEffect(() => {
    if (!loaded) return;
    setFailedImages(new Set());
    loadPage(0, false);
  }, [loaded, providerKey, brandKey, category, debouncedQ, loadPage]);

  const markImageFailed = (key: string) => setFailedImages((prev) => {
    if (prev.has(key)) return prev;
    const next = new Set(prev);
    next.add(key);
    return next;
  });

  const fetchBalance = async (): Promise<number | null> => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      if (r.status === 401) return null;
      if (!r.ok) return 0;
      const j = await r.json().catch(() => null);
      const v = j?.user?.wallet?.balance;
      return v == null ? 0 : Number(v);
    } catch { return 0; }
  };

  const onLaunch = async (g: LobbyGame) => {
    const key = `${g.providerKey}:${g.gameUid}`;
    setLaunchError(null);
    setLaunching(key);
    try {
      const balance = await fetchBalance();
      if (balance === null) { window.location.href = '/?login=1'; return; }
      const required = Math.max(0.01, g.launchMinBalance > 0 ? g.launchMinBalance : 1);
      if (balance < required) { setDepositInfo({ balance, required }); setDepositOpen(true); return; }
      const r = await fetch(`/api/providers/${encodeURIComponent(g.providerKey)}/launch`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameUid: g.gameUid }),
      });
      const j = await r.json().catch(() => null);
      if (r.status === 401) { window.location.href = '/?login=1'; return; }
      if (r.status === 402 || isInsufficientFundsError(j)) {
        setDepositInfo({ balance: Number(j?.balance ?? balance), required: Number(j?.minBalance ?? required) });
        setDepositOpen(true);
        return;
      }
      if (!r.ok) { setLaunchError(j?.message ?? j?.code ?? 'Launch failed'); return; }
      const url = typeof j?.launchUrl === 'string' ? j.launchUrl : '';
      if (!url) { setLaunchError('No launch URL returned.'); return; }
      window.location.href = url;
    } catch (e) { setLaunchError(e instanceof Error ? e.message : 'Launch failed'); }
    finally { setLaunching(null); }
  };

  const remaining = Math.max(0, total - games.length);
  const showLoadMore = remaining > 0 && providerKey !== '';

  const categoryPills = useMemo(() => CATEGORIES.map((c) => ({
    ...c,
    count: c.key === '' ? total : (byCategory[c.key] ?? 0),
  })), [byCategory, total]);

  if (loaded && providers.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Link href="/games" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-inkMute hover:text-brand-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {lang === 'bn' ? 'গেমস' : 'Games'}
        </Link>
        <h1 className="mt-4 text-xl font-extrabold text-brand-ink">{lang === 'bn' ? 'প্রোভাইডার গেমস' : 'Provider Games'}</h1>
        <p className="mt-2 text-sm text-brand-inkMute">
          {lang === 'bn'
            ? 'এখনো কোনো প্রোভাইডার লাইভ নেই। অ্যাডমিন প্রোভাইডার চালু করার পরে এখানে গেম দেখা যাবে।'
            : 'No provider is Live yet. Games will appear here once an admin activates a provider.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-4">
      <DepositRequiredModal open={depositOpen} onOpenChange={setDepositOpen} balance={depositInfo.balance} requiredAmount={depositInfo.required} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/games" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-inkMute hover:text-brand-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {lang === 'bn' ? 'গেমস' : 'Games'}
        </Link>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-200/15 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
          <Plug className="h-3 w-3" />
          {total} {lang === 'bn' ? 'গেম' : 'games'}
        </span>
      </div>

      <h1 className="text-2xl font-extrabold text-brand-ink md:text-3xl">{lang === 'bn' ? 'প্রোভাইডার গেমস' : 'Provider Games'}</h1>
      <p className="mt-1 text-xs text-brand-inkMute md:text-sm">
        {lang === 'bn'
          ? `${providers.length} অ্যাক্টিভ প্রোভাইডার . ${brands.length} ব্র্যান্ড . সার্চ, ক্যাটাগরি, ব্র্যান্ড এবং পেজ লোড দিয়ে সব ${total} গেম ব্রাউজ করুন।`
          : `${providers.length} active provider . ${brands.length} brand${brands.length === 1 ? '' : 's'} . Browse all ${total} games with search, category, brand and Load More.`}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="relative grow">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-inkMute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === 'bn' ? 'গেমের নাম বা আইডি' : 'Search name or game id'}
            className="h-10 w-full rounded-xl border border-brand-divider bg-brand-paper px-3 pl-9 text-sm text-brand-ink shadow-sm focus:border-amber-400 focus:outline-none"
          />
        </div>
        {providers.length > 1 ? (
          <select
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            className="h-10 rounded-xl border border-brand-divider bg-brand-paper px-3 text-sm font-semibold text-brand-ink"
            aria-label={lang === 'bn' ? 'প্রোভাইডার' : 'Provider'}
          >
            <option value="">{lang === 'bn' ? 'সব প্রোভাইডার' : 'All providers'}</option>
            {providers.map((p) => <option key={p.providerKey} value={p.providerKey}>{p.name}</option>)}
          </select>
        ) : null}
        {brands.length > 0 ? (
          <select
            value={brandKey}
            onChange={(e) => setBrandKey(e.target.value)}
            className="h-10 rounded-xl border border-brand-divider bg-brand-paper px-3 text-sm font-semibold text-brand-ink"
            aria-label={lang === 'bn' ? 'ব্র্যান্ড' : 'Brand'}
          >
            <option value="">{lang === 'bn' ? 'সব ব্র্যান্ড' : 'All brands'}</option>
            {brands.map((b) => <option key={`${b.providerKey}:${b.brandKey}`} value={b.brandKey}>{b.brandName} ({b.count})</option>)}
          </select>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {categoryPills.map((c) => (
          <button
            key={c.key || 'all'}
            type="button"
            onClick={() => setCategory(c.key)}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-bold uppercase tracking-wider transition',
              category === c.key
                ? 'border-amber-400 bg-amber-300/25 text-amber-700'
                : 'border-brand-divider bg-brand-paper text-brand-ink hover:border-amber-400'
            )}
          >
            {lang === 'bn' ? c.bn : c.en} <span className="text-brand-inkMute">{c.count}</span>
          </button>
        ))}
      </div>

      {launchError ? <p className="mt-3 rounded-lg border border-rose-300/60 bg-rose-100 px-3 py-2 text-sm text-rose-700">{launchError}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {games.map((g) => {
          const key = `${g.providerKey}:${g.gameUid}`;
          const isBusy = launching === key;
          return (
            <button
              key={key}
              type="button"
              disabled={isBusy}
              onClick={() => onLaunch(g)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border border-white/10 bg-brand-ink text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] transition active:scale-[0.98]',
                isBusy && 'opacity-70',
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {g.imageUrl && !failedImages.has(key) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.imageUrl} alt={g.displayName} onError={() => markImageFailed(key)} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <CategoryHeroArt code={artFor(g.category)} className="absolute inset-0 h-full w-full opacity-65" />
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-ink/95 via-brand-ink/40 to-transparent" />
                <span className="absolute left-2 top-2 inline-flex h-5 max-w-[60%] items-center truncate rounded-full border border-amber-300/60 bg-amber-200/15 px-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-100 backdrop-blur">
                  {g.providerName}
                </span>
                {g.brandKey ? (
                  <span className="absolute right-2 top-2 inline-flex h-5 items-center rounded-full border border-yellow-300/60 bg-yellow-300/25 px-1.5 text-[9px] font-extrabold uppercase tracking-wider text-yellow-50 backdrop-blur">
                    {g.brandName ?? g.brandKey}
                  </span>
                ) : null}
              </div>
              <div className="relative -mt-7 px-3 pb-3 pt-0 text-left">
                <h3 className="truncate text-sm font-extrabold leading-tight text-white">{g.displayName}</h3>
                <p className="mt-1 inline-flex h-7 items-center gap-1 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                  <Play className="h-3 w-3" />
                  {isBusy ? (lang === 'bn' ? 'লোড...' : 'Loading...') : (lang === 'bn' ? 'খেলুন' : 'Play')}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {games.length === 0 && loaded ? (
        <p className="mt-6 text-center text-sm text-brand-inkMute">
          {lang === 'bn' ? 'কোনো গেম পাওয়া যায়নি।' : 'No games match these filters.'}
        </p>
      ) : null}

      {showLoadMore ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => loadPage(offset, true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-400 bg-amber-300 px-6 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-sm disabled:opacity-60"
          >
            {busy ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...') : (lang === 'bn' ? `আরও দেখুন (${remaining})` : `Load more (${remaining})`)}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </main>
  );
}
