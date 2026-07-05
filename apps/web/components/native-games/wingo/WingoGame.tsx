// Built by Anointed Coder.
//
// Pasha WinGo play surface. Orchestrates the four-mode tab switcher, the
// live round card (recent-result mini balls, period number, digital
// countdown with the last-10-seconds full-screen takeover), the betting
// board, the colour-tinted bet sheet, the suspense result reveal, the
// win celebration and the history tabs.
//
// Money is never trusted to the client: the board disables on the
// server-reported lock, and every placement is re-checked server-side.
// The client only mirrors state and shows outcomes the server settled.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Wallet as WalletIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { WINGO_MODE_LIST, WINGO_MODES, type WingoMode } from '@/lib/wingo/config';
import { useWingoState } from './useWingoState';
import { WingoBoard } from './WingoBoard';
import { WingoBall } from './WingoBall';
import { WingoTimer, WingoTakeover } from './WingoCountdown';
import { WingoBetSheet, type WingoSelection } from './WingoBetSheet';
import { WingoResultReveal } from './WingoResultReveal';
import { WingoWinCelebration, type WingoWin } from './WingoWinCelebration';
import { WingoHistory } from './WingoHistory';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';

// The player's bet row shape used by My history. Mirrors the
// /api/games/wingo/my-bets response.
export interface WingoMyBet {
  id: string;
  roundId: string;
  mode: string;
  periodNumber: string;
  betType: string;
  selection: string;
  stake: number;
  quantity: number;
  betAmount: number;
  status: string; // PENDING | WON | LOST | REFUNDED
  payoutMultiplier: number;
  payoutAmount: number;
  createdAt: string;
}

const SHORT_LABEL: Record<WingoMode, string> = {
  wingo_30s: '30s',
  wingo_1m: '1m',
  wingo_3m: '3m',
  wingo_5m: '5m',
};

