// Built by Anointed Coder.
//
// Homepage Sportsbook section. Replaces the generic 3-col game tile
// grid with horizontal event-style cards that mirror the visual
// language of a real sportsbook rail. Cards show a status pill, the
// provider/league line and the event name. No fake scores or team
// rosters are invented; when no real event data exists the card
// renders the game name as the headline, which is honest and looks
// like a sportsbook entry without claiming to be a live match.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flag, Play, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';
import type { HomeSection, HomeSectionGame } from '@/lib/homepage/sections';

interface Props {
  section: HomeSection;
}

function eventLabel(game: HomeSectionGame): string {
  if (game.brandName) return game.brandName;
  if (game.providerName) return game.providerName;
  return 'Sports';
}

export function SportsbookSection({ section }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const title = bn && section.titleBn ? section.titleBn : section.titleEn;
  const subtitle = bn && section.subtitleBn ? section.subtitleBn : section.subtitleEn;
  const [launching, setLaunching] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInfo, setDepositInfo] = useState<{ balance: number; required: number }>({ balance: 0, required: 0 });

  const fetchBalance = async (): Promise<number | null> => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      if (r.status === 401) return null;
      if (!r.ok) return 0;
      const j = await r.json().catch(() => null);
      const v = j?.user?.wallet?.balance;
      return v == null ? 0 : Number(v);
    } catch {
      return 0;
    }
  };

  const onLaunch = async (game: HomeSectionGame) => {
    if (!game.providerKey || !game.gameUid) return;
    setLaunchError(null);
    const key = `${game.providerKey}:${game.gameUid}`;
    setLaunching(key);
    try {
      const balance = await fetchBalance();
      if (balance === null) {
        window.location.href = '/?login=1';
        return;
      }
      const required = 1;
      if (balance < required) {
        setDepositInfo({ balance, required });
        setDepositOpen(true);
        return;
      }
      const res = await fetch(`/api/providers/${encodeURIComponent(game.providerKey)}/launch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameUid: game.gameUid }),
      });
      const j = await res.json().catch(() => null);
      if (res.status === 401) {
        window.location.href = '/?login=1';
        return;
      }
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
      if (!url) {
        setLaunchError(bn ? 'গেম চালু করার URL পাওয়া যায়নি।' : 'No launch URL returned.');
        return;
      }
      window.location.href = url;
    } catch (e) {
      setLaunchError(e instanceof Error ? e.message : 'Launch failed');
    } finally {
      setLaunching(null);
    }
  };

  if (section.games.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-6px_rgba(16,185,129,0.55)]">
            {section.iconImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={section.iconImageUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-contain p-1.5"
              />
            ) : (
              <Flag className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="inline-flex items-baseline gap-2 truncate text-lg font-extrabold text-brand-ink md:text-xl">
              <span>{title}</span>
              <span aria-hidden className="h-[2px] w-10 rounded-full bg-gradient-to-r from-emerald-500/80 to-transparent" />
            </h2>
            {subtitle ? <p className="text-xs text-brand-inkMute">{subtitle}</p> : null}
          </div>
        </div>
        <Link
          href={section.href}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 text-xs font-bold uppercase tracking-wider text-brand-ink transition hover:border-emerald-500 hover:bg-brand-surface"
        >
          {bn ? 'সব দেখুন' : 'All sports'} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {launchError ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{launchError}</p>
      ) : null}
      <DepositRequiredModal open={depositOpen} onOpenChange={setDepositOpen} balance={depositInfo.balance} requiredAmount={depositInfo.required} />

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3 pb-1 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
          {section.games.map((g) => {
            const isExternal = g.source === 'external';
            const busyKey = isExternal && g.providerKey && g.gameUid ? `${g.providerKey}:${g.gameUid}` : null;
            const busy = busyKey != null && launching === busyKey;
            const label = eventLabel(g);

            const card = (
              <article
                className={cn(
                  'group relative flex h-full w-[280px] shrink-0 flex-col gap-3 rounded-2xl border border-brand-divider bg-brand-paper p-4 text-left shadow-[0_4px_18px_-12px_rgba(15,17,21,0.18)] transition hover:border-emerald-500/60 hover:shadow-[0_12px_28px_-14px_rgba(16,185,129,0.35)] md:w-auto',
                  busy && 'opacity-70',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {bn ? 'উপলব্ধ' : 'Available'}
                  </span>
                  <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-brand-inkMute">
                    {label}
                  </span>
                </div>
                <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-brand-ink">
                  {g.displayName}
                </h3>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-inkMute">
                    <Sparkles className="h-3 w-3 text-emerald-500" />
                    {bn ? 'অনলাইন' : 'Online'}
                  </span>
                  <span className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-600 px-3 text-[11px] font-extrabold uppercase tracking-wider text-white shadow transition group-hover:bg-emerald-500">
                    <Play className="h-3 w-3" />
                    {busy ? (bn ? 'লোড' : 'Loading') : (bn ? 'খেলুন' : 'Play')}
                  </span>
                </div>
              </article>
            );

            if (isExternal) {
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onLaunch(g)}
                    className="block h-full w-full text-left"
                  >
                    {card}
                  </button>
                </li>
              );
            }
            return (
              <li key={g.key}>
                <Link href={g.href ?? '/sports'} className="block h-full">
                  {card}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
