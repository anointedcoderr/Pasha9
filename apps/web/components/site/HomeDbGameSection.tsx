// Built by Anointed Coder.
//
// DB-driven homepage game section. Reads section title / icon / View
// All href from the section row supplied by lib/homepage/sections.ts
// and renders each game with the right click target:
//   external games. POST /api/providers/<key>/launch then redirect
//   native games.   <Link> to /games/<gameCode>
//
// External launch reuses the exact preflight from ProviderGamesSection:
// balance check via /api/auth/me, DepositRequiredModal fallback,
// 401 -> login modal. Nothing about wallet, launch, callback or
// deposit-prompt behaviour changes; this component only takes over
// the section heading + the tile grid.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Play, Sparkles, Flame, Cherry, Tv2, Fish, Zap, Ticket, Calendar, type LucideIcon } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { CategoryHeroArt, type CategoryCode } from './CategoryHeroArt';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';
import type { HomeSection, HomeSectionGame } from '@/lib/homepage/sections';

const ICON_MAP: Record<string, LucideIcon> = {
  flame: Flame,
  cherry: Cherry,
  tv: Tv2,
  fish: Fish,
  zap: Zap,
  ticket: Ticket,
  sparkles: Sparkles,
  play: Play,
  calendar: Calendar,
};

const ART_FOR_CATEGORY: Record<string, CategoryCode> = {
  slots: 'slots',
  slot: 'slots',
  flash: 'liveCasino',
  table: 'tableGames',
  live: 'liveCasino',
  casino: 'liveCasino',
  fishing: 'fishing',
  fish: 'fishing',
  crash: 'crash',
};

function artFor(category: string | null | undefined): CategoryCode {
  if (!category) return 'liveCasino';
  const c = category.toLowerCase();
  for (const [needle, code] of Object.entries(ART_FOR_CATEGORY)) {
    if (c.includes(needle)) return code;
  }
  return 'liveCasino';
}

interface Props {
  section: HomeSection;
}

