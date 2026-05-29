// Built by Anointed Coder.
//
// Pasha Keno - premium game page. Pick numbers; server draws 20 from
// the pool via /api/native-games/keno/bet; UI animates the draw
// reveal but the matched set is whatever the server returned.

'use client';

import { useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useNativeGame } from '@/lib/native-games/use-native-game';
import { GameShell, GamePanel, GamePanelTitle } from '@/components/native-games/GameShell';
import { BetCard } from '@/components/native-games/BetCard';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Shuffle, Trophy, X } from 'lucide-react';
import { safeArray, safeNumber, safeToFixed } from '@/lib/native-games/safe';

interface KenoResult {
  roundId: string;
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  draw: number[];
  matches: number[];
  matchCount: number;
  reused?: boolean;
}

// Multiplier preview - same numbers as the server paytable (see
// lib/native-games/engine/keno.ts) but UI-only. Server is authoritative.
const TOP_MULT: Record<number, number> = {
  1: 3.6, 2: 12, 3: 42, 4: 110, 5: 800, 6: 1600, 7: 7000, 8: 10000, 9: 10000, 10: 10000,
};

export default function KenoPage() {
  const { lang } = useLang();
  const ng = useNativeGame('keno');
  const game = ng.game;
  const cfg = (game?.config ?? {}) as { poolSize?: number; drawCount?: number; minPicks?: number; maxPicks?: number };
  const poolSize = Number(cfg.poolSize ?? 80);
  const drawCount = Number(cfg.drawCount ?? 20);
  const minPicks = Number(cfg.minPicks ?? 1);
  const maxPicks = Number(cfg.maxPicks ?? 10);

  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [bet, setBet] = useState<string>('10');
  const [last, setLast] = useState<KenoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);

  const playerPicks = useMemo(() => Array.from(picks).sort((a, b) => a - b), [picks]);
  const topMult = TOP_MULT[playerPicks.length] ?? 0;
  const betNumber = safeNumber(bet, 0);
  const projectedPayout = betNumber * topMult;

  const togglePick = (n: number) => {
    setLast(null); setError(null);
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) { next.delete(n); return next; }
      if (next.size >= maxPicks) return prev;
      next.add(n); return next;
    });
  };
  const clearPicks = () => { setPicks(new Set()); setLast(null); setError(null); };
  const quickPick = () => {
    setLast(null); setError(null);
    const n = Math.min(maxPicks, 5);
    const next = new Set<number>();
    while (next.size < n) next.add(Math.floor(Math.random() * poolSize) + 1);
    setPicks(next);
  };

  const onDraw = async () => {
    if (!ng.session) return;
    if (playerPicks.length < minPicks) {
      setError(lang === 'bn' ? `কমপক্ষে ${minPicks}টি নম্বর বাছাই করুন` : `Pick at least ${minPicks} number(s)`);
      return;
    }
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
      const res = await fetch('/api/native-games/keno/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: ng.session.id, picks: playerPicks, betAmount: amount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (isInsufficientFundsError(data)) {
          setDepositOpen(true);
          ng.refreshBalance();
          return;
        }
        setError(data?.message ?? data?.code ?? 'Draw failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const raw = (data ?? {}) as Partial<KenoResult>;
      const safe: KenoResult = {
        roundId: typeof raw.roundId === 'string' ? raw.roundId : `local-${Date.now()}`,
        win: Boolean(raw.win),
        multiplier: safeNumber(raw.multiplier, 0),
        payout: safeNumber(raw.payout, 0),
        newBalance: safeNumber(raw.newBalance, 0),
        draw: safeArray<number>(raw.draw),
        matches: safeArray<number>(raw.matches),
        matchCount: safeNumber(raw.matchCount, 0),
        reused: Boolean(raw.reused),
      };
      setLast(safe);
      setAnimKey((k) => k + 1);
      ng.bumpNonce();
      ng.refreshBalance();
    } catch { setError('Could not reach server'); }
    finally { setLoading(false); }
  };

  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 5_000;

  return (
    <GameShell
      code="keno"
      titleEn="Pasha Keno"
      titleBn="পাশা কেনো"
      taglineEn={`Pick numbers. The server draws ${drawCount}. Match to win the multiplier.`}
      taglineBn={`নম্বর বাছাই করুন। সার্ভার ${drawCount}টি ড্র করবে। মিল হলেই গুণিতক জিতবেন।`}
      ctaLabelEn="Pick Your Luck"
      ctaLabelBn="ভাগ্য বাছাই করুন"
      accent="emerald"
      ng={ng}
      rules={<KenoRules lang={lang} poolSize={poolSize} drawCount={drawCount} />}
    >
      {/* Pick summary + top multiplier */}
      <GamePanel>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label={lang === 'bn' ? 'বাছাই' : 'Picks'} value={`${playerPicks.length} / ${maxPicks}`} />
          <Stat label={lang === 'bn' ? 'সর্বোচ্চ গুণিতক' : 'Max multiplier'} value={topMult > 0 ? `${topMult}x` : '-'} accent />
          <Stat label={lang === 'bn' ? 'মিল' : 'Matches'} value={last ? String(last.matchCount) : '-'} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={quickPick} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10">
            <Shuffle className="h-3.5 w-3.5" />
            {lang === 'bn' ? 'কুইক পিক' : 'Quick pick'}
          </button>
          <button type="button" onClick={clearPicks} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10">
            <X className="h-3.5 w-3.5" />
            {lang === 'bn' ? 'ক্লিয়ার' : 'Clear'}
          </button>
        </div>
      </GamePanel>

      {/* Number grid */}
      <GamePanel>
        <GamePanelTitle hint={`1 - ${poolSize}`}>
          {lang === 'bn' ? 'নম্বর বাছাই' : 'Choose numbers'}
        </GamePanelTitle>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {Array.from({ length: poolSize }).map((_, i) => {
            const n = i + 1;
            const isPicked = picks.has(n);
            const drawn = last?.draw?.includes(n) ?? false;
            const match = last?.matches?.includes(n) ?? false;
            return (
              <button
                key={n}
                type="button"
                onClick={() => togglePick(n)}
                aria-pressed={isPicked}
                className={cn(
                  'aspect-square rounded-lg border text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60',
                  !isPicked && !drawn && 'border-white/10 bg-white/5 text-white/75 hover:border-emerald-300/40 hover:bg-emerald-300/10',
                  isPicked && !drawn && 'border-amber-400/60 bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] png-glow',
                  drawn && !match && 'border-sky-400/40 bg-sky-400/15 text-sky-100',
                  match && 'border-emerald-300 bg-gradient-to-b from-emerald-300 to-emerald-600 text-white png-win',
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </GamePanel>

      {/* Draw reveal */}
      {last ? (
        <GamePanel key={animKey} className={cn(last.win && 'png-win', !last.win && 'png-loss')}>
          <GamePanelTitle hint={lang === 'bn' ? `${drawCount}টি ড্র` : `${drawCount} drawn`}>
            {lang === 'bn' ? 'ড্রয়ের ফলাফল' : 'Drawn numbers'}
          </GamePanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {last.draw.map((n, i) => {
              const isMatch = last.matches.includes(n);
              return (
                <span
                  key={n}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold',
                    isMatch
                      ? 'bg-gradient-to-b from-amber-200 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                      : 'border border-white/15 bg-white/5 text-white/80',
                    'png-ball',
                  )}
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  {n}
                </span>
              );
            })}
          </div>
          <div className={cn('mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold uppercase tracking-wider',
            last.win ? 'bg-amber-400/20 text-amber-100' : 'bg-white/5 text-white/70')}>
            <Trophy className="h-4 w-4" />
            {last.win
              ? lang === 'bn' ? `${last.matchCount} মিল . ${safeToFixed(last.multiplier, 4)}x . +${formatBDT(last.payout)}` : `${last.matchCount} matches . ${safeToFixed(last.multiplier, 4)}x . +${formatBDT(last.payout)}`
              : lang === 'bn' ? `${last.matchCount} মিল . এই বার লাভ নেই` : `${last.matchCount} matches . no payout this round`}
          </div>
        </GamePanel>
      ) : null}

      {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

      <BetCard
        bet={bet}
        setBet={setBet}
        minBet={minBet}
        maxBet={maxBet}
        balance={ng.balance}
        playLabel={lang === 'bn' ? 'ড্র দেখুন' : 'Draw'}
        onPlay={onDraw}
        loading={loading}
        disabled={!ng.session || playerPicks.length < minPicks}
        hint={topMult > 0 ? `${lang === 'bn' ? 'সর্বোচ্চ' : 'Max'}: ${formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}` : undefined}
      />

      <DepositRequiredModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        balance={ng.balance}
        requiredAmount={betNumber}
      />
    </GameShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-black/30 p-3', accent ? 'border-amber-400/30 bg-amber-400/10' : 'border-white/10')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className={cn('mt-0.5 text-lg font-extrabold tabular-nums', accent ? 'text-amber-100' : 'text-white')}>{value}</p>
    </div>
  );
}

function KenoRules({ lang, poolSize, drawCount }: { lang: 'bn' | 'en'; poolSize: number; drawCount: number }) {
  if (lang === 'bn') {
    return (
      <ul className="list-disc space-y-2 pl-5">
        <li>১ থেকে {poolSize} এর মধ্যে ১ থেকে ১০টি নম্বর বাছাই করুন।</li>
        <li>সার্ভার HMAC-SHA256 দিয়ে {drawCount}টি নম্বর ড্র করে।</li>
        <li>আপনার বাছাই কতগুলো নম্বরের সাথে মিলেছে তার ভিত্তিতে পেআউট নির্ধারিত হয়।</li>
        <li>প্রতিটি রাউন্ড স্বাধীন এবং প্রভাবলি ফেয়ার।</li>
      </ul>
    );
  }
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>Pick 1 to 10 numbers from 1 to {poolSize}.</li>
      <li>The server HMAC-SHA256 draws {drawCount} numbers.</li>
      <li>Your payout is set by how many of your picks the draw matched.</li>
      <li>Every round is independent and provably fair.</li>
    </ul>
  );
}
