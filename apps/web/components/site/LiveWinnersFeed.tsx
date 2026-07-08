// Built by Anointed Coder.
//
// LiveWinnersFeed - a public, read-only recent-winners feed.
//
// Polls GET /api/winners/recent every ~15s (only while the tab is visible)
// and renders a live-updating list of recent real wins: a masked player
// handle, the game (WinGo mode or Tournament prize), the amount and a
// relative time. New rows fade+rise in via the shared png-fade-up class,
// which is transform/opacity only and disabled under prefers-reduced-motion.
//
// Premium Pasha9 dark + gold identity, mobile-first. No money movement and
// no identity leak: handles arrive already masked from the API.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy, Sparkles, Crown, Radio } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatBDT, relativeTime } from '@/lib/utils/format';

const POLL_MS = 15000;

interface Winner {
  id: string;
  handle: string;
  kind: 'wingo' | 'tournament';
  mode: string | null;
  rank: number | null;
  amount: number;
  at: string;
}

function modeLabel(mode: string | null): string {
  switch (mode) {
    case 'wingo_30s':
      return 'WinGo 30s';
    case 'wingo_1m':
      return 'WinGo 1m';
    case 'wingo_3m':
      return 'WinGo 3m';
    case 'wingo_5m':
      return 'WinGo 5m';
    default:
      return 'WinGo';
  }
}

export function LiveWinnersFeed({ compact = false }: { compact?: boolean }) {
  const { lang } = useLang();
  const bn = lang === 'bn';

  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  // Track ids already shown so only genuinely new rows animate in. The
  // very first payload does not animate (it is not "new" to the viewer).
  const seenRef = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/winners/recent', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const list: Winner[] = Array.isArray(data?.winners) ? (data.winners as Winner[]) : [];

      if (seenRef.current === null) {
        // First successful load: seed the seen-set, do not animate.
        seenRef.current = new Set(list.map((w) => w.id));
        setFreshIds(new Set());
      } else {
        const seen = seenRef.current;
        const fresh = new Set<string>();
        for (const w of list) {
          if (!seen.has(w.id)) {
            fresh.add(w.id);
            seen.add(w.id);
          }
        }
        setFreshIds(fresh);
      }
      setWinners(list);
    } catch {
      // best-effort: keep the last good snapshot on a transient failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const rows = compact ? winners.slice(0, 6) : winners.slice(0, 20);

  return (
    <section
      aria-label={bn ? 'সাম্প্রতিক বিজয়ী' : 'Recent winners'}
      className="overflow-hidden rounded-2xl border border-gold-500/20 bg-[#0b0e14]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <h2 className="inline-flex items-center gap-2 font-en text-sm font-extrabold text-ink-hi">
          <Sparkles className="h-4 w-4 text-gold-300" />
          {bn ? 'সাম্প্রতিক বিজয়ী' : 'Recent winners'}
        </h2>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-lo">
          <span className="h-1.5 w-1.5 rounded-full bg-neon motion-safe:animate-pulseGlow" aria-hidden />
          {bn ? 'লাইভ' : 'Live'}
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-white/5" role="status" aria-label={bn ? 'লোড হচ্ছে' : 'Loading'}>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/[0.05]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.04]" />
              </div>
              <div className="h-4 w-14 animate-pulse rounded bg-white/[0.05]" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-lo">
          {bn
            ? 'এখনো কোনো সাম্প্রতিক জয় নেই। প্রথম বিজয়ী হোন!'
            : 'No recent wins yet. Be the first winner!'}
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((w) => {
            const isTournament = w.kind === 'tournament';
            const fresh = freshIds.has(w.id);
            return (
              <li
                key={w.id}
                className={`flex items-center gap-3 px-4 py-3 ${fresh ? 'png-fade-up' : ''}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
                    isTournament
                      ? 'bg-gold-500/12 text-gold-300 ring-gold-300/40'
                      : 'bg-neon/10 text-neon ring-neon/25'
                  }`}
                  aria-hidden
                >
                  {isTournament ? <Crown className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-hi">{w.handle}</p>
                  <p className="truncate text-[11px] text-ink-lo">
                    {isTournament
                      ? bn
                        ? `টুর্নামেন্ট পুরস্কার${w.rank ? ` · ${w.rank} নং স্থান` : ''}`
                        : `Tournament prize${w.rank ? ` · Rank ${w.rank}` : ''}`
                      : modeLabel(w.mode)}
                    {' · '}
                    {relativeTime(w.at, lang)}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-neon/10 px-2 py-1 font-en text-xs font-black tabular-nums text-neon">
                  {formatBDT(w.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
