// Built by Anointed Coder.
//
// Pasha Roulette play page. European single-zero wheel. Phase 1
// bet types: red, black, odd, even, low, high, straight number.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useLang } from '@/lib/i18n/context';
import { CircleDollarSign, ShieldCheck, RefreshCw, Sparkles, Wallet as WalletIcon } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useNativeGame } from '@/lib/native-games/use-native-game';

type BetType = 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'straight';

interface RouletteResult {
  roundId: string;
  win: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  result: number;
  resultColor: 'red' | 'black' | 'green';
  reused?: boolean;
}

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export default function RoulettePage() {
  const { lang } = useLang();
  const ng = useNativeGame('roulette');
  const game = ng.game;
  const [bet, setBet] = useState<string>('10');
  const [betType, setBetType] = useState<BetType>('red');
  const [straight, setStraight] = useState<number>(7);
  const [last, setLast] = useState<RouletteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectedMultiplier = useMemo(() => (betType === 'straight' ? 36 : 2), [betType]);
  const projectedPayout = useMemo(() => Number(bet) * projectedMultiplier, [bet, projectedMultiplier]);

  const onSpin = async () => {
    if (!ng.session) return;
    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(lang === 'bn' ? 'বেট পরিমাণ অবৈধ' : 'Bet amount is invalid');
      return;
    }
    setError(null); setLoading(true);
    try {
      const body: Record<string, unknown> = { sessionId: ng.session.id, betType, betAmount: amount };
      if (betType === 'straight') body.straightNumber = straight;
      const res = await fetch('/api/native-games/roulette/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? 'Spin failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const result = data as RouletteResult;
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
      <BackBar title={lang === 'bn' ? 'পাশা রুলেট' : 'Pasha Roulette'} />
      <CategoryHero
        kicker={lang === 'bn' ? 'পাশা অরিজিনালস' : 'Pasha Originals'}
        title={lang === 'bn' ? 'পাশা রুলেট' : 'Pasha Roulette'}
        description={
          lang === 'bn'
            ? 'ইউরোপীয় সিঙ্গেল জিরো হুইল। রঙ, জোড়/বিজোড়, ছোট/বড় বা সরাসরি নম্বর বাছাই।'
            : 'European single-zero wheel. Bet color, odd/even, low/high or a straight number.'
        }
        accent="red"
      />

      {!ng.enabled || !game?.isActive ? (
        <Unavailable lang={lang} />
      ) : (
        <>
          <BalanceStrip balance={ng.balance} game={game} lang={lang} />

          <section className="card-light p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট ধরন' : 'Bet type'}</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['red', 'black', 'odd', 'even', 'low', 'high'] as BetType[]).map((b) => (
                    <button key={b} type="button" onClick={() => setBetType(b)} className={cn(
                      'h-10 rounded-lg border text-xs font-bold uppercase tracking-wider transition',
                      betType === b
                        ? b === 'red'
                          ? 'border-red-500 bg-red-500 text-white'
                          : b === 'black'
                            ? 'border-brand-ink bg-brand-ink text-white'
                            : 'border-brand-yellow-500 bg-brand-yellow-500 text-brand-ink'
                        : 'border-brand-divider bg-brand-surface text-brand-ink hover:border-brand-yellow-500/50',
                    )}>
                      {labelFor(b, lang)}
                    </button>
                  ))}
                </div>

                <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'সরাসরি নম্বর (35:1)' : 'Straight number (35:1)'}</label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBetType('straight')}
                    className={cn(
                      'h-10 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition',
                      betType === 'straight' ? 'border-brand-yellow-500 bg-brand-yellow-500 text-brand-ink' : 'border-brand-divider bg-brand-surface text-brand-ink hover:border-brand-yellow-500/50',
                    )}
                  >
                    {lang === 'bn' ? 'সরাসরি' : 'Straight'}
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={36}
                    step={1}
                    value={straight}
                    onChange={(e) => { setBetType('straight'); setStraight(Math.max(0, Math.min(36, Number(e.target.value)))); }}
                    className="h-10 w-24 rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none"
                  />
                  <span className="text-xs text-brand-inkMute">0 - 36</span>
                </div>
              </div>

              <div className="rounded-xl border border-brand-divider bg-brand-surface p-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট পরিমাণ' : 'Bet amount'}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" inputMode="decimal" min={game.minBet} max={game.maxBet} step="1" value={bet} onChange={(e) => setBet(e.target.value)} className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none" />
                  <button type="button" onClick={() => setBet((b) => String(Math.max(game.minBet, Math.floor(Number(b) / 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">1/2</button>
                  <button type="button" onClick={() => setBet((b) => String(Math.min(game.maxBet, Math.floor(Number(b) * 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">2x</button>
                </div>
                <p className="mt-1 text-[11px] text-brand-inkMute">{formatBDT(game.minBet)} - {formatBDT(game.maxBet)} BDT</p>

                <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'পেআউট' : 'Payout'}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-brand-ink">{projectedMultiplier}x</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-brand-yellow-700">{formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}</p>
                  </div>
                </div>

                {error ? <p className="mt-2 text-sm text-signal-danger">{error}</p> : null}
                <button type="button" onClick={onSpin} disabled={loading} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow-500 text-base font-extrabold uppercase tracking-wider text-brand-ink hover:brightness-105 disabled:opacity-60">
                  <CircleDollarSign className={cn('h-5 w-5', loading && 'animate-spin')} />
                  {lang === 'bn' ? 'স্পিন' : 'Spin'}
                </button>
              </div>
            </div>
          </section>

          {last ? (
            <section className={cn('card-light p-5', last.win ? 'border-l-4 border-signal-ok' : 'border-l-4 border-signal-danger')}>
              <div className="flex flex-wrap items-center gap-4">
                <span className={cn(
                  'inline-flex h-14 w-14 items-center justify-center rounded-full text-2xl font-extrabold text-white shadow',
                  last.resultColor === 'red' && 'bg-red-600',
                  last.resultColor === 'black' && 'bg-brand-ink',
                  last.resultColor === 'green' && 'bg-emerald-600',
                )}>
                  {last.result}
                </span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'ফলাফল' : 'Result'}</p>
                  <p className="text-lg font-extrabold text-brand-ink">
                    {last.win
                      ? lang === 'bn' ? `জিত! ${formatBDT(last.payout)}` : `Won ${formatBDT(last.payout)}`
                      : lang === 'bn' ? 'হার' : 'Lost'}
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

function labelFor(b: BetType, lang: 'bn' | 'en') {
  if (b === 'red') return lang === 'bn' ? 'রেড' : 'Red';
  if (b === 'black') return lang === 'bn' ? 'ব্ল্যাক' : 'Black';
  if (b === 'odd') return lang === 'bn' ? 'বিজোড়' : 'Odd';
  if (b === 'even') return lang === 'bn' ? 'জোড়' : 'Even';
  if (b === 'low') return lang === 'bn' ? '১-১৮' : '1-18';
  if (b === 'high') return lang === 'bn' ? '১৯-৩৬' : '19-36';
  return 'Straight';
}

// ---------- shared helpers (light copies) ----------

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
        <p className="mt-1 text-sm font-semibold text-brand-ink">{lang === 'bn' ? 'সিঙ্গেল জিরো ইউরোপীয়' : 'Single-zero European'}</p>
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
          <RefreshCw className="h-3.5 w-3.5" />{lang === 'bn' ? 'সেশন বন্ধ + যাচাই' : 'Close + verify session'}
        </button>
        <button type="button" onClick={ng.newSession} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-paper">
          <Sparkles className="h-3.5 w-3.5" />{lang === 'bn' ? 'নতুন সেশন' : 'New session'}
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