export function HomeDbGameSection({ section }: Props) {
  const { lang } = useLang();
  const Icon = ICON_MAP[section.iconKey] ?? Sparkles;
  const title = lang === 'bn' && section.titleBn ? section.titleBn : section.titleEn;
  const subtitle = lang === 'bn' && section.subtitleBn ? section.subtitleBn : section.subtitleEn;

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

  const onLaunchExternal = async (game: HomeSectionGame) => {
    if (!game.providerKey || !game.gameUid) return;
    setLaunchError(null);
    const key = `${game.providerKey}:${game.gameUid}`;
    setLaunching(key);
    try {
      const balance = await fetchBalance();
      if (balance === null) { window.location.href = '/?login=1'; return; }
      // Minimal pre-flight; the launch route enforces the real
      // per-provider min balance and a 402 reply opens the modal.
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

  if (section.games.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-6px_rgba(245,180,0,0.7)]">
            {section.iconImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={section.iconImageUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-contain p-1.5"
              />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="inline-flex items-baseline gap-2 truncate text-lg font-extrabold text-brand-ink md:text-xl">
              <span>{title}</span>
              <span aria-hidden className="h-[2px] w-10 rounded-full bg-gradient-to-r from-brand-yellow-500/80 to-transparent" />
            </h2>
            {subtitle ? <p className="text-xs text-brand-inkMute">{subtitle}</p> : null}
          </div>
        </div>
        <Link
          href={section.href}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 text-xs font-bold uppercase tracking-wider text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface"
        >
          {lang === 'bn' ? 'সব দেখুন' : 'View All'} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {launchError ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{launchError}</p> : null}
      <DepositRequiredModal open={depositOpen} onOpenChange={setDepositOpen} balance={depositInfo.balance} requiredAmount={depositInfo.required} />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 md:gap-3">
        {section.games.map((g) => {
          const tileKey = g.key;
          const isExternal = g.source === 'external';
          const busyKey = isExternal && g.providerKey && g.gameUid ? `${g.providerKey}:${g.gameUid}` : null;
          const busy = busyKey != null && launching === busyKey;
          const useImage = g.imageUrl && !failedImages.has(tileKey);
          // Per-card overlay visibility. Defaults to "show everything"
          // so non-curated strip sections keep their legacy look. The
          // homepage Hot Games admin can flip these per row.
          const imageOnly = g.imageOnlyMode === true && useImage;
          const showProvider = g.showProviderLabel !== false && !imageOnly;
          const showName = g.showGameName !== false && !imageOnly;
          const showHotBadge = g.showHotBadge !== false && !imageOnly;
          const showPlay = g.showPlayButton !== false && !imageOnly;
          // In contain mode, render a blurred copy of the same image
          // behind the foreground so the tile never reveals a white
          // box. Cover mode keeps the current full-bleed behaviour.
          const useContain = g.imageFitMode === 'contain' && useImage;

          // Whether any text or button is rendered over the image.
          // When everything is off we skip the bottom dim gradient
          // so transparent PNGs / image-only tiles never get a
          // wasted dark band underneath.
          const hasOverlayText = !imageOnly && (showName || showPlay);

          const inner = (
            <div className="relative aspect-[4/3] overflow-hidden">
              {/* Layer 1 (always): vibrant category SVG art as the
                  base. Transparent regions of the operator's PNG
                  and transparent edges of a contain-mode image
                  reveal this vibrant art instead of the dark tile
                  gradient. Hidden only when the operator opts into
                  pure-image mode (they accept full responsibility
                  for the asset's edges). */}
              {!imageOnly ? (
                <CategoryHeroArt
                  code={artFor(g.category)}
                  className={cn(
                    'absolute inset-0 h-full w-full',
                    useImage ? 'opacity-75' : 'opacity-65',
                  )}
                />
              ) : null}
              {useImage ? (
                <>
                  {/* Layer 2: blurred + scaled copy of the operator
                      image. Provides the "image colour leaks past
                      the edge" feel for opaque uploads. For
                      transparent PNGs it is also transparent and
                      the layer-1 SVG art reads through it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imageUrl ?? ''}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full scale-125 object-cover blur-lg"
                  />
                  {/* Layer 3: the foreground image at the operator
                      chosen fit. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imageUrl ?? ''}
                    alt={g.displayName}
                    onError={() => markImageFailed(tileKey)}
                    className={cn(
                      'absolute inset-0 h-full w-full',
                      useContain ? 'object-contain' : 'object-cover',
                    )}
                  />
                </>
              ) : null}
              {hasOverlayText ? (
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-ink/95 via-brand-ink/40 to-transparent" />
              ) : null}
              {showHotBadge && g.isHot ? (
                <span className="absolute right-2 top-2 inline-flex h-5 items-center rounded-full border border-rose-300/60 bg-rose-500/25 px-1.5 text-[9px] font-extrabold uppercase tracking-wider text-rose-50 backdrop-blur">HOT</span>
              ) : null}
              {showHotBadge && g.isJackpot ? (
                <span className="absolute right-2 top-9 inline-flex h-5 items-center rounded-full border border-amber-300/60 bg-amber-300/25 px-1.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-50 backdrop-blur">JACKPOT</span>
              ) : null}
              {/* Brand name leads on the card. The aggregator (iGamingAPIs
                  Aggregator) is implied and only shown when no brand is
                  set, so cards never read as "iGamingAPIs Aggreg... / JILI" */}
              {showProvider && g.brandName ? (
                <span className="absolute left-2 top-2 inline-flex h-5 max-w-[80%] items-center truncate rounded-full border border-yellow-300/60 bg-yellow-300/25 px-1.5 text-[9px] font-extrabold uppercase tracking-wider text-yellow-50 backdrop-blur">
                  {g.brandName}
                </span>
              ) : showProvider && g.providerName ? (
                <span className="absolute left-2 top-2 inline-flex h-5 max-w-[60%] items-center truncate rounded-full border border-amber-300/60 bg-amber-200/15 px-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-100 backdrop-blur">
                  {g.providerName}
                </span>
              ) : null}
            </div>
          );

          const captionInner = imageOnly || (!showName && !showPlay) ? null : (
            <div className="relative -mt-7 px-3 pb-3 pt-0 text-left">
              {showName ? <h3 className="truncate text-sm font-extrabold leading-tight text-white">{g.displayName}</h3> : null}
              {showPlay ? (
                <p className="mt-1 inline-flex h-7 items-center gap-1 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                  <Play className="h-3 w-3" />
                  {busy ? (lang === 'bn' ? 'লোড...' : 'Loading...') : (lang === 'bn' ? 'খেলুন' : 'Play')}
                </p>
              ) : null}
            </div>
          );

          if (isExternal) {
            return (
              <button
                key={tileKey}
                type="button"
                disabled={busy}
                onClick={() => onLaunchExternal(g)}
                className={cn(
                  // Soft branded backdrop so transparent PNG art
                  // sits on a tasteful gradient instead of a flat
                  // black panel. The category SVG behind the image
                  // adds depth without competing with the artwork.
                  // Brand-tinted base. If every other rendering layer is
                  // transparent (e.g. an aggressive PNG with no surround),
                  // the tile still reads as warm casino chrome instead of
                  // a flat black panel.
                  'group relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#3a2a1a_0%,#1a1410_55%,#3a2a1a_100%)] text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] transition',
                  busy && 'opacity-70',
                )}
              >
                {inner}
                {captionInner}
              </button>
            );
          }
          return (
            <Link
              key={tileKey}
              href={g.href ?? '/games'}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#3a2a1a_0%,#1a1410_55%,#3a2a1a_100%)] text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] transition"
            >
              {inner}
              {captionInner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
