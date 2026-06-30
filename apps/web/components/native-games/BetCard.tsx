// Built by Anointed Coder.
//
// Premium bet card. Bet input + Min/Half/2x/Max quick buttons + the
// game-specific play button. Used by every native game page. Renders
// as a fixed bottom sheet on mobile and inline on desktop.

'use client';

import { cn } from '@/lib/utils/cn';
import { formatBDT } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';

interface Props {
  bet: string;
  setBet: (next: string) => void;
  minBet: number;
  maxBet: number;
  balance: number | null;
  playLabel: string;
  onPlay: () => void;
  loading?: boolean;
  disabled?: boolean;
  // Optional small text shown above the play button (potential payout, etc).
  hint?: string;
  // Optional secondary action (e.g. Cashout in Mines).
  secondary?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  // Sticky on mobile by default; pass false to place inline on every breakpoint.
  stickyMobile?: boolean;
}

export function BetCard({ bet, setBet, minBet, maxBet, balance, playLabel, onPlay, loading, disabled, hint, secondary, stickyMobile = true }: Props) {
  const { lang } = useLang();
  const n = Number(bet);
  const valid = Number.isFinite(n) && n > 0;

  const clamp = (v: number) => Math.max(minBet, Math.min(maxBet, Math.round(v)));
  const setHalf = () => setBet(String(clamp(Math.max(minBet, Math.floor(n / 2)))));
  const setDouble = () => setBet(String(clamp(Math.floor(n * 2))));
  const setMin = () => setBet(String(minBet));
  const setMax = () => {
    const cap = balance != null ? Math.min(maxBet, Math.floor(balance)) : maxBet;
    setBet(String(Math.max(minBet, cap)));
  };

  return (
    <div
      id="png-bet"
      className={cn(
        // Scroll offset keeps the BetCard out from under the topbar when
        // jumped to via the hero CTA anchor link.
        'scroll-mt-24 rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur md:p-5',
        stickyMobile && 'fixed inset-x-3 bottom-3 z-30 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] md:static md:inset-auto md:shadow-none',
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <label htmlFor="png-bet-input" className="text-[10px] font-bold uppercase tracking-wider text-white/55 sm:inline">
            {lang === 'bn' ? 'বেট' : 'Bet'}
          </label>
          <div className="flex flex-1 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2">
            <input
              id="png-bet-input"
              type="number"
              inputMode="decimal"
              min={minBet}
              max={maxBet}
              step="1"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              aria-label={lang === 'bn' ? 'বেটের পরিমাণ' : 'Bet amount'}
              className="h-11 w-full bg-transparent text-base font-extrabold text-white outline-none placeholder:text-white/30"
              placeholder={String(minBet)}
            />
            <span className="text-[10px] font-bold uppercase text-white/45">BDT</span>
          </div>
        </div>
        {/* Quick-fill controls go onto their own row on 360px so they
            never wrap mid-row. On sm+ they shrink to the right of
            the input as before. The overflow-x-auto + scrollbar-none
            is a safety net for extra-narrow viewports / large fonts. */}
        <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 scrollbar-none sm:mx-0 sm:overflow-visible sm:px-0">
          <QuickBtn onClick={setMin}>Min</QuickBtn>
          <QuickBtn onClick={setHalf}>1/2</QuickBtn>
          <QuickBtn onClick={setDouble}>2x</QuickBtn>
          <QuickBtn onClick={setMax}>Max</QuickBtn>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60">
        <span>{lang === 'bn' ? 'সীমা' : 'Range'}: {formatBDT(minBet)} - {formatBDT(maxBet)}</span>
        {hint ? <span className="font-semibold text-amber-200">{hint}</span> : null}
      </div>

      <div className={cn('mt-3 grid gap-2', secondary ? 'grid-cols-2' : 'grid-cols-1')}>
        {secondary ? (
          <button
            type="button"
            onClick={secondary.onClick}
            disabled={secondary.disabled || secondary.loading}
            className={cn(
              'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-500/15 text-base font-extrabold uppercase tracking-wider text-emerald-100 transition',
              'hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60',
              (secondary.disabled || secondary.loading) && 'opacity-50',
            )}
          >
            {secondary.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPlay}
          disabled={loading || disabled || !valid}
          className={cn(
            'relative inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-base font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_22px_-8px_rgba(245,180,0,0.7)] transition',
            'hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 active:translate-y-px',
            (loading || disabled || !valid) && 'opacity-60',
          )}
        >
          {loading ? <Spinner /> : null}
          {playLabel}
        </button>
      </div>
    </div>
  );
}

function QuickBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin motion-keep" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
