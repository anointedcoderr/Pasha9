// Built by Anointed Coder.
//
// Pasha Mines - premium 5x5 game page. Three calls power the round:
//   POST /api/native-games/mines/bet           start round (debit bet)
//   POST /api/native-games/mines/action reveal flip a tile
//   POST /api/native-games/mines/action cashout claim payout
// UI handles the tile flip/glow + grid layout; the result + mine
// positions always come from the server.

'use client';

import { useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useNativeGame } from '@/lib/native-games/use-native-game';
import { GameShell, GamePanel, GamePanelTitle } from '@/components/native-games/GameShell';
import { BetCard } from '@/components/native-games/BetCard';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Bomb, Gem, Trophy, RefreshCw } from 'lucide-react';

interface MinesStart {
  roundId: string;
  outcome: 'PENDING';
  mineCount: number;
  totalTiles: number;
  revealedTiles: number[];
  currentMultiplier: number;
  newBalance: number;
  nonce: number;
}
interface MinesReveal {
  roundId: string;
  outcome: 'PENDING' | 'LOSS';
  tile: number;
  hitMine: boolean;
  revealedTiles: number[];
  safeCount: number;
  currentMultiplier: number;
  newBalance: number;
  minePositions?: number[];
}
interface MinesCashout {
  roundId: string;
  outcome: 'CASHOUT';
  payout: number;
  multiplier: number;
  newBalance: number;
  minePositions: number[];
  revealedTiles: number[];
}

type Round =
  | { kind: 'pending'; roundId: string; mineCount: number; totalTiles: number; revealed: number[]; multiplier: number }
  | { kind: 'loss'; roundId: string; mineCount: number; totalTiles: number; revealed: number[]; minePositions: number[]; hitTile: number; bet: number }
  | { kind: 'cashout'; roundId: string; mineCount: number; totalTiles: number; revealed: number[]; minePositions: number[]; payout: number; multiplier: number; bet: number };

const MINE_PRESETS = [1, 3, 5, 10, 15, 20, 24];

