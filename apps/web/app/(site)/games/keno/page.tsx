// Built by Anointed Coder.
//
// Pasha Keno play page. Player picks 1..10 numbers from the 1..80
// pool, places a bet, and the server draws 20 numbers. Matches
// against the player picks decide the multiplier.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useLang } from '@/lib/i18n/context';
import { Target, ShieldCheck, RefreshCw, Sparkles, Wallet as WalletIcon } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useNativeGame } from '@/lib/native-games/use-native-game';

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

  const togglePick = (n: number) => {
    setLast(null);
    setError(null);
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
    while (next.size < n) {
      next.add(Math.floor(Math.random() * poolSize) + 1);
    }
    setPicks(next);
  };

  const playerPicks = useMemo(() => Array.from(picks).sort((a, b) => a - b), [picks]);

  const onRoll = async () => {
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
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/native-games/keno/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: ng.session.id, picks: playerPicks, betAmount: amount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Roll failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const result = data as KenoResult;
      setLast(result);
      ng.bumpNonce();
      ng.refreshBalance();
    } catch {
      setError('Could not reach server');
    } finally { setLoading(false); }
  };

  if (ng.authError) return <LoginGate lang={lang} />;

  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'পাশা কেনো' : 'Pasha Keno'} />
      <CategoryHero
        kicker={lang === 'bn' ? 'পাশা অরিজিনালস' : 'Pasha Originals'}
        title={lang === 'bn' ? 'পাশা কেনো' : 'Pasha Keno'}
        description={
          lang === 'bn'
            ? `নম্বর বাছাই করুন। সার্ভার ${drawCount}টি ড্র করবে। মিল হলে গুণিতক জিতবেন।`
            : `Pick numbers. The server draws ${drawCount}. Match to win the multiplier.`
        }
        accent="green"
      />

      {!ng.enabled || !game?.isActive ? (
        <Unavailable lang={lang} />
      ) : (
        <>
          <BalanceStrip balance={ng.balance} game={game} lang={lang} />

          <section className="card-light p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-brand-ink">
                {lang === 'bn' ? `${playerPicks.length} / ${maxPicks} বাছাই` : `${playerPicks.length} / ${maxPicks} picked`}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={quickPick} className="h-9 rounded-lg border border-brand-divider px-3 text-xs font-semibold text-brand-inkSoft hover:bg-brand-surface">{lang === 'bn' ? 'কুইক পিক' : 'Quick pick'}</button>
                <button type="button" onClick={clearPicks} className="h-9 rounded-lg border border-brand-divider px-3 text-xs font-semibold text-brand-inkSoft hover:bg-brand-surface">{lang === 'bn' ? 'ক্লিয়ার' : 'Clear'}</button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-8 gap-1.5 sm:grid-cols-10">
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
                    className={cn(
                      'aspect-square rounded-md border text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-500/40',
                      !isPicked && !drawn && 'border-brand-divider bg-brand-paper text-brand-inkSoft hover:border-brand-yellow-500/50',
                      isPicked && !drawn && 'border-brand-yellow-500 bg-brand-yellow-500 text-brand-ink',
                      drawn && !match && 'border-brand-blue-500/50 bg-brand-blue-500/10 text-brand-blue-700',
                      match && 'border-signal-ok bg-signal-ok/30 text-brand-ink',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </section>

          <BetPanel
            bet={bet}
            setBet={setBet}
            game={game}
            error={error}
            loading={loading}
            onPlay={onRoll}
            playLabel={lang === 'bn' ? 'ড্র দেখুন' : 'Draw'}
            potentialLabel={lang === 'bn' ? `বাছাই: ${playerPicks.length}` : `${playerPicks.length} picked`}
            potentialValue={last?.win ? `+${formatBDT(last.payout)}` : ''}
            lang={lang}
          />

          {last ? (
            <section className={cn('card-light p-5', last.win ? 'border-l-4 border-signal-ok' : 'border-l-4 border-signal-danger')}>
              <p className="text-sm font-bold uppercase tracking-wider text-brand-inkMute">
                {last.win
                  ? lang === 'bn' ? `${last.matchCount} মিল! ${last.multiplier.toFixed(4)}x = ${formatBDT(last.payout)}` : `${last.matchCount} matches! ${last.multiplier.toFixed(4)}x = ${formatBDT(last.payout)}`
                  : lang === 'bn' ? `${last.matchCount} মিল - এই বার লাভ নেই` : `${last.matchCount} matches - no payout this round`}
              </p>
            </section>
          ) : null}

          <FairnessPanel ng={ng} lang={lang} />
        </>
      )}
    </div>
  );
}

// ---------- Shared sub-components reused across native-game pages ----------

