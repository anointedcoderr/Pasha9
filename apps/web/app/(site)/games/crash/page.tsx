// Built by Anointed Coder.
//
// Pasha Crash play page. Phase 1 ships the SAFER turn-based variant:
// player declares their auto-cashout target up-front, server reveals
// the round's crashPoint, payout settles instantly.
//
// Wins pay `bet * targetMultiplier`. Loss happens whenever the
// crashPoint is below the target.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useLang } from '@/lib/i18n/context';
import { Zap, ShieldCheck, RefreshCw, Sparkles, Wallet as WalletIcon, TrendingUp } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useNativeGame } from '@/lib/native-games/use-native-game';

interface CrashResult {
  roundId: string;
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  crashPoint: number;
  targetMultiplier: number;
  reused?: boolean;
}

export default function CrashPage() {
  const { lang } = useLang();
  const ng = useNativeGame('crash');
  const game = ng.game;
  const cfg = (game?.config ?? {}) as { minTargetMultiplier?: number; maxTargetMultiplier?: number };
  const minTarget = Number(cfg.minTargetMultiplier ?? 1.01);
  const maxTarget = Number(cfg.maxTargetMultiplier ?? 100);

  const [bet, setBet] = useState<string>('10');
  const [target, setTarget] = useState<string>('2.00');
  const [last, setLast] = useState<CrashResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectedPayout = useMemo(() => Number(bet) * Number(target), [bet, target]);

  const onPlace = async () => {
    if (!ng.session) return;
    const amount = Number(bet);
    const tgt = Number(target);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(lang === 'bn' ? 'বেট পরিমাণ অবৈধ' : 'Bet amount is invalid');
      return;
    }
    if (!Number.isFinite(tgt) || tgt < minTarget || tgt > maxTarget) {
      setError(lang === 'bn' ? `লক্ষ্য ${minTarget} - ${maxTarget} এর মধ্যে রাখুন` : `Target must be between ${minTarget} and ${maxTarget}`);
      return;
    }
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/native-games/crash/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: ng.session.id, betAmount: amount, targetMultiplier: tgt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Round failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const result = data as CrashResult;
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
      <BackBar title={lang === 'bn' ? 'পাশা ক্র্যাশ' : 'Pasha Crash'} />
      <CategoryHero
        kicker={lang === 'bn' ? 'পাশা অরিজিনালস' : 'Pasha Originals'}
        title={lang === 'bn' ? 'পাশা ক্র্যাশ' : 'Pasha Crash'}
        description={
          lang === 'bn'
            ? 'অটো ক্যাশআউট লক্ষ্য সেট করুন। ক্র্যাশ লক্ষ্যের আগে এলে হার, পরে এলে জয়।'
            : 'Set your auto-cashout target. Win if the crash point reaches it, lose if it crashes first.'
        }
        accent="blue"
      />

      {!ng.enabled || !game?.isActive ? (
        <Unavailable lang={lang} />
      ) : (
        <>
          <BalanceStrip balance={ng.balance} game={game} lang={lang} />

          <section className="card-light p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট পরিমাণ' : 'Bet amount'}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" inputMode="decimal" min={game.minBet} max={game.maxBet} step="1" value={bet} onChange={(e) => setBet(e.target.value)} className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none" />
                  <button type="button" onClick={() => setBet((b) => String(Math.max(game.minBet, Math.floor(Number(b) / 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">1/2</button>
                  <button type="button" onClick={() => setBet((b) => String(Math.min(game.maxBet, Math.floor(Number(b) * 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">2x</button>
                </div>
                <p className="mt-1 text-[11px] text-brand-inkMute">{formatBDT(game.minBet)} - {formatBDT(game.maxBet)} BDT</p>

                <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'অটো ক্যাশআউট লক্ষ্য' : 'Auto-cashout target'}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" inputMode="decimal" min={minTarget} max={maxTarget} step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none" />
                  <span className="text-sm font-semibold text-brand-inkSoft">x</span>
                </div>
                <p className="mt-1 text-[11px] text-brand-inkMute">{minTarget}x - {maxTarget}x</p>
              </div>

              <div className="rounded-xl border border-brand-divider bg-brand-surface p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'লক্ষ্য' : 'Target'}</p>
                    <p className="mt-1 text-xl font-extrabold text-brand-ink">{Number(target).toFixed(2)}x</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'}</p>
                    <p className="mt-1 text-xl font-extrabold text-brand-yellow-700">{formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}</p>
                  </div>
                </div>

                {error ? <p className="mt-3 text-sm text-signal-danger">{error}</p> : null}

                <button type="button" onClick={onPlace} disabled={loading} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow-500 text-base font-extrabold uppercase tracking-wider text-brand-ink hover:brightness-105 disabled:opacity-60">
                  <Zap className={cn('h-5 w-5', loading && 'animate-spin')} />
                  {lang === 'bn' ? 'বেট দিন' : 'Place bet'}
                </button>

                <p className="mt-2 text-[11px] text-brand-inkMute">
                  {lang === 'bn'
                    ? 'টিপ: লক্ষ্য কম হলে জয়ের সম্ভাবনা বেশি, কিন্তু পেআউট ছোট।'
                    : 'Tip: a lower target wins more often but pays smaller.'}
                </p>
              </div>
            </div>
          </section>

          {last ? (
            <section className={cn('card-light p-5', last.win ? 'border-l-4 border-signal-ok' : 'border-l-4 border-signal-danger')}>
              <div className="flex flex-wrap items-center gap-4">
                <span className={cn(
                  'inline-flex h-14 items-center justify-center rounded-xl px-4 text-2xl font-extrabold text-white shadow',
                  last.win ? 'bg-signal-ok' : 'bg-signal-danger',
                )}>
                  <TrendingUp className="mr-1 h-5 w-5" /> {last.crashPoint.toFixed(2)}x
                </span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'ক্র্যাশ পয়েন্ট' : 'Crash point'}</p>
                  <p className="text-lg font-extrabold text-brand-ink">
                    {last.win
                      ? lang === 'bn' ? `${last.targetMultiplier.toFixed(2)}x এ ক্যাশআউট = ${formatBDT(last.payout)}` : `Cashed out at ${last.targetMultiplier.toFixed(2)}x = ${formatBDT(last.payout)}`
                      : lang === 'bn' ? 'ক্র্যাশ লক্ষ্যের আগে এসেছে - হার' : 'Crashed before target - lost'}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <FairnessPanel ng={ng} lang={lang} />
        </>
      )}
    </div>
  );
}

// ---------- shared helpers ----------

function BalanceStrip({ balance, game, lang }: { balance: number | null; game: { minBet: number; maxBet: number; houseEdgeBps: number }; lang: 'bn' | 'en' }) {
  return (
    <section className="card-light grid gap-3 p-4 sm:grid-cols-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'মেইন ব্যালেন্স' : 'Main balance'}</p>
        <p className="mt-1 inline-flex items-baseline gap-1 text-2xl font-extrabold text-brand-ink"><WalletIcon className="h-4 w-4 text-brand-yellow-600" />{balance != null ? formatBDT(balance) : '-'}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট সীমা' : 'Bet range'}</p>
        <p className="mt-1 text-sm font-semibold text-brand-ink">{formatBDT(game.minBet)} - {formatBDT(game.maxBet)}</p>
        <p className="text-[11px] text-brand-inkMute">{lang === 'bn' ? 'হাউস এজ' : 'House edge'}: {(game.houseEdgeBps / 100).toFixed(2)}%</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'গেম মোড' : 'Game mode'}</p>
        <p className="mt-1 text-sm font-semibold text-brand-ink">{lang === 'bn' ? 'অটো ক্যাশআউট, ইনস্ট্যান্ট সেটল' : 'Auto-cashout, instant settle'}</p>
      </div>
    </section>
  );
}

function FairnessPanel({ ng, lang }: { ng: ReturnType<typeof useNativeGame>; lang: 'bn' | 'en' }) {
  return (
    <section className="card-light p-5 md:p-6">
      <div className="flex items-center gap-2 text-brand-ink"><ShieldCheck className="h-4 w-4 text-brand-yellow-600" /><h3 className="text-base font-extrabold">{lang === 'bn' ? 'প্রভাবলি ফেয়ার প্যানেল' : 'Provably fair'}</h3></div>
      {ng.session ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Detail label={lang === 'bn' ? 'সার্ভার সিড হ্যাশ' : 'Server seed hash'} value={ng.session.serverSeedHash} mono />
          <Detail label={lang === 'bn' ? 'ক্লায়েন্ট সিড' : 'Client seed'} value={ng.session.clientSeed} mono />
          <Detail label={lang === 'bn' ? 'বর্তমান ননস' : 'Current nonce'} value={String(ng.session.nonce)} />
          <Detail label={lang === 'bn' ? 'সেশন স্ট্যাটাস' : 'Session status'} value={ng.session.status} />
        </div>
      ) : <p className="mt-3 text-sm text-brand-inkMute">{lang === 'bn' ? 'সেশন তৈরি হচ্ছে...' : 'Opening session...'}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={ng.closeSessionAndReveal} disabled={!ng.session} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-ink hover:bg-brand-paper disabled:opacity-60"><RefreshCw className="h-3.5 w-3.5" />{lang === 'bn' ? 'সেশন বন্ধ + যাচাই' : 'Close + verify session'}</button>
        <button type="button" onClick={ng.newSession} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-paper"><Sparkles className="h-3.5 w-3.5" />{lang === 'bn' ? 'নতুন সেশন' : 'New session'}</button>
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
      <p className="text-sm text-brand-inkSoft">{lang === 'bn' ? 'এই গেমটি বর্তমানে সাময়িকভাবে অনুপলব্ধ।' : 'This game is temporarily unavailable.'}</p>
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
