// Built by Anointed Coder.
//
// Pasha Slots play page. 3-reel single payline. The server picks
// the reel stops from the HMAC stream; the client only renders the
// final symbols (no animation logic on the client could change the
// outcome).

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useLang } from '@/lib/i18n/context';
import { Cherry, ShieldCheck, RefreshCw, Sparkles, Wallet as WalletIcon } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useNativeGame } from '@/lib/native-games/use-native-game';

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

const SYMBOL_GLYPH: Record<string, string> = {
  CHERRY: '🍒',
  LEMON:  '🍋',
  CLOVER: '☘',
  NINE:   '9',
  STAR:   '★',
  DIAMOND:'◆',
  CROWN:  '♕',
  SEVEN:  '7',
};

function glyph(s: string | null | undefined): string {
  if (!s) return '?';
  return SYMBOL_GLYPH[s] ?? s[0] ?? '?';
}

export default function SlotsPage() {
  const { lang } = useLang();
  const ng = useNativeGame('slots');
  const game = ng.game;
  const cfg = (game?.config ?? {}) as { reels?: number; symbols?: string[]; paytable?: Record<string, Record<string, number>> };
  const reels = Number(cfg.reels ?? 3);

  const [bet, setBet] = useState<string>('10');
  const [last, setLast] = useState<SlotsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSpin = async () => {
    if (!ng.session) return;
    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(lang === 'bn' ? 'বেট পরিমাণ অবৈধ' : 'Bet amount is invalid');
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
        setError(data?.message ?? data?.code ?? 'Spin failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const result = data as SlotsResult;
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
      <BackBar title={lang === 'bn' ? 'পাশা স্লটস' : 'Pasha Slots'} />
      <CategoryHero
        kicker={lang === 'bn' ? 'পাশা অরিজিনালস' : 'Pasha Originals'}
        title={lang === 'bn' ? 'পাশা স্লটস' : 'Pasha Slots'}
        description={
          lang === 'bn'
            ? 'তিন রিল, আটটি মৌলিক চিহ্ন, একটি পেলাইন। সাথে সাথে রেজাল্ট।'
            : 'Three reels, eight original symbols, one payline. Instant result.'
        }
        accent="yellow"
      />

      {!ng.enabled || !game?.isActive ? (
        <Unavailable lang={lang} />
      ) : (
        <>
          <BalanceStrip balance={ng.balance} game={game} lang={lang} />

          <section className="card-light p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
              <div className="rounded-2xl border border-brand-divider bg-brand-surface p-5">
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${reels}, minmax(0, 1fr))` }}>
                  {Array.from({ length: reels }).map((_, i) => {
                    const sym = last?.reelSymbols?.[i];
                    return (
                      <div key={i} className="flex aspect-square items-center justify-center rounded-xl border border-brand-divider bg-brand-paper text-4xl font-extrabold text-brand-ink shadow-inner md:text-5xl">
                        {glyph(sym)}
                      </div>
                    );
                  })}
                </div>
                {last ? (
                  <p className={cn('mt-3 text-center text-sm font-bold uppercase tracking-wider', last.win ? 'text-signal-ok' : 'text-brand-inkMute')}>
                    {last.win
                      ? lang === 'bn' ? `${last.matchedSymbol ?? ''} জয়! ${last.multiplier.toFixed(4)}x = ${formatBDT(last.payout)}` : `${last.matchedSymbol ?? ''} win! ${last.multiplier.toFixed(4)}x = ${formatBDT(last.payout)}`
                      : lang === 'bn' ? 'কোনো ম্যাচ নেই' : 'No match'}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'বেট পরিমাণ' : 'Bet amount'}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" inputMode="decimal" min={game.minBet} max={game.maxBet} step="1" value={bet} onChange={(e) => setBet(e.target.value)} className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-base font-semibold text-brand-ink focus:border-brand-blue-500 focus:outline-none" />
                  <button type="button" onClick={() => setBet((b) => String(Math.max(game.minBet, Math.floor(Number(b) / 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">1/2</button>
                  <button type="button" onClick={() => setBet((b) => String(Math.min(game.maxBet, Math.floor(Number(b) * 2))))} className="h-11 rounded-lg border border-brand-divider px-3 text-sm font-semibold text-brand-inkSoft hover:bg-brand-surface">2x</button>
                </div>
                <p className="mt-1 text-[11px] text-brand-inkMute">{formatBDT(game.minBet)} - {formatBDT(game.maxBet)} BDT</p>

                {error ? <p className="mt-2 text-sm text-signal-danger">{error}</p> : null}
                <button type="button" onClick={onSpin} disabled={loading} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow-500 text-base font-extrabold uppercase tracking-wider text-brand-ink hover:brightness-105 disabled:opacity-60">
                  <Cherry className={cn('h-5 w-5', loading && 'animate-spin')} />
                  {lang === 'bn' ? 'স্পিন' : 'Spin'}
                </button>

                <div className="mt-4 rounded-lg border border-brand-divider bg-brand-surface p-3 text-xs text-brand-inkSoft">
                  <p className="font-bold uppercase tracking-wider text-brand-inkMute">{lang === 'bn' ? 'পেআউট টেবিল (৩ অভিন্ন)' : 'Paytable (3 of a kind)'}</p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    {cfg.paytable && Object.entries(cfg.paytable).map(([sym, m]) => {
                      const v = (m as Record<string, number>)['3'];
                      return v ? (
                        <li key={sym} className="flex items-center justify-between">
                          <span className="font-semibold text-brand-ink">{glyph(sym)} {sym}</span>
                          <span className="font-mono">{v}x</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </section>

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
        <p className="mt-1 text-sm font-semibold text-brand-ink">{lang === 'bn' ? 'ইনস্ট্যান্ট, প্রভাবলি ফেয়ার' : 'Instant, provably fair'}</p>
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
