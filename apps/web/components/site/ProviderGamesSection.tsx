// Built by Anointed Coder.
//
// Honest placeholder for external / API provider games. We do NOT
// fake a provider connection: every card surfaces as "Awaiting
// credentials" and the section copy makes clear external provider
// games will only appear once provider API keys are supplied.
//
// Used on the homepage and /games lobby to set client + player
// expectations while the platform's external-provider adapter layer
// remains dormant.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plug, ArrowRight, Lock } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { CategoryHeroArt, type CategoryCode } from './CategoryHeroArt';
import { ProviderGameCard } from './ProviderGameCard';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';

interface SlotItem {
  code: CategoryCode;
  labelEn: string;
  labelBn: string;
}

const PROVIDER_SLOTS: SlotItem[] = [
  { code: 'slots',      labelEn: 'Provider Slots',      labelBn: 'প্রোভাইডার স্লট' },
  { code: 'liveCasino', labelEn: 'Provider Live Casino', labelBn: 'প্রোভাইডার লাইভ ক্যাসিনো' },
  { code: 'fishing',    labelEn: 'Provider Fishing',     labelBn: 'প্রোভাইডার ফিশিং' },
  { code: 'crash',      labelEn: 'Provider Crash',       labelBn: 'প্রোভাইডার ক্র্যাশ' },
  { code: 'tableGames', labelEn: 'Provider Table Games', labelBn: 'প্রোভাইডার টেবিল গেমস' },
];

interface Props {
  /** When true, surface an "Open Integrations" link to /admin/integrations. */
  showAdminLink?: boolean;
}

interface ProviderSummary { providerKey: string; name: string; lastSyncAt: string | null; launchMinBalance?: number }
interface ProviderGameRow { gameUid: string; displayName: string; category: string | null; imageUrl: string | null; brandKey?: string | null; brandName?: string | null }