export default function MinesPage() {
  const { lang } = useLang();
  const ng = useNativeGame('mines');
  const game = ng.game;
  const cfg = (game?.config ?? {}) as { gridSize?: number; minMines?: number; maxMines?: number };
  const fallbackTotal = Number(cfg.gridSize ?? 25);
  const minMines = Number(cfg.minMines ?? 1);
  const maxMines = Number(cfg.maxMines ?? 24);

  const [bet, setBet] = useState<string>('10');
  const [mineCount, setMineCount] = useState<number>(3);
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealing, setRevealing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalTiles = round?.totalTiles ?? fallbackTotal;
  const gridSide = Math.max(2, Math.round(Math.sqrt(totalTiles)));
  const isPending = round?.kind === 'pending';

  const onStart = async () => {
    if (!ng.session) return;
    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(lang === 'bn' ? 'বেট পরিমাণ অবৈধ' : 'Bet amount is invalid');
      return;
    }
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/native-games/mines/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: ng.session.id, mineCount, betAmount: amount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Start failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const r = data as MinesStart;
      setRound({ kind: 'pending', roundId: r.roundId, mineCount: r.mineCount, totalTiles: r.totalTiles, revealed: r.revealedTiles, multiplier: r.currentMultiplier });
      ng.refreshBalance();
    } catch { setError('Could not reach server'); }
    finally { setLoading(false); }
  };

  const onReveal = async (tile: number) => {
    if (!round || round.kind !== 'pending' || revealing != null) return;
    setError(null); setRevealing(tile);
    try {
      const res = await fetch('/api/native-games/mines/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reveal', roundId: round.roundId, tile }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.message ?? data?.code ?? 'Reveal failed'); return; }
      const r = data as MinesReveal;
      if (r.hitMine) {
        setRound({ kind: 'loss', roundId: round.roundId, mineCount: round.mineCount, totalTiles: round.totalTiles, revealed: r.revealedTiles, minePositions: r.minePositions ?? [], hitTile: r.tile, bet: Number(bet) });
        ng.bumpNonce();
      } else {
        setRound({ kind: 'pending', roundId: round.roundId, mineCount: round.mineCount, totalTiles: round.totalTiles, revealed: r.revealedTiles, multiplier: r.currentMultiplier });
      }
      ng.refreshBalance();
    } catch { setError('Could not reach server'); }
    finally { setRevealing(null); }
  };

  const onCashout = async () => {
    if (!round || round.kind !== 'pending') return;
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/native-games/mines/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cashout', roundId: round.roundId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.message ?? data?.code ?? 'Cashout failed'); return; }
      const r = data as MinesCashout;
      setRound({ kind: 'cashout', roundId: round.roundId, mineCount: round.mineCount, totalTiles: round.totalTiles, revealed: r.revealedTiles, minePositions: r.minePositions, payout: r.payout, multiplier: r.multiplier, bet: Number(bet) });
      ng.bumpNonce();
      ng.refreshBalance();
    } catch { setError('Could not reach server'); }
    finally { setLoading(false); }
  };

  const onNewRound = () => { setRound(null); setError(null); };

  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 10_000;
  const currentMultiplier = round?.kind === 'pending' ? round.multiplier : round?.kind === 'cashout' ? round.multiplier : 0;
  const potential = Number(bet) * (currentMultiplier || 1);

  return (
    <GameShell
      code="mines"
      titleEn="Pasha Mines"
      titleBn="পাশা মাইনস"
      taglineEn="Reveal safe tiles, cash out before the mine."
      taglineBn="নিরাপদ টাইল উন্মোচন করুন, মাইনের আগে ক্যাশআউট করুন।"
      accent="red"
      ng={ng}
      rules={<MinesRules lang={lang} />}
    >
      {/* Multiplier strip */}
      <GamePanel>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label={lang === 'bn' ? 'গুণিতক' : 'Multiplier'} value={round?.kind !== null && currentMultiplier > 0 ? `${currentMultiplier.toFixed(4)}x` : '-'} />
          <Stat label={lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'} value={round?.kind === 'cashout' ? formatBDT(round.payout) : isPending ? formatBDT(potential) : '-'} accent />
          <Stat label={lang === 'bn' ? 'মাইন' : 'Mines'} value={String(round?.mineCount ?? mineCount)} />
        </div>
      </GamePanel>

      {/* Mine count picker */}
      <GamePanel>
        <GamePanelTitle hint={`${minMines} - ${maxMines}`}>
          {lang === 'bn' ? 'মাইন সংখ্যা' : 'Mine count'}
        </GamePanelTitle>
        <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
          {MINE_PRESETS.filter((m) => m >= minMines && m <= maxMines).map((m) => (
            <button
              key={m}
              type="button"
              disabled={isPending}
              onClick={() => setMineCount(m)}
              className={cn(
                'min-w-[44px] rounded-lg border px-3 py-2 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60',
                m === mineCount
                  ? 'border-rose-300 bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_18px_-6px_rgba(244,63,94,0.6)]'
                  : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10',
                isPending && 'opacity-50 cursor-not-allowed',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </GamePanel>

      {/* Grid */}
      <GamePanel>
        <div
          className="mx-auto grid w-full max-w-md gap-2 sm:gap-2.5"
          style={{ gridTemplateColumns: `repeat(${gridSide}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalTiles }).map((_, idx) => {
            const isMine = (round?.kind === 'loss' || round?.kind === 'cashout') && round.minePositions.includes(idx);
            const isHit = round?.kind === 'loss' && round.hitTile === idx;
            const isSafeRevealed = round?.kind === 'pending'
              ? round.revealed.includes(idx)
              : (round?.kind === 'loss' || round?.kind === 'cashout') ? round.revealed.includes(idx) : false;
            const disabled = !isPending || revealing != null || (round?.kind === 'pending' && round.revealed.includes(idx));
            const stateClass = isHit
              ? 'border-rose-500/80 bg-gradient-to-b from-rose-500 to-rose-700 text-white'
              : isMine
                ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                : isSafeRevealed
                  ? 'border-emerald-400/50 bg-gradient-to-b from-emerald-400/30 to-emerald-700/40 text-emerald-100 png-tile-flip'
                  : 'border-white/15 bg-white/5 text-white/70 hover:border-amber-300/40 hover:bg-amber-300/10';
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onReveal(idx)}
                disabled={disabled}
                aria-label={`Tile ${idx + 1}`}
                className={cn(
                  'aspect-square rounded-xl border text-base font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 active:translate-y-px',
                  stateClass,
                  revealing === idx && 'opacity-70',
                  disabled && !isMine && !isSafeRevealed && 'opacity-60',
                )}
              >
                {isMine ? <Bomb className="mx-auto h-5 w-5" /> : isSafeRevealed ? <Gem className="mx-auto h-5 w-5" /> : ''}
              </button>
            );
          })}
        </div>

        {round?.kind === 'cashout' ? (
          <div className="png-fade-up mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-emerald-100">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
              <Trophy className="h-4 w-4" />
              {lang === 'bn'
                ? `ক্যাশআউট ${round.multiplier.toFixed(4)}x = ${formatBDT(round.payout)}`
                : `Cashed out ${round.multiplier.toFixed(4)}x = ${formatBDT(round.payout)}`}
            </p>
            <button type="button" onClick={onNewRound} className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15">
              <RefreshCw className="h-3 w-3" />
              {lang === 'bn' ? 'নতুন রাউন্ড' : 'New round'}
            </button>
          </div>
        ) : null}
        {round?.kind === 'loss' ? (
          <div className="png-fade-up mt-4 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-rose-100">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
              <Bomb className="h-4 w-4" />
              {lang === 'bn' ? `মাইনে লেগেছে - হার ${formatBDT(round.bet)}` : `Hit a mine - lost ${formatBDT(round.bet)}`}
            </p>
            <button type="button" onClick={onNewRound} className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15">
              <RefreshCw className="h-3 w-3" />
              {lang === 'bn' ? 'নতুন রাউন্ড' : 'New round'}
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </GamePanel>

      {/* Bet card with Start / Cashout */}
      <BetCard
        bet={bet}
        setBet={setBet}
        minBet={minBet}
        maxBet={maxBet}
        balance={ng.balance}
        playLabel={lang === 'bn' ? 'শুরু' : 'Start'}
        onPlay={onStart}
        loading={loading}
        disabled={isPending || !ng.session}
        hint={isPending ? (lang === 'bn' ? `ম্যাচ চলছে . ${formatBDT(potential)}` : `Round live . ${formatBDT(potential)}`) : undefined}
        secondary={isPending ? {
          label: lang === 'bn' ? `ক্যাশআউট ${formatBDT(potential)}` : `Cashout ${formatBDT(potential)}`,
          onClick: onCashout,
          disabled: !(round?.kind === 'pending' && round.revealed.length > 0),
          loading,
        } : undefined}
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

function MinesRules({ lang }: { lang: 'bn' | 'en' }) {
  if (lang === 'bn') {
    return (
      <ul className="list-disc space-y-2 pl-5">
        <li>৫x৫ গ্রিডে আপনি মাইন সংখ্যা বেছে নিন (১-২৪)।</li>
        <li>সার্ভার HMAC-SHA256 দিয়ে মাইন বসায়; মাইনের অবস্থান শুধু রাউন্ড শেষে দেখানো হয়।</li>
        <li>প্রতিটি নিরাপদ টাইলে গুণিতক বাড়ে। যেকোনো সময় ক্যাশআউট করতে পারেন।</li>
        <li>মাইনে লাগলে রাউন্ড শেষ; পুরো গ্রিড দেখানো হবে।</li>
      </ul>
    );
  }
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>Pick how many mines (1-24) to place on the 5x5 grid.</li>
      <li>The server places mines via HMAC-SHA256. Positions stay hidden until the round ends.</li>
      <li>Each safe pick lifts the multiplier. Cash out at any point to bank.</li>
      <li>Hit a mine and the round ends with the full grid revealed.</li>
    </ul>
  );
}