function BalanceStrip({ balance, game, lang }: { balance: number | null; game: { minBet: number; maxBet: number; houseEdgeBps: number }; lang: 'bn' | 'en' }) {
  return (
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
        <p className="mt-1 text-sm font-semibold text-brand-ink">{formatBDT(game.minBet)} - {formatBDT(game.maxBet)}</p>
        <p className="text-[11px] text-brand-inkMute">{lang === 'bn' ? 'হাউস এজ' : 'House edge'}: {(game.houseEdgeBps / 100).toFixed(2)}%</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'গেম মোড' : 'Game mode'}</p>
        <p className="mt-1 text-sm font-semibold text-brand-ink">{lang === 'bn' ? 'ইনস্ট্যান্ট, প্রভাবলি ফেয়ার' : 'Instant, provably fair'}</p>
      </div>
    </section>
  );
}

function BetPanel({ bet, setBet, game, error, loading, onPlay, playLabel, potentialLabel, potentialValue, lang }: {
  bet: string;
  setBet: (v: string) => void;
  game: { minBet: number; maxBet: number };
  error: string | null;
  loading: boolean;
  onPlay: () => void;
  playLabel: string;
  potentialLabel: string;
  potentialValue: string;
  lang: 'bn' | 'en';
}) {
  return (
    <section className="card-light p-5 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট পরিমাণ' : 'Bet amount'}</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={game.minBet}
              max={game.maxBet}
              step="1"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none"
            />
            <button type="button" onClick={() => setBet(String(Math.max(game.minBet, Math.floor(Number(bet) / 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">1/2</button>
            <button type="button" onClick={() => setBet(String(Math.min(game.maxBet, Math.floor(Number(bet) * 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">2x</button>
          </div>
          <p className="mt-1 text-[11px] text-brand-inkMute">{formatBDT(game.minBet)} - {formatBDT(game.maxBet)} BDT</p>
        </div>
        <div className="rounded-xl border border-brand-divider bg-brand-surface p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{potentialLabel}</p>
          <p className="mt-1 text-xl font-extrabold text-brand-yellow-700 min-h-[1.75rem]">{potentialValue || '-'}</p>
          {error ? <p className="mt-2 text-sm text-signal-danger">{error}</p> : null}
          <button
            type="button"
            onClick={onPlay}
            disabled={loading}
            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow-500 text-base font-extrabold uppercase tracking-wider text-brand-ink hover:brightness-105 disabled:opacity-60"
          >
            <Target className={cn('h-5 w-5', loading && 'animate-spin')} />
            {playLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function FairnessPanel({ ng, lang }: { ng: ReturnType<typeof useNativeGame>; lang: 'bn' | 'en' }) {
  return (
    <section className="card-light p-5 md:p-6">
      <div className="flex items-center gap-2 text-brand-ink">
        <ShieldCheck className="h-4 w-4 text-brand-yellow-600" />
        <h3 className="text-base font-extrabold">{lang === 'bn' ? 'প্রভাবলি ফেয়ার প্যানেল' : 'Provably fair'}</h3>
      </div>
      {ng.session ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Detail label={lang === 'bn' ? 'সার্ভার সিড হ্যাশ' : 'Server seed hash'} value={ng.session.serverSeedHash} mono />
          <Detail label={lang === 'bn' ? 'ক্লায়েন্ট সিড' : 'Client seed'} value={ng.session.clientSeed} mono />
          <Detail label={lang === 'bn' ? 'বর্তমান ননস' : 'Current nonce'} value={String(ng.session.nonce)} />
          <Detail label={lang === 'bn' ? 'সেশন স্ট্যাটাস' : 'Session status'} value={ng.session.status} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-brand-inkMute">{lang === 'bn' ? 'সেশন তৈরি হচ্ছে...' : 'Opening session...'}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={ng.closeSessionAndReveal} disabled={!ng.session} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-ink hover:bg-brand-paper disabled:opacity-60">
          <RefreshCw className="h-3.5 w-3.5" />
          {lang === 'bn' ? 'সেশন বন্ধ + যাচাই' : 'Close + verify session'}
        </button>
        <button type="button" onClick={ng.newSession} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-paper">
          <Sparkles className="h-3.5 w-3.5" />
          {lang === 'bn' ? 'নতুন সেশন' : 'New session'}
        </button>
      </div>
    </section>
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

function Unavailable({ lang }: { lang: 'bn' | 'en' }) {
  return (
    <section className="card-light p-5">
      <p className="text-sm text-brand-inkSoft">
        {lang === 'bn' ? 'এই গেমটি বর্তমানে সাময়িকভাবে অনুপলব্ধ।' : 'This game is temporarily unavailable.'}
      </p>
    </section>
  );
}

function LoginGate({ lang }: { lang: 'bn' | 'en' }) {
  return (
    <div className="space-y-6">
      <BackBar />
      <section className="card-light p-5">
        <p className="text-sm text-brand-inkSoft">{lang === 'bn' ? 'খেলতে লগইন করুন।' : 'Log in to play.'}</p>
        <div className="mt-3 flex gap-2">
          <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-sm">{lang === 'bn' ? 'লগইন' : 'Log in'}</Link>
          <Link href="/?signup=1" className="inline-flex h-10 items-center rounded-lg border border-brand-divider bg-brand-surface px-4 text-sm font-semibold text-brand-ink hover:bg-brand-paper">{lang === 'bn' ? 'রেজিস্টার' : 'Register'}</Link>
        </div>
      </section>
    </div>
  );
}