export function WingoGame() {
  const { lang } = useLang();
  const bn = lang === 'bn';

  const [mode, setMode] = useState<WingoMode>('wingo_30s');
  const st = useWingoState(mode, true);

  // Wallet + auth.
  const [balance, setBalance] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.status === 401) {
        setSignedIn(false);
        return;
      }
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const v = data?.user?.wallet?.balance;
      if (v != null) setBalance(Number(v));
      setSignedIn(true);
    } catch {
      /* keep stale */
    }
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // My history.
  const [myBets, setMyBets] = useState<WingoMyBet[]>([]);
  const [myBetsLoading, setMyBetsLoading] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  const loadMyBets = useCallback(
    async (opts: { before?: string; replace?: boolean } = {}) => {
      if (signedIn === false) return;
      setMyBetsLoading(true);
      try {
        const params = new URLSearchParams({ limit: '20' });
        if (opts.before) params.set('before', opts.before);
        const res = await fetch(`/api/games/wingo/my-bets?${params.toString()}`, { cache: 'no-store' });
        if (res.status === 401) {
          setSignedIn(false);
          return;
        }
        const data = await res.json().catch(() => null);
        if (!data?.bets) return;
        const rows = data.bets as WingoMyBet[];
        setMyBets((prev) => (opts.replace || !opts.before ? rows : [...prev, ...rows]));
        setNextBefore(data.nextBefore ?? null);
      } catch {
        /* ignore */
      } finally {
        setMyBetsLoading(false);
      }
    },
    [signedIn],
  );

  useEffect(() => {
    if (signedIn) loadMyBets({ replace: true });
  }, [signedIn, loadMyBets]);

  // Bet sheet.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selection, setSelection] = useState<WingoSelection | null>(null);
  const [sheetQty, setSheetQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);

  const [loginPrompt, setLoginPrompt] = useState(false);

  // Stable idempotency key for the open bet slip. Minted once when the
  // slip opens and reused on every retry of the SAME slip, so a double
  // submit (double tap, network retry, React re-invoke) is deduped by the
  // server's unique WingoBet.idempotencyKey instead of double-debiting. A
  // fresh slip mints a fresh key.
  const betKeyRef = useRef<string | null>(null);
  const mintBetKey = useCallback((): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const onPick = useCallback(
    (sel: WingoSelection, qty: number) => {
      if (signedIn === false) {
        setLoginPrompt(true);
        return;
      }
      setSelection(sel);
      setSheetQty(qty);
      setBetError(null);
      betKeyRef.current = mintBetKey();
      setSheetOpen(true);
    },
    [signedIn, mintBetKey],
  );

  // Result reveal + win celebration.
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealResult, setRevealResult] = useState<{ result: number; periodNumber: string } | null>(null);
  const [winCeleb, setWinCeleb] = useState<WingoWin | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const lastResultRef = useRef<string | null>(null);
  const pendingWinRef = useRef<WingoWin | null>(null);

  // Switching modes must not replay the new mode's existing history as a
  // fresh draw. Re-seed the result tracker and clear any pending reveal
  // so the first payload of the new mode is treated as the baseline.
  useEffect(() => {
    lastResultRef.current = null;
    pendingWinRef.current = null;
    setRevealOpen(false);
    setRevealResult(null);
    setWinOpen(false);
    setSheetOpen(false);
  }, [mode]);

  // Detect a newly drawn result. On the very first payload we only seed
  // the ref so old history does not replay. The full-screen suspense
  // reveal is a BLOCKING modal, so it only fires for a viewer who actually
  // had a bet on the just-settled period; an idle spectator sees only the
  // non-blocking result update in the recent-results strip and history.
  useEffect(() => {
    const top = st.data?.results?.[0];
    if (!top) return;
    if (lastResultRef.current === null) {
      lastResultRef.current = top.periodNumber;
      return;
    }
    if (lastResultRef.current === top.periodNumber) return;
    lastResultRef.current = top.periodNumber;

    // Did THIS viewer have a bet on the period that just settled? myBets
    // still holds the pre-settlement (PENDING) line placed during the
    // round, so participation is detected before the refetch below.
    const hadBet = signedIn === true && myBets.some((b) => b.periodNumber === top.periodNumber);
    if (!hadBet) return; // spectator: no blocking modal, strip updates on its own

    setRevealResult({ result: top.result, periodNumber: top.periodNumber });
    setRevealOpen(true);
    // Settlement is lazy on the state read, so the player's bets for this
    // period are already settled. Refetch and total any win.
    void (async () => {
      try {
        const res = await fetch('/api/games/wingo/my-bets?limit=20', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        const rows = (data?.bets ?? []) as WingoMyBet[];
        setMyBets(rows);
        setNextBefore(data?.nextBefore ?? null);
        const wins = rows.filter((b) => b.periodNumber === top.periodNumber && b.status === 'WON');
        const amount = wins.reduce((s, b) => s + Number(b.payoutAmount), 0);
        if (amount > 0) pendingWinRef.current = { periodNumber: top.periodNumber, amount, lineCount: wins.length };
        refreshBalance();
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('pasha9:wallet-refresh'));
      } catch {
        /* ignore */
      }
    })();
  }, [st.data, signedIn, refreshBalance, myBets]);

  const onRevealClose = useCallback(() => {
    setRevealOpen(false);
    if (pendingWinRef.current) {
      setWinCeleb(pendingWinRef.current);
      setWinOpen(true);
      pendingWinRef.current = null;
    }
  }, []);

  // Place bet.
  const confirmBet = useCallback(
    async (stake: number, quantity: number) => {
      if (!selection || !st.data?.round) return;
      // Client mirror of the lock; the server re-checks regardless.
      if (st.phase !== 'open') {
        setBetError(bn ? 'বাজি বন্ধ হয়ে গেছে।' : 'Betting has closed.');
        return;
      }
      const total = stake * quantity;
      if (balance != null && total > balance) {
        setDepositAmount(total);
        setDepositOpen(true);
        return;
      }
      setSubmitting(true);
      setBetError(null);
      // Reuse the slip's stable key on every retry so the server dedupes a
      // duplicate submit rather than debiting twice. Mint one lazily if the
      // slip was somehow opened without going through onPick.
      if (!betKeyRef.current) betKeyRef.current = mintBetKey();
      const idempotencyKey = betKeyRef.current;
      try {
        const res = await fetch('/api/games/wingo/bet', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode,
            betType: selection.betType,
            selection: selection.selection,
            stake,
            quantity,
            idempotencyKey,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (isInsufficientFundsError(data)) {
            setDepositAmount(total);
            setDepositOpen(true);
            setSheetOpen(false);
            refreshBalance();
            return;
          }
          setBetError((bn ? data?.messageBn : data?.message) ?? data?.message ?? (bn ? 'বাজি ব্যর্থ।' : 'Bet failed.'));
          return;
        }
        // Committed (or safely deduped): retire this key so the next slip
        // mints a fresh one.
        betKeyRef.current = null;
        if (typeof data?.balance === 'number') setBalance(Number(data.balance));
        setSheetOpen(false);
        loadMyBets({ replace: true });
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('pasha9:wallet-refresh'));
      } catch {
        setBetError(bn ? 'সার্ভারে পৌঁছানো যায়নি।' : 'Could not reach the server.');
      } finally {
        setSubmitting(false);
      }
    },
    [selection, st.data, st.phase, balance, mode, bn, refreshBalance, loadMyBets, mintBetKey],
  );

  const round = st.data?.round;
  const locked = st.phase === 'locked' || st.phase === 'drawing';
  const gameEnabled = st.data?.enabled ?? true;
  const modeEnabled = st.data?.modeEnabled ?? true;
  // The full-screen takeover blankets the board, so it may only appear once
  // betting is actually closed on the server (now >= betCloseAt, i.e. phase
  // locked or drawing). During the still-open final seconds the board stays
  // reachable and honestly labelled "Bet closes in / Open"; the takeover
  // then reads as LOCKED exactly when the server locks.
  const showTakeover = Boolean(round) && (st.phase === 'locked' || st.phase === 'drawing');

  // ---------- Disabled state ----------
  if (st.data && (!gameEnabled || !modeEnabled)) {
    return (
      <Frame>
        <WingoTopBar balance={balance} signedIn={signedIn === true} />
        <ModeTabs mode={mode} onSelect={setMode} />
        <div className="grid place-items-center rounded-2xl border border-white/10 bg-black/30 px-6 py-16 text-center">
          <WingoBall n={5} size={72} asBadge />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
            {bn ? 'শীঘ্রই আসছে' : 'Coming soon'}
          </p>
          <p className="mt-2 max-w-sm text-sm text-white/80">
            {!gameEnabled
              ? bn
                ? 'উইনগো এখন সাময়িকভাবে বন্ধ। অ্যাডমিন চালু করলে খেলা যাবে।'
                : 'WinGo is temporarily switched off. It opens once an admin enables it.'
              : bn
                ? 'এই মোডটি এখন বন্ধ। অন্য একটি মোড বেছে নিন।'
                : 'This mode is switched off. Try another mode.'}
          </p>
          <Link
            href="/games"
            className="mt-5 inline-flex h-10 items-center rounded-lg border border-white/25 bg-white/5 px-5 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10"
          >
            {bn ? 'গেমে ফিরুন' : 'Back to games'}
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      {/* Screen-reader phase announcement. */}
      <div aria-live="polite" className="sr-only">
        {st.phase === 'locked' ? (bn ? 'বাজি বন্ধ' : 'Betting closed') : st.phase === 'open' ? (bn ? 'বাজি খোলা' : 'Betting open') : ''}
      </div>

      <WingoTopBar balance={balance} signedIn={signedIn === true} />
      <ModeTabs mode={mode} onSelect={setMode} />

      {/* Round card */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-br from-[#2a1608] via-[#1a0d18] to-black p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,213,84,0.14),transparent_60%)]" />
        <div className="relative flex items-start justify-between gap-3">
          {/* Left: recent mini balls + period */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/80">
              {bn ? 'সাম্প্রতিক ফলাফল' : 'Recent results'}
            </p>
            <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
              {st.data?.results?.length ? (
                st.data.results.slice(0, 10).map((r) => <WingoBall key={r.periodNumber} n={r.result} size={26} asBadge />)
              ) : (
                <span className="text-xs text-white/40">{bn ? 'ফলাফলের অপেক্ষায়' : 'Waiting for results'}</span>
              )}
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-white/45">{bn ? 'পিরিয়ড' : 'Period'}</p>
            <p className="font-mono text-sm font-bold tabular-nums text-white/90 sm:text-base">
              {round?.periodNumber ?? '--'}
            </p>
          </div>

          {/* Right: countdown */}
          <div className="shrink-0 text-right">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/45">
              {locked ? (bn ? 'বন্ধ হচ্ছে' : 'Draw in') : bn ? 'বাজির সময়' : 'Bet closes in'}
            </p>
            {round ? (
              <WingoTimer ms={locked ? st.msToDraw : st.msToBetClose} locked={locked} />
            ) : (
              <div className="h-8 w-24 animate-pulse rounded-md bg-white/10 motion-keep" />
            )}
            <div className="mt-2 inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', locked ? 'bg-rose-400' : 'bg-emerald-400')} />
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', locked ? 'text-rose-200' : 'text-emerald-200')}>
                {locked ? (bn ? 'লকড' : 'Locked') : bn ? 'ওপেন' : 'Open'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {st.loadError ? (
        <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {bn ? 'সার্ভারে পৌঁছানো যায়নি। পুনরায় চেষ্টা চলছে...' : 'Could not reach the server. Retrying...'}
        </p>
      ) : null}

      {loginPrompt && signedIn === false ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3">
          <p className="text-sm text-amber-100">{bn ? 'বাজি দিতে লগইন করুন।' : 'Log in to place a bet.'}</p>
          <Link href="/?login=1" className="inline-flex h-9 items-center rounded-lg bg-amber-400 px-4 text-xs font-extrabold uppercase tracking-wider text-[#3a1f00] hover:brightness-105">
            {bn ? 'লগইন' : 'Log in'}
          </Link>
        </div>
      ) : null}

      {/* Board */}
      <WingoBoard locked={locked} disabled={false} onPick={onPick} />

      {/* History tabs */}
      <WingoHistory
        results={st.data?.results ?? []}
        myBets={myBets}
        myBetsLoading={myBetsLoading}
        signedIn={signedIn === true}
        hasMore={Boolean(nextBefore)}
        onLoadMore={() => nextBefore && loadMyBets({ before: nextBefore })}
      />

      {/* Overlays */}
      {showTakeover && round ? (
        <WingoTakeover msToDraw={st.msToDraw} phase={st.phase} periodNumber={round.periodNumber} />
      ) : null}

      <WingoBetSheet
        open={sheetOpen}
        selection={selection}
        initialQuantity={sheetQty}
        minStake={st.data?.minStake ?? 1}
        maxStake={st.data?.maxStake ?? 100_000}
        balance={balance}
        locked={locked}
        submitting={submitting}
        onClose={() => setSheetOpen(false)}
        onConfirm={confirmBet}
      />
      {betError ? (
        <p role="alert" className="fixed inset-x-4 bottom-4 z-[75] mx-auto max-w-md rounded-lg border border-rose-400/50 bg-rose-950/90 px-4 py-2 text-center text-sm text-rose-100 shadow-lg">
          {betError}
        </p>
      ) : null}

      <WingoResultReveal
        open={revealOpen}
        result={revealResult?.result ?? null}
        periodNumber={revealResult?.periodNumber ?? null}
        onClose={onRevealClose}
      />

      <WingoWinCelebration open={winOpen} win={winCeleb} onClose={() => setWinOpen(false)} />

      <DepositRequiredModal open={depositOpen} onOpenChange={setDepositOpen} balance={balance} requiredAmount={depositAmount} />
    </Frame>
  );
}

// ---------- Pieces ----------

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-200px)] -mt-2 space-y-4 rounded-3xl border border-white/5 bg-gradient-to-b from-[#20100a] via-[#160a16] to-black p-3 text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] md:space-y-5 md:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>
      <div className="relative space-y-4 md:space-y-5">{children}</div>
    </div>
  );
}

