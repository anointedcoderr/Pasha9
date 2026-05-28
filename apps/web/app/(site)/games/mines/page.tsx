// Built by Anointed Coder.
//
// Pasha Mines play page. 5x5 grid by default. Player sets a bet and
// mine count, presses Start (debits the bet), then reveals tiles one
// at a time. Safe picks raise the cashout multiplier; a mine ends the
// round for a loss. Cashout any time after one safe pick to claim
// bet * currentMultiplier.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useLang } from '@/lib/i18n/context';
import { Bomb, Gem, ShieldCheck, RefreshCw, Sparkles, Wallet as WalletIcon, Play, ArrowDown, Trophy } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface GameConfig {
  gameCode: string;
  displayName: string;
  isActive: boolean;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  config: { gridSize?: number; minMines?: number; maxMines?: number } | null;
}

interface SessionView {
  id: string;
  gameCode: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  status: string;
  createdAt: string;
}

interface MeResponse {
  user?: { wallet?: { balance?: number | string } | null } | null;
}

interface MinesStartResult {
  roundId: string;
  outcome: 'PENDING';
  mineCount: number;
  totalTiles: number;
  revealedTiles: number[];
  currentMultiplier: number;
  newBalance: number;
  nonce: number;
}

interface MinesRevealResult {
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

interface MinesCashoutResult {
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

export default function MinesPage() {
  const { lang } = useLang();
  const [game, setGame] = useState<GameConfig | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [session, setSession] = useState<SessionView | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [bet, setBet] = useState<string>('10');
  const [mineCount, setMineCount] = useState<number>(3);
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [revealing, setRevealing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) return;
      const data = (await res.json()) as MeResponse;
      const v = data?.user?.wallet?.balance;
      if (v != null) setBalance(Number(v));
    } catch { /* ignore */ }
  }, []);

  const openSession = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/native-games/mines/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Could not open session');
        return;
      }
      setSession(data?.session ?? null);
    } catch {
      setError('Could not open session');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/native-games/mines', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (alive && data?.game) {
          setGame(data.game as GameConfig);
          setEnabled(Boolean(data.enabled));
          if (typeof data.game.minBet === 'number') setBet(String(Math.max(data.game.minBet, 10)));
          const max = Number(data.game?.config?.maxMines ?? 24);
          if (mineCount > max) setMineCount(Math.min(3, max));
        }
      } catch { /* leave defaults */ }
    })();
    refreshBalance();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshBalance]);

  useEffect(() => {
    if (!enabled || !game || !game.isActive || authError) return;
    if (session) return;
    openSession();
  }, [enabled, game, session, openSession, authError]);

  const totalTiles = round?.totalTiles ?? Number(game?.config?.gridSize ?? 25);
  const gridSide = Math.max(2, Math.round(Math.sqrt(totalTiles)));
  const minMines = Number(game?.config?.minMines ?? 1);
  const maxMines = Number(game?.config?.maxMines ?? 24);

  const onStart = async () => {
    if (!session) { await openSession(); return; }
    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(lang === 'bn' ? 'বেট পরিমাণ অবৈধ' : 'Bet amount is invalid');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/native-games/mines/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          mineCount,
          betAmount: amount,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Start failed');
        if (data?.code === 'SESSION_INACTIVE') setSession(null);
        return;
      }
      const result = data as MinesStartResult;
      setBalance(result.newBalance);
      setRound({
        kind: 'pending',
        roundId: result.roundId,
        mineCount: result.mineCount,
        totalTiles: result.totalTiles,
        revealed: result.revealedTiles,
        multiplier: result.currentMultiplier,
      });
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  };

  const onReveal = async (tile: number) => {
    if (!round || round.kind !== 'pending' || revealing != null) return;
    setError(null);
    setRevealing(tile);
    try {
      const res = await fetch('/api/native-games/mines/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reveal', roundId: round.roundId, tile }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Reveal failed');
        return;
      }
      const r = data as MinesRevealResult;
      setBalance(r.newBalance);
      if (r.hitMine) {
        setRound({
          kind: 'loss',
          roundId: round.roundId,
          mineCount: round.mineCount,
          totalTiles: round.totalTiles,
          revealed: r.revealedTiles,
          minePositions: r.minePositions ?? [],
          hitTile: r.tile,
          bet: Number(bet),
        });
        // Mines round terminated -> session nonce was advanced server-side.
        setSession((prev) => (prev ? { ...prev, nonce: prev.nonce + 1 } : prev));
        return;
      }
      setRound({
        kind: 'pending',
        roundId: round.roundId,
        mineCount: round.mineCount,
        totalTiles: round.totalTiles,
        revealed: r.revealedTiles,
        multiplier: r.currentMultiplier,
      });
    } catch {
      setError('Could not reach server');
    } finally {
      setRevealing(null);
    }
  };

  const onCashout = async () => {
    if (!round || round.kind !== 'pending') return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/native-games/mines/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cashout', roundId: round.roundId }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Cashout failed');
        return;
      }
      const r = data as MinesCashoutResult;
      setBalance(r.newBalance);
      setRound({
        kind: 'cashout',
        roundId: round.roundId,
        mineCount: round.mineCount,
        totalTiles: round.totalTiles,
        revealed: r.revealedTiles,
        minePositions: r.minePositions,
        payout: r.payout,
        multiplier: r.multiplier,
        bet: Number(bet),
      });
      setSession((prev) => (prev ? { ...prev, nonce: prev.nonce + 1 } : prev));
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  };

  const onNewRound = () => { setRound(null); setError(null); };

  const onCloseSession = async () => {
    if (!session) return;
    setError(null);
    try {
      const res = await fetch(`/api/native-games/sessions/${session.id}/verify`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? data?.code ?? 'Could not close session');
        return;
      }
      window.location.href = `/api/native-games/sessions/${session.id}/verify`;
    } catch {
      setError('Could not reach server');
    }
  };

  const isPending = round?.kind === 'pending';

  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'পাশা মাইনস' : 'Pasha Mines'} />

      <CategoryHero
        kicker={lang === 'bn' ? 'পাশা নেটিভ গেমস' : 'Pasha Native Games'}
        title={lang === 'bn' ? 'পাশা মাইনস' : 'Pasha Mines'}
        description={
          lang === 'bn'
            ? 'বেট দিন, মাইনের সংখ্যা বাছাই করুন, এক এক করে টাইল উন্মোচন করুন। সঠিক টাইলে গুণিতক বাড়ে - যেকোনো সময় ক্যাশআউট করুন।'
            : 'Set a bet and mine count, reveal tiles one at a time. Every safe tile raises the multiplier - cash out whenever.'
        }
        accent="red"
      />

      {!enabled || !game?.isActive ? (
        <section className="card-light p-5">
          <p className="text-sm text-brand-inkSoft">
            {lang === 'bn'
              ? 'এই গেমটি বর্তমানে সাময়িকভাবে অনুপলব্ধ।'
              : 'This game is temporarily unavailable.'}
          </p>
        </section>
      ) : null}

      {authError ? (
        <section className="card-light p-5">
          <p className="text-sm text-brand-inkSoft">{lang === 'bn' ? 'খেলতে লগইন করুন।' : 'Log in to play.'}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-sm">
              {lang === 'bn' ? 'লগইন' : 'Log in'}
            </Link>
            <Link href="/?signup=1" className="inline-flex h-10 items-center rounded-lg border border-brand-divider bg-brand-surface px-4 text-sm font-semibold text-brand-ink hover:bg-brand-paper">
              {lang === 'bn' ? 'রেজিস্টার' : 'Register'}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="card-light grid gap-3 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'মেইন ব্যালেন্স' : 'Main balance'}</p>
              <p className="mt-1 inline-flex items-baseline gap-1 text-2xl font-extrabold text-brand-ink">
                <WalletIcon className="h-4 w-4 text-brand-yellow-600" />
                {balance != null ? formatBDT(balance) : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'গুণিতক' : 'Multiplier'}</p>
              <p className="mt-1 text-2xl font-extrabold text-brand-ink">{round?.kind === 'pending' ? `${round.multiplier.toFixed(4)}x` : round?.kind === 'cashout' ? `${round.multiplier.toFixed(4)}x` : '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'}</p>
              <p className="mt-1 text-2xl font-extrabold text-brand-yellow-700">
                {round?.kind === 'pending' ? formatBDT(Number(bet) * round.multiplier) : round?.kind === 'cashout' ? formatBDT(round.payout) : '-'}
              </p>
            </div>
          </section>

          <section className="card-light p-5 md:p-6">
            <div className="grid gap-5 md:grid-cols-[1fr_1.2fr] md:items-start">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট পরিমাণ' : 'Bet amount'}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={game?.minBet ?? 10}
                  max={game?.maxBet ?? 10_000}
                  step="1"
                  value={bet}
                  onChange={(e) => setBet(e.target.value)}
                  disabled={isPending}
                  className="mt-1 h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none disabled:opacity-60"
                />
                <p className="mt-1 text-[11px] text-brand-inkMute">{game ? `${formatBDT(game.minBet)} - ${formatBDT(game.maxBet)} BDT` : ''}</p>

                <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'মাইন সংখ্যা' : 'Mines'}: {mineCount}</label>
                <input
                  type="range"
                  min={minMines}
                  max={maxMines}
                  step={1}
                  value={mineCount}
                  onChange={(e) => setMineCount(Number(e.target.value))}
                  disabled={isPending}
                  className="mt-2 w-full accent-brand-yellow-500"
                />
                <div className="mt-1 flex justify-between text-[10px] text-brand-inkMute">
                  <span>{minMines}</span>
                  <span>{Math.round((minMines + maxMines) / 2)}</span>
                  <span>{maxMines}</span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={onStart}
                    disabled={loading || isPending || !session}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-yellow-500 text-base font-extrabold uppercase tracking-wider text-brand-ink hover:brightness-105 disabled:opacity-60"
                  >
                    <Play className="h-5 w-5" />
                    {lang === 'bn' ? 'শুরু' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={onCashout}
                    disabled={!isPending || loading || (round?.kind === 'pending' && round.revealed.length === 0)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-signal-ok/40 bg-signal-ok/10 text-base font-extrabold uppercase tracking-wider text-signal-ok hover:bg-signal-ok/20 disabled:opacity-60"
                  >
                    <ArrowDown className="h-5 w-5" />
                    {lang === 'bn' ? 'ক্যাশআউট' : 'Cashout'}
                  </button>
                </div>

                {error ? <p className="mt-3 text-sm text-signal-danger">{error}</p> : null}
                {round?.kind === 'cashout' ? (
                  <div className="mt-3 rounded-lg border border-signal-ok/30 bg-signal-ok/10 p-3 text-sm text-signal-ok">
                    <p className="font-bold uppercase tracking-wider">
                      <Trophy className="mr-1 inline h-4 w-4" />
                      {lang === 'bn' ? 'ক্যাশআউট' : 'Cashed out'} {round.multiplier.toFixed(4)}x = {formatBDT(round.payout)}
                    </p>
                    <button type="button" onClick={onNewRound} className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg bg-brand-surface px-3 text-xs font-semibold text-brand-ink">
                      <RefreshCw className="h-3 w-3" />
                      {lang === 'bn' ? 'নতুন রাউন্ড' : 'New round'}
                    </button>
                  </div>
                ) : null}
                {round?.kind === 'loss' ? (
                  <div className="mt-3 rounded-lg border border-signal-danger/30 bg-signal-danger/10 p-3 text-sm text-signal-danger">
                    <p className="font-bold uppercase tracking-wider">
                      <Bomb className="mr-1 inline h-4 w-4" />
                      {lang === 'bn' ? 'মাইনে লেগেছে - হার' : 'Hit a mine - lost'} {formatBDT(round.bet)}
                    </p>
                    <button type="button" onClick={onNewRound} className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg bg-brand-surface px-3 text-xs font-semibold text-brand-ink">
                      <RefreshCw className="h-3 w-3" />
                      {lang === 'bn' ? 'নতুন রাউন্ড' : 'New round'}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-brand-divider bg-brand-surface p-3">
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${gridSide}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: totalTiles }).map((_, idx) => {
                    const isRevealed = round && round.kind !== 'pending'
                      ? round.revealed.includes(idx) || (round.kind === 'loss' && round.minePositions.includes(idx)) || (round.kind === 'cashout' && round.minePositions.includes(idx))
                      : round?.kind === 'pending' && round.revealed.includes(idx);
                    const isMine = (round?.kind === 'loss' || round?.kind === 'cashout') && round.minePositions.includes(idx);
                    const isHitMine = round?.kind === 'loss' && round.hitTile === idx;
                    const isSafe = isRevealed && !isMine;
                    const disabled = !isPending || revealing != null || (round?.kind === 'pending' && round.revealed.includes(idx));
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onReveal(idx)}
                        disabled={disabled}
                        className={cn(
                          'aspect-square rounded-lg border text-base font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-500/40',
                          // base state
                          !isRevealed && 'border-brand-divider bg-brand-paper text-brand-inkMute hover:border-brand-yellow-500/50 hover:bg-brand-yellow-500/10',
                          // safe revealed
                          isSafe && 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
                          // mine (post-settlement)
                          isMine && !isHitMine && 'border-signal-danger/30 bg-signal-danger/10 text-signal-danger',
                          isHitMine && 'border-signal-danger/60 bg-signal-danger/30 text-white',
                          revealing === idx && 'opacity-70',
                          disabled && !isRevealed && 'opacity-60',
                        )}
                      >
                        {isMine ? <Bomb className="mx-auto h-4 w-4" /> : isSafe ? <Gem className="mx-auto h-4 w-4" /> : ''}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-brand-inkMute">
                  {isPending
                    ? lang === 'bn'
                      ? 'টাইল আনলক করুন। মাইনে লাগলে হার, না লাগলে গুণিতক বাড়ে।'
                      : 'Tap a tile. A mine ends the round; a gem raises the multiplier.'
                    : lang === 'bn'
                      ? 'শুরু করতে বেট দিন।'
                      : 'Place a bet and press Start to begin.'}
                </p>
              </div>
            </div>
          </section>

          {/* Fairness panel */}
          <section className="card-light p-5 md:p-6">
            <div className="flex items-center gap-2 text-brand-ink">
              <ShieldCheck className="h-4 w-4 text-brand-yellow-600" />
              <h3 className="text-base font-extrabold">{lang === 'bn' ? 'প্রভাবলি ফেয়ার প্যানেল' : 'Provably fair'}</h3>
            </div>
            {session ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Detail label={lang === 'bn' ? 'সার্ভার সিড হ্যাশ' : 'Server seed hash'} value={session.serverSeedHash} mono />
                <Detail label={lang === 'bn' ? 'ক্লায়েন্ট সিড' : 'Client seed'} value={session.clientSeed} mono />
                <Detail label={lang === 'bn' ? 'বর্তমান ননস' : 'Current nonce'} value={String(session.nonce)} />
                <Detail label={lang === 'bn' ? 'সেশন স্ট্যাটাস' : 'Session status'} value={session.status} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-brand-inkMute">{lang === 'bn' ? 'সেশন তৈরি হচ্ছে...' : 'Opening session...'}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onCloseSession} disabled={!session || isPending} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-ink hover:bg-brand-paper disabled:opacity-60">
                <RefreshCw className="h-3.5 w-3.5" />
                {lang === 'bn' ? 'সেশন বন্ধ + যাচাই' : 'Close + verify session'}
              </button>
              <button type="button" onClick={() => { if (!isPending) { setSession(null); openSession(); } }} disabled={isPending} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-paper disabled:opacity-60">
                <Sparkles className="h-3.5 w-3.5" />
                {lang === 'bn' ? 'নতুন সেশন' : 'New session'}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-brand-inkMute">
              {lang === 'bn'
                ? 'একটি রাউন্ড চলমান থাকা অবস্থায় সেশন বন্ধ করা যাবে না - প্রথমে ক্যাশআউট অথবা শেষ পর্যন্ত খেলুন।'
                : 'You cannot close the session mid-round - cash out or play it out first.'}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-brand-divider bg-brand-surface p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{label}</p>
      <p className={cn('mt-1 break-all text-sm text-brand-ink', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
