// Built by Anointed Coder.
//
// Pasha Dice play page. Bet, pick over/under + target, roll. Result
// flips in instantly because settlement is server-side and atomic.
//
// The fairness panel shows the live serverSeedHash, clientSeed and
// current nonce so the player can verify any settled session after
// closing it. The "Close + verify" button POSTs to the verify endpoint
// which flips the session to EXPIRED, then redirects to the verify
// GET URL where the serverSeed is finally revealed.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useLang } from '@/lib/i18n/context';
import { Dice5, Wallet as WalletIcon, ShieldCheck, RefreshCw, ArrowRight, Sparkles } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface GameConfig {
  gameCode: string;
  displayName: string;
  isActive: boolean;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  config: { minTarget?: number; maxTarget?: number } | null;
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

interface DiceBetResult {
  roundId: string;
  outcome: 'WIN' | 'LOSS';
  result: number;
  multiplier: number;
  payout: number;
  win: boolean;
  winChancePct: number;
  newBalance: number;
  nonce: number;
  reused?: boolean;
}

interface RecentBet extends DiceBetResult {
  target: number;
  direction: 'over' | 'under';
  bet: number;
  at: number;
}

interface MeResponse {
  user?: { wallet?: { balance?: number | string } | null } | null;
}

export default function DicePage() {
  const { lang } = useLang();
  const [game, setGame] = useState<GameConfig | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [session, setSession] = useState<SessionView | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [target, setTarget] = useState<number>(50);
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [bet, setBet] = useState<string>('10');
  const [last, setLast] = useState<DiceBetResult | null>(null);
  const [history, setHistory] = useState<RecentBet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
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
    } catch { /* ignore - UI just keeps the stale balance */ }
  }, []);

  const openSession = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/native-games/dice/sessions', {
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
        const res = await fetch('/api/native-games/dice', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (alive && data?.game) {
          setGame(data.game as GameConfig);
          setEnabled(Boolean(data.enabled));
          if (typeof data.game.minBet === 'number') setBet(String(Math.max(data.game.minBet, 10)));
        }
      } catch { /* leave defaults */ }
    })();
    refreshBalance();
    return () => { alive = false; };
  }, [refreshBalance]);

  useEffect(() => {
    if (!enabled || !game || !game.isActive || authError) return;
    if (session) return;
    openSession();
  }, [enabled, game, session, openSession, authError]);

  const winChancePct = useMemo(() => (direction === 'over' ? 100 - target : target), [direction, target]);
  const fairMultiplier = useMemo(() => (winChancePct > 0 ? 100 / winChancePct : 0), [winChancePct]);
  const houseRetention = useMemo(() => (game ? (10_000 - game.houseEdgeBps) / 10_000 : 0.98), [game]);
  const projectedMultiplier = useMemo(() => fairMultiplier * houseRetention, [fairMultiplier, houseRetention]);
  const projectedPayout = useMemo(() => Number(bet) * projectedMultiplier, [bet, projectedMultiplier]);

  const onRoll = async () => {
    if (!session) { await openSession(); return; }
    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(lang === 'bn' ? 'বেট পরিমাণ অবৈধ' : 'Bet amount is invalid');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/native-games/dice/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          target,
          direction,
          betAmount: amount,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Roll failed');
        if (data?.code === 'SESSION_INACTIVE') {
          setSession(null);
        }
        return;
      }
      const result = data as DiceBetResult;
      setLast(result);
      setBalance(result.newBalance);
      setSession((prev) => (prev ? { ...prev, nonce: result.nonce + 1 } : prev));
      setHistory((prev) => [
        { ...result, target, direction, bet: amount, at: Date.now() },
        ...prev,
      ].slice(0, 12));
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'পাশা ডাইস' : 'Pasha Dice'} />

      <CategoryHero
        kicker={lang === 'bn' ? 'পাশা নেটিভ গেমস' : 'Pasha Native Games'}
        title={lang === 'bn' ? 'পাশা ডাইস' : 'Pasha Dice'}
        description={
          lang === 'bn'
            ? 'লক্ষ্য নম্বর বেছে নিন, কম বা বেশি বাছাই করুন, রোল করুন। ফল সাথে সাথে সেটল হয়।'
            : 'Pick a target, choose over or under, and roll. Every result settles instantly and is provably fair.'
        }
        accent="royal"
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
          <p className="text-sm text-brand-inkSoft">
            {lang === 'bn'
              ? 'খেলতে লগইন করুন।'
              : 'Log in to play.'}
          </p>
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
          {/* Wallet + last result strip */}
          <section className="card-light grid gap-3 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'মেইন ব্যালেন্স' : 'Main balance'}</p>
              <p className="mt-1 inline-flex items-baseline gap-1 text-2xl font-extrabold text-brand-ink">
                <WalletIcon className="h-4 w-4 text-brand-yellow-600" />
                {balance != null ? formatBDT(balance) : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট সীমা' : 'Bet range'}</p>
              <p className="mt-1 text-sm font-semibold text-brand-ink">{game ? `${formatBDT(game.minBet)} - ${formatBDT(game.maxBet)}` : '-'}</p>
              <p className="text-[11px] text-brand-inkMute">{lang === 'bn' ? 'হাউস এজ' : 'House edge'}: {game ? `${(game.houseEdgeBps / 100).toFixed(2)}%` : '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'শেষ ফলাফল' : 'Last result'}</p>
              {last ? (
                <p className={cn('mt-1 text-2xl font-extrabold tabular-nums', last.win ? 'text-signal-ok' : 'text-signal-danger')}>
                  {last.result.toFixed(2)}{' '}
                  <span className="text-xs font-semibold uppercase tracking-wider">{last.win ? (lang === 'bn' ? 'জিত' : 'Won') : (lang === 'bn' ? 'হার' : 'Lost')}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-brand-inkMute">{lang === 'bn' ? 'প্রথম রোলের অপেক্ষায়' : 'Waiting for first roll'}</p>
              )}
              {last ? <p className="text-[11px] text-brand-inkMute">{lang === 'bn' ? 'গুণিতক' : 'Multiplier'}: {last.multiplier.toFixed(4)}x</p> : null}
            </div>
          </section>

          <section className="card-light p-5 md:p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট পরিমাণ' : 'Bet amount'}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={game?.minBet ?? 10}
                    max={game?.maxBet ?? 10_000}
                    step="1"
                    value={bet}
                    onChange={(e) => setBet(e.target.value)}
                    className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none"
                  />
                  <button type="button" onClick={() => setBet((b) => String(Math.max(game?.minBet ?? 10, Math.floor(Number(b) / 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">1/2</button>
                  <button type="button" onClick={() => setBet((b) => String(Math.min(game?.maxBet ?? 10_000, Math.floor(Number(b) * 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">2x</button>
                </div>

                <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'লক্ষ্য' : 'Target'}: {target}</label>
                <input
                  type="range"
                  min={2}
                  max={98}
                  step={1}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="mt-2 w-full accent-brand-yellow-500"
                />
                <div className="mt-1 flex justify-between text-[10px] text-brand-inkMute">
                  <span>2</span>
                  <span>50</span>
                  <span>98</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('under')}
                    className={cn(
                      'h-11 rounded-lg border text-sm font-bold uppercase tracking-wider transition',
                      direction === 'under'
                        ? 'border-brand-blue-500 bg-brand-blue-500 text-white'
                        : 'border-brand-divider bg-brand-surface text-brand-ink hover:border-brand-blue-500/50',
                    )}
                  >
                    &lt; {lang === 'bn' ? 'কম' : 'Under'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('over')}
                    className={cn(
                      'h-11 rounded-lg border text-sm font-bold uppercase tracking-wider transition',
                      direction === 'over'
                        ? 'border-brand-yellow-500 bg-brand-yellow-500 text-brand-ink'
                        : 'border-brand-divider bg-brand-surface text-brand-ink hover:border-brand-yellow-500/50',
                    )}
                  >
                    &gt; {lang === 'bn' ? 'বেশি' : 'Over'}
                  </button>
                </div>
              </div>

              <div className="grid content-between gap-3 rounded-xl border border-brand-divider bg-brand-surface p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'জয়ের সম্ভাবনা' : 'Win chance'}</p>
                    <p className="mt-1 text-xl font-extrabold text-brand-ink">{winChancePct.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'গুণিতক' : 'Multiplier'}</p>
                    <p className="mt-1 text-xl font-extrabold text-brand-ink">{projectedMultiplier.toFixed(4)}x</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'}</p>
                    <p className="mt-1 text-2xl font-extrabold text-brand-yellow-700">{formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}</p>
                  </div>
                </div>

                {error ? <p className="text-sm text-signal-danger">{error}</p> : null}

                <button
                  type="button"
                  onClick={onRoll}
                  disabled={loading || !session}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow-500 text-base font-extrabold uppercase tracking-wider text-brand-ink hover:brightness-105 disabled:opacity-60"
                >
                  <Dice5 className={cn('h-5 w-5', loading && 'animate-spin')} />
                  {lang === 'bn' ? 'রোল' : 'Roll'}
                </button>
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
              <button type="button" onClick={onCloseSession} disabled={!session} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-ink hover:bg-brand-paper disabled:opacity-60">
                <RefreshCw className="h-3.5 w-3.5" />
                {lang === 'bn' ? 'সেশন বন্ধ + যাচাই' : 'Close + verify session'}
              </button>
              <button type="button" onClick={() => { setSession(null); openSession(); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-paper">
                <Sparkles className="h-3.5 w-3.5" />
                {lang === 'bn' ? 'নতুন সেশন' : 'New session'}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-brand-inkMute">
              {lang === 'bn'
                ? 'হ্যাশটি এখনই প্রকাশ্য। মূল সার্ভার সিড সেশন বন্ধ হলে প্রকাশিত হবে - তখন প্রতিটি রাউন্ড নিজেই যাচাই করা যাবে।'
                : 'The hash is public now; the underlying server seed is revealed only after you close the session. Then every round can be re-derived.'}
            </p>
          </section>

          {/* Recent rolls */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-brand-yellow-600" />
              <h3 className="text-base font-extrabold text-brand-ink md:text-lg">{lang === 'bn' ? 'সাম্প্রতিক রোল' : 'Recent rolls'}</h3>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-brand-inkMute">{lang === 'bn' ? 'কোনো রোল নেই।' : 'No rolls yet.'}</p>
            ) : (
              <div className="card-light overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="border-b border-brand-divider bg-brand-surface text-left text-[11px] uppercase tracking-wider text-brand-inkMute">
                    <tr>
                      <th className="px-4 py-2 font-semibold">{lang === 'bn' ? 'লক্ষ্য' : 'Target'}</th>
                      <th className="px-4 py-2 font-semibold">{lang === 'bn' ? 'দিক' : 'Dir'}</th>
                      <th className="px-4 py-2 font-semibold">{lang === 'bn' ? 'বেট' : 'Bet'}</th>
                      <th className="px-4 py-2 font-semibold">{lang === 'bn' ? 'ফলাফল' : 'Result'}</th>
                      <th className="px-4 py-2 font-semibold">{lang === 'bn' ? 'গুণিতক' : 'Mult'}</th>
                      <th className="px-4 py-2 font-semibold">{lang === 'bn' ? 'পেআউট' : 'Payout'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-divider">
                    {history.map((h) => (
                      <tr key={h.roundId} className={cn(h.win ? 'bg-signal-ok/5' : 'bg-signal-danger/5')}>
                        <td className="px-4 py-2 font-mono text-brand-inkSoft">{h.target}</td>
                        <td className="px-4 py-2 uppercase text-brand-inkSoft">{h.direction}</td>
                        <td className="px-4 py-2 font-semibold text-brand-ink">{formatBDT(h.bet)}</td>
                        <td className="px-4 py-2 font-mono font-semibold text-brand-ink">{h.result.toFixed(2)}</td>
                        <td className="px-4 py-2 font-mono text-brand-inkSoft">{h.multiplier.toFixed(4)}x</td>
                        <td className={cn('px-4 py-2 font-semibold', h.win ? 'text-signal-ok' : 'text-signal-danger')}>{h.win ? `+${formatBDT(h.payout)}` : `-${formatBDT(h.bet)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