function WingoTopBar({ balance, signedIn }: { balance: number | null; signedIn: boolean }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  return (
    <header className="flex items-center justify-between gap-2">
      <Link
        href="/games"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-wider text-white hover:border-white/30 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      >
        <span className="hidden sm:inline">{bn ? 'গেমে ফিরুন' : 'Back to games'}</span>
        <span className="sm:hidden">{bn ? 'গেম' : 'Games'}</span>
      </Link>
      <div className="flex items-center gap-2">
        {signedIn && typeof balance === 'number' ? (
          <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 text-sm font-extrabold tabular-nums text-amber-100">
            <WalletIcon className="h-3.5 w-3.5 text-amber-300" />
            {formatBDT(balance)}
          </span>
        ) : null}
        <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{bn ? 'প্রভাবলি ফেয়ার' : 'Provably fair'}</span>
          <span className="sm:hidden">{bn ? 'ফেয়ার' : 'Fair'}</span>
        </span>
      </div>
    </header>
  );
}

function ModeTabs({ mode, onSelect }: { mode: WingoMode; onSelect: (m: WingoMode) => void }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  return (
    <div role="tablist" aria-label={bn ? 'উইনগো মোড' : 'WinGo modes'} className="grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1.5">
      {WINGO_MODE_LIST.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(m)}
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-center transition',
              active
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#3a1f00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                : 'text-white/70 hover:bg-white/5',
            )}
          >
            <span className="text-sm font-black tabular-nums leading-none">{SHORT_LABEL[m]}</span>
            <span className={cn('text-[9px] font-bold uppercase tracking-wider', active ? 'text-[#5a3510]' : 'text-white/40')}>
              {bn ? WINGO_MODES[m].labelBn.split(' ').slice(1).join(' ') : 'WinGo'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
