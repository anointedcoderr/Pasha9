// Built by Anointed Coder.
//
// Pasha Slots - premium game page. 3 reels, single payline. The
// server picks every reel stop; the client only animates the reveal.

'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useNativeGame } from '@/lib/native-games/use-native-game';
import { GameShell, GamePanel, GamePanelTitle } from '@/components/native-games/GameShell';
import { BetCard } from '@/components/native-games/BetCard';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';
import { safeArray, safeNumber, safeString, safeToFixed } from '@/lib/native-games/safe';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Trophy } from 'lucide-react';

interface SlotsResult {
  roundId: string;
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  reelSymbols: string[];
  matchedSymbol: string | null;
  reused?: boolean;
}

const SYMBOL_GLYPH: Record<string, { glyph: string; color: string }> = {
  CHERRY:  { glyph: '🍒', color: 'text-rose-300' },
  LEMON:   { glyph: '🍋', color: 'text-amber-200' },
  CLOVER:  { glyph: '☘',  color: 'text-emerald-300' },
  NINE:    { glyph: '9',  color: 'text-sky-300' },
  STAR:    { glyph: '★',  color: 'text-amber-100' },
  DIAMOND: { glyph: '◆',  color: 'text-cyan-200' },
  CROWN:   { glyph: '♕',  color: 'text-amber-200' },
  SEVEN:   { glyph: '7',  color: 'text-rose-200' },
};
function glyph(s: string | null | undefined): string { return s ? (SYMBOL_GLYPH[s]?.glyph ?? s[0]) : '?'; }
function color(s: string | null | undefined): string { return s ? (SYMBOL_GLYPH[s]?.color ?? 'text-white') : 'text-white/50'; }