export function ProviderGamesSection({ showAdminLink = false }: Props) {
  const { lang } = useLang();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [games, setGames] = useState<Array<ProviderGameRow & { providerKey: string; providerName: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInfo, setDepositInfo] = useState<{ balance: number; required: number }>({ balance: 0, required: 0 });

  const markImageFailed = (key: string) => {
    setFailedImages((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

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

  const providerByKey = new Map(providers.map((p) => [p.providerKey, p]));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/providers', { cache: 'no-store' });
        if (!res.ok) { if (alive) setLoaded(true); return; }
        const data = await res.json().catch(() => null);
        const list: ProviderSummary[] = Array.isArray(data?.providers) ? data.providers : [];
        if (!alive) return;
        setProviders(list);
        // For each active provider, fetch a small slice of games for
        // the live rail. Capped at 20 total to keep the homepage lean.
        const cap = 20;
        const collected: typeof games = [];
        for (const p of list) {
          if (collected.length >= cap) break;
          try {
            const r2 = await fetch(`/api/providers/${encodeURIComponent(p.providerKey)}/games`, { cache: 'no-store' });
            if (!r2.ok) continue;
            const j2 = await r2.json().catch(() => null);
            const rows: ProviderGameRow[] = Array.isArray(j2?.games) ? j2.games : [];
            for (const g of rows) {
              if (collected.length >= cap) break;
              collected.push({ ...g, providerKey: p.providerKey, providerName: p.name });
            }
          } catch { /* skip provider */ }
        }
        if (alive) {
          setGames(collected);
          setLoaded(true);
        }
      } catch {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const onLaunch = async (providerKey: string, gameUid: string) => {
    setLaunchError(null);
    setLaunching(`${providerKey}:${gameUid}`);
    try {
      // Pre-flight: prove the player is logged in AND has at least
      // the per-provider minimum balance. We avoid burning the
      // upstream call AND we never expose the launch payload when
      // the modal is about to fire instead.
      const balance = await fetchBalance();
      if (balance === null) { window.location.href = '/?login=1'; return; }
      const minBalance = providerByKey.get(providerKey)?.launchMinBalance ?? 0;
      const required = Math.max(0.01, minBalance > 0 ? minBalance : 1);
      if (balance < required) {
        setDepositInfo({ balance, required });
        setDepositOpen(true);
        return;
      }

      const res = await fetch(`/api/providers/${encodeURIComponent(providerKey)}/launch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameUid }),
      });
      const j = await res.json().catch(() => null);
      if (res.status === 401) { window.location.href = '/?login=1'; return; }
      if (res.status === 402 || isInsufficientFundsError(j)) {
        setDepositInfo({ balance: Number(j?.balance ?? balance), required: Number(j?.minBalance ?? required) });
        setDepositOpen(true);
        return;
      }
      if (!res.ok) {
        setLaunchError(j?.message ?? j?.code ?? 'Launch failed');
        return;
      }
      const url = typeof j?.launchUrl === 'string' ? j.launchUrl : '';
      if (!url) { setLaunchError(lang === 'bn' ? 'গেম চালু করার URL পাওয়া যায়নি।' : 'No launch URL returned.'); return; }
      window.location.href = url;
    } catch (e) {
      setLaunchError(e instanceof Error ? e.message : 'Launch failed');
    } finally {
      setLaunching(null);
    }
  };

  const hasLiveProvider = loaded && providers.length > 0 && games.length > 0;

  if (hasLiveProvider) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/40 bg-gradient-to-b from-amber-300/30 to-amber-500/10 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
              <Plug className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-brand-ink md:text-xl">{lang === 'bn' ? 'প্রোভাইডার গেমস' : 'Provider Games'}</h2>
              <p className="text-xs text-brand-inkMute">
                {lang === 'bn'
                  ? `${providers.length} অ্যাক্টিভ প্রোভাইডার . ${games.length} গেম দেখানো হচ্ছে`
                  : `${providers.length} active provider . ${games.length} games shown`}
              </p>
            </div>
          </div>
          {showAdminLink ? (
            <Link href="/admin/providers" className="hidden h-9 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 text-xs font-bold uppercase tracking-wider text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface md:inline-flex">
              {lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        {launchError ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{launchError}</p> : null}

        <DepositRequiredModal open={depositOpen} onOpenChange={setDepositOpen} balance={depositInfo.balance} requiredAmount={depositInfo.required} />

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 md:gap-3">
          {games.map((g) => {
            const key = `${g.providerKey}:${g.gameUid}`;
            const busy = launching === key;
            return (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => onLaunch(g.providerKey, g.gameUid)}
                className={cn('group block transition active:translate-y-px', busy && 'opacity-70')}
              >
                <ProviderGameCard
                  imageUrl={g.imageUrl}
                  displayName={g.displayName}
                  category={g.category}
                  badgeLabel={g.brandName ?? g.providerName}
                  busy={busy}
                  imageFailed={failedImages.has(key)}
                  onImageError={() => markImageFailed(key)}
                  lang={lang}
                />
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Link
            href="/games/provider"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-brand-divider bg-brand-paper px-5 text-xs font-extrabold uppercase tracking-wider text-brand-ink transition hover:border-amber-400 hover:bg-brand-surface"
          >
            {lang === 'bn' ? 'সব প্রোভাইডার গেম দেখুন' : 'View all provider games'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-b from-slate-700 to-slate-900 text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <Plug className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-brand-ink md:text-xl">
              {lang === 'bn' ? 'প্রোভাইডার গেমস' : 'Provider Games'}
            </h2>
            <p className="text-xs text-brand-inkMute">
              {lang === 'bn'
                ? 'এক্সটার্নাল প্রোভাইডার গেমস প্রোভাইডার ক্রেডেনশিয়াল কানেক্ট হলে এখানে দেখা যাবে।'
                : 'External provider games will appear here after provider credentials are connected.'}
            </p>
          </div>
        </div>
        {showAdminLink ? (
          <Link
            href="/admin/integrations"
            className="hidden h-9 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 text-xs font-bold uppercase tracking-wider text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface md:inline-flex"
          >
            {lang === 'bn' ? 'অ্যাডমিন প্রোভাইডার' : 'Admin Providers'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
        {PROVIDER_SLOTS.map((p) => (
          <div
            key={p.code}
            aria-disabled
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-white/10 bg-brand-ink text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]',
              'cursor-not-allowed opacity-90',
            )}
          >
            <div className="relative aspect-square overflow-hidden">
              <CategoryHeroArt code={p.code} className="absolute inset-0 h-full w-full opacity-80" />
              <span className="absolute left-2 top-2 inline-flex h-5 items-center rounded-full border border-amber-300/60 bg-amber-200/80 px-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-950 backdrop-blur">
                {lang === 'bn' ? 'প্রোভাইডার' : 'Provider'}
              </span>
            </div>
            <div className="px-3 pb-3 pt-2">
              <h3 className="truncate text-sm font-extrabold leading-tight text-white">
                {lang === 'bn' ? p.labelBn : p.labelEn}
              </h3>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/75">
                <Lock className="h-2.5 w-2.5" />
                {lang === 'bn' ? 'ক্রেডেনশিয়াল প্রতীক্ষায়' : 'Awaiting credentials'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-brand-inkMute">
        {lang === 'bn'
          ? 'প্রোভাইডার API কী এবং কলব্যাক ডকুমেন্টেশন সরবরাহ করা হলে এই প্ল্যাটফর্মের প্রোভাইডার অ্যাডাপ্টার লেয়ার দিয়ে এক্সটার্নাল গেম প্রোভাইডার কানেক্ট করা যাবে।'
          : 'Once provider API keys and callback documentation are supplied, this platform can connect external game providers through the provider adapter layer.'}
      </p>
    </section>
  );
}