export default function SlotsPage() {
  const { lang } = useLang();
  const ng = useNativeGame('slots');
  const game = ng.game;
  const cfg = (game?.config ?? {}) as { reels?: number; paytable?: Record<string, Record<string, number>> };
  const reels = Number(cfg.reels ?? 3);

  const [bet, setBet] = useState<string>('10');
  const [last, setLast] = useState<SlotsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reelAnim, setReelAnim] = useState<boolean>(false);
  const [depositOpen, setDepositOpen] = useState(false);

  useEffect(() => {
    if (!last) return;
    setReelAnim(true);
    const id = window.setTimeout(() => setReelAnim(false), 700);
    return () => window.clearTimeout(id);
  }, [last]);

  const onSpin = async () => {
    if (!ng.session) return;
    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(lang === 'bn' ? 'বেট পরিমাণ অবৈধ' : 'Bet amount is invalid');
      return;
    }
    if (ng.balance != null && amount > ng.balance) {
      setDepositOpen(true);
      return;
    }
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/native-games/slots/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: ng.session.id, betAmount: amount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (isInsufficientFundsError(data)) {
          setDepositOpen(true);
          ng.refreshBalance();
          return;
        }
        setError(data?.message ?? data?.code ?? 'Spin failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const raw = (data ?? {}) as Partial<SlotsResult>;
      const safe: SlotsResult = {
        roundId: typeof raw.roundId === 'string' ? raw.roundId : `local-${Date.now()}`,
        win: Boolean(raw.win),
        multiplier: safeNumber(raw.multiplier, 0),
        payout: safeNumber(raw.payout, 0),
        newBalance: safeNumber(raw.newBalance, 0),
        reelSymbols: safeArray<string>(raw.reelSymbols).map((s) => safeString(s, '')),
        matchedSymbol: typeof raw.matchedSymbol === 'string' ? raw.matchedSymbol : null,
        reused: Boolean(raw.reused),
      };
      setLast(safe);
      ng.bumpNonce();
      ng.refreshBalance();
    } catch { setError('Could not reach server'); }
    finally { setLoading(false); }
  };

  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 1_000;

  return (
    <GameShell
      code="slots"
      titleEn="Pasha Slots"
      titleBn="পাশা স্লটস"
      taglineEn="Three reels, eight original symbols, instant payout."
      taglineBn="তিন রিল, আটটি মৌলিক চিহ্ন, সাথে সাথে পেআউট।"
      ctaLabelEn="Pull the Lever"
      ctaLabelBn="লিভার টানুন"
      accent="amber"
      ng={ng}
      rules={<SlotsRules lang={lang} paytable={cfg.paytable ?? {}} />}
    >
      <GamePanel className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_50%_30%,rgba(255,200,69,0.20),transparent_60%)]" />
        {/* Cabinet */}
        <div className="relative mx-auto max-w-md rounded-3xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-950 to-black p-5 shadow-[inset_0_2px_0_rgba(255,213,84,0.45),0_20px_60px_-20px_rgba(0,0,0,0.7)] md:p-7">
          {/* JACKPOT plate */}
          <div className="mx-auto inline-flex w-auto items-center justify-center rounded-full border border-amber-400/60 bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-1 text-xs font-extrabold tracking-[0.32em] text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            JACKPOT
          </div>

          <div className="mt-4 grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${reels}, minmax(0, 1fr))` }}>
            {Array.from({ length: reels }).map((_, i) => {
              const sym = last?.reelSymbols?.[i];
              return (
                <div key={i} className="relative aspect-square overflow-hidden rounded-2xl border border-amber-500/30 bg-black/70 shadow-inner">
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/40" />
                  <div
                    className={cn(
                      'absolute inset-0 grid place-items-center text-5xl font-extrabold md:text-6xl',
                      color(sym),
                      reelAnim && 'png-reel',
                    )}
                    style={reelAnim ? { animationDelay: `${i * 90}ms` } : undefined}
                  >
                    {glyph(sym)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payline */}
          <div className="relative mt-3 h-px overflow-hidden bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
          {/* Win banner */}
          {last?.win ? (
            <p className="png-fade-up mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400/20 px-3 py-2 text-sm font-extrabold uppercase tracking-wider text-amber-100">
              <Trophy className="h-4 w-4" />
              {lang === 'bn'
                ? `${last.matchedSymbol} . ${safeToFixed(last.multiplier, 4)}x . +${formatBDT(last.payout)}`
                : `${last.matchedSymbol} . ${safeToFixed(last.multiplier, 4)}x . +${formatBDT(last.payout)}`}
            </p>
          ) : last ? (
            <p className="mt-3 text-center text-xs uppercase tracking-wider text-white/55">{lang === 'bn' ? 'কোনো ম্যাচ নেই' : 'No match'}</p>
          ) : (
            <p className="mt-3 text-center text-xs uppercase tracking-wider text-white/35">{lang === 'bn' ? 'স্পিনের অপেক্ষায়' : 'Waiting for spin'}</p>
          )}
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </GamePanel>

      <BetCard
        bet={bet}
        setBet={setBet}
        minBet={minBet}
        maxBet={maxBet}
        balance={ng.balance}
        playLabel={lang === 'bn' ? 'স্পিন' : 'Spin'}
        onPlay={onSpin}
        loading={loading}
        disabled={!ng.session}
      />

      <DepositRequiredModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        balance={ng.balance}
        requiredAmount={safeNumber(bet, 0)}
      />
    </GameShell>
  );
}

function SlotsRules({ lang, paytable }: { lang: 'bn' | 'en'; paytable: Record<string, Record<string, number>> }) {
  const entries = Object.entries(paytable).map(([sym, m]) => ({ sym, mult: (m as Record<string, number>)['3'] })).filter((x) => x.mult);
  return (
    <div className="space-y-3">
      {lang === 'bn' ? (
        <ul className="list-disc space-y-2 pl-5">
          <li>৩টি রিল, ১টি পেলাইন (মাঝখানের সারি)।</li>
          <li>৩টি একই চিহ্ন পেলেই জয়। গুণিতক পেআউট টেবিল অনুযায়ী।</li>
          <li>সার্ভার HMAC-SHA256 দিয়ে রিল স্টপ ঠিক করে।</li>
        </ul>
      ) : (
        <ul className="list-disc space-y-2 pl-5">
          <li>3 reels, 1 payline (middle row).</li>
          <li>3 matching symbols win; multiplier per the paytable.</li>
          <li>The server picks the reel stops via HMAC-SHA256.</li>
        </ul>
      )}
      {entries.length > 0 ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-200">
            {lang === 'bn' ? 'পেআউট টেবিল (৩ অভিন্ন)' : 'Paytable (3 of a kind)'}
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {entries.map(({ sym, mult }) => (
              <li key={sym} className="flex items-center justify-between">
                <span className={cn('inline-flex items-center gap-1.5 font-semibold', color(sym))}>
                  <span className="text-lg">{glyph(sym)}</span>
                  <span className="text-white/75">{sym}</span>
                </span>
                <span className="font-mono text-white/85">{mult}x</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
