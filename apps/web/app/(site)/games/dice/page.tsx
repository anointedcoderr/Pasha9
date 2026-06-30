// Built by Anointed Coder.
//
// Pasha Dice - premium game page. Bet + roll, instant settle via the
// existing /api/native-games/dice/bet endpoint. UI handles the
// animation + microinteractions; the result number itself comes from
// the server every time.

'use client';

import { useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useNativeGame } from '@/lib/native-games/use-native-game';
import { GameShell, GamePanel, GamePanelTitle } from '@/components/native-games/GameShell';
import { BetCard } from '@/components/native-games/BetCard';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { safeNumber, safeToFixed } from '@/lib/native-games/safe';

interface DiceResult {
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

interface RecentBet extends DiceResult {
  target: number;
  direction: 'over' | 'under';
  bet: number;
  at: number;
}

export default function DicePage() {
  const { lang } = useLang();
  const ng = useNativeGame('dice');

  const [bet, setBet] = useState<string>('10');
  const [target, setTarget] = useState<number>(50);
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [last, setLast] = useState<DiceResult | null>(null);
  const [history, setHistory] = useState<RecentBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);

  const winChancePct = useMemo(() => (direction === 'over' ? 100 - target : target), [direction, target]);
  const houseEdgeBps = ng.game?.houseEdgeBps ?? 200;
  const retention = (10_000 - houseEdgeBps) / 10_000;
  const fairMultiplier = winChancePct > 0 ? 100 / winChancePct : 0;
  const projectedMultiplier = fairMultiplier * retention;
  const projectedPayout = Number(bet) * projectedMultiplier;

  const onRoll = async () => {
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
      const res = await fetch('/api/native-games/dice/bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: ng.session.id, target, direction, betAmount: amount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (isInsufficientFundsError(data)) {
          setDepositOpen(true);
          ng.refreshBalance();
          return;
        }
        setError(data?.message ?? data?.code ?? 'Roll failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      // Defensive: coerce every numeric field. Decimal columns can
      // occasionally serialize as strings, and the page must never
      // hand a non-finite number to .toFixed().
      const raw = (data ?? {}) as Partial<DiceResult>;
      const r: DiceResult = {
        roundId: typeof raw.roundId === 'string' ? raw.roundId : `local-${Date.now()}`,
        outcome: raw.outcome === 'WIN' ? 'WIN' : 'LOSS',
        result: safeNumber(raw.result, 0),
        multiplier: safeNumber(raw.multiplier, 0),
        payout: safeNumber(raw.payout, 0),
        win: Boolean(raw.win),
        winChancePct: safeNumber(raw.winChancePct, 0),
        newBalance: safeNumber(raw.newBalance, 0),
        nonce: safeNumber(raw.nonce, 0),
        reused: Boolean(raw.reused),
      };
      setLast(r);
      setAnimKey((k) => k + 1);
      ng.bumpNonce();
      ng.refreshBalance();
      setHistory((prev) => [{ ...r, target, direction, bet: amount, at: Date.now() }, ...prev].slice(0, 14));
    } catch {
      setError('Could not reach server');
    } finally { setLoading(false); }
  };

  const game = ng.game;
  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 10_000;

  return (
    <GameShell
      code="dice"
      titleEn="Pasha Dice"
      titleBn="পাশা ডাইস"
      taglineEn="Pick a target. Roll over or under. Instant settle."
      taglineBn="লক্ষ্য বাছাই করুন। কম বা বেশি রোল করুন। সাথে সাথে সেটল।"
      ctaLabelEn="Roll the Dice"
      ctaLabelBn="ডাইস রোল করুন"
      accent="royal"
      ng={ng}
      rules={<DiceRules lang={lang} />}
    >
      {/* Screen-reader announcement of the latest roll result. Visually
          hidden; polite so it does not interrupt other speech. */}
      <div aria-live="polite" className="sr-only">
        {last
          ? last.win
            ? (lang === 'bn' ? `আপনি জিতেছেন ${formatBDT(last.payout)}` : `You won ${formatBDT(last.payout)}`)
            : (lang === 'bn' ? 'আপনি হেরেছেন' : 'You lost')
          : ''}
      </div>

      {/* Result display */}
      <GamePanel className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_50%_30%,rgba(255,200,69,0.18),transparent_60%)]" />
        <div className="relative grid place-items-center py-6 md:py-8">
          <div
            key={animKey}
            className={cn(
              'relative inline-flex flex-col items-center rounded-3xl border border-white/10 bg-black/40 px-8 py-6 backdrop-blur md:px-12 md:py-7',
              last?.win && 'png-win',
              last && !last.win && 'png-loss',
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
              {lang === 'bn' ? 'ফলাফল' : 'Roll result'}
            </span>
            <span
              className={cn(
                'mt-1 text-6xl font-extrabold tabular-nums tracking-tight md:text-7xl',
                !last && 'text-white/30',
                last?.win && 'text-amber-300',
                last && !last.win && 'text-rose-300',
              )}
            >
              {last ? safeToFixed(last.result, 2) : '00.00'}
            </span>
            {last ? (
              <span className={cn('mt-1 text-xs font-bold uppercase tracking-wider', last.win ? 'text-amber-200' : 'text-rose-200')}>
                {last.win
                  ? lang === 'bn' ? `+${formatBDT(last.payout)} . ${safeToFixed(last.multiplier, 4)}x` : `+${formatBDT(last.payout)} . ${safeToFixed(last.multiplier, 4)}x`
                  : lang === 'bn' ? 'হার' : 'Bust'}
              </span>
            ) : (
              <span className="mt-1 text-xs text-white/40">{lang === 'bn' ? 'প্রথম রোলের অপেক্ষায়' : 'Waiting for first roll'}</span>
            )}
          </div>
        </div>
      </GamePanel>

      {/* Controls */}
      <GamePanel>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <GamePanelTitle hint={lang === 'bn' ? '২ থেকে ৯৮' : '2 to 98'}>
              {lang === 'bn' ? `লক্ষ্য ${target}` : `Target ${target}`}
            </GamePanelTitle>
            <input
              type="range"
              min={2}
              max={98}
              step={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              aria-label={lang === 'bn' ? 'লক্ষ্য নম্বর' : 'Target number'}
              className="w-full accent-amber-400"
            />
            <div className="mt-1 grid grid-cols-3 text-[10px] text-white/45">
              <span>2</span>
              <span className="text-center">50</span>
              <span className="text-right">98</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <DirBtn
                active={direction === 'under'}
                onClick={() => setDirection('under')}
                tone="sapphire"
              >
                &lt; {lang === 'bn' ? 'কম' : 'Under'}
              </DirBtn>
              <DirBtn
                active={direction === 'over'}
                onClick={() => setDirection('over')}
                tone="amber"
              >
                {lang === 'bn' ? 'বেশি' : 'Over'} &gt;
              </DirBtn>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <GamePanelTitle>{lang === 'bn' ? 'বেট পূর্বরূপ' : 'Bet preview'}</GamePanelTitle>
            <div className="grid grid-cols-2 gap-3">
              <Stat label={lang === 'bn' ? 'জয়ের সম্ভাবনা' : 'Win chance'} value={`${safeToFixed(winChancePct, 2)}%`} />
              <Stat label={lang === 'bn' ? 'গুণিতক' : 'Multiplier'} value={`${safeToFixed(projectedMultiplier, 4)}x`} />
            </div>
            <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">{lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'}</p>
              <p className="mt-0.5 text-2xl font-extrabold text-amber-100">{formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}</p>
            </div>
            {error ? <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </GamePanel>

      {/* Bet card (sticky on mobile) */}
      <BetCard
        bet={bet}
        setBet={setBet}
        minBet={minBet}
        maxBet={maxBet}
        balance={ng.balance}
        playLabel={lang === 'bn' ? 'রোল' : 'Roll'}
        onPlay={onRoll}
        loading={loading}
        disabled={!ng.session}
        hint={`${lang === 'bn' ? 'জিতলে' : 'Win'}: ${formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}`}
      />

      {/* History */}
      {history.length > 0 ? (
        <GamePanel>
          <GamePanelTitle>{lang === 'bn' ? 'সাম্প্রতিক রোল' : 'Recent rolls'}</GamePanelTitle>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto scrollbar-none">
            {history.map((h) => (
              <span
                key={h.roundId}
                className={cn(
                  'shrink-0 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-extrabold tabular-nums',
                  h.win ? 'border-amber-400/40 bg-amber-400/15 text-amber-100' : 'border-rose-400/30 bg-rose-500/10 text-rose-200',
                )}
                title={`${h.direction.toUpperCase()} ${h.target} . ${formatBDT(h.bet)}`}
              >
                {safeToFixed(h.result, 2)}
              </span>
            ))}
          </div>
        </GamePanel>
      ) : null}

      <DepositRequiredModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        balance={ng.balance}
        requiredAmount={Number(bet)}
      />
    </GameShell>
  );
}

function DirBtn({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: 'sapphire' | 'amber'; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-14 rounded-xl border text-base font-extrabold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2',
        active
          ? tone === 'amber'
            ? 'border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_20px_-8px_rgba(245,180,0,0.7)] focus-visible:ring-amber-300/60'
            : 'border-sky-400 bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_20px_-8px_rgba(58,134,255,0.7)] focus-visible:ring-sky-300/60'
          : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold text-white">{value}</p>
    </div>
  );
}

function DiceRules({ lang }: { lang: 'bn' | 'en' }) {
  if (lang === 'bn') {
    return (
      <ul className="list-disc space-y-2 pl-5">
        <li>সার্ভার ০.০০ থেকে ৯৯.৯৯ এর মধ্যে একটি নম্বর জেনারেট করে।</li>
        <li>লক্ষ্য বাছাই করুন (২-৯৮)। &quot;বেশি&quot; বাছাই করলে ফলাফল লক্ষ্যের চেয়ে বেশি হলে জয়, &quot;কম&quot; বাছাই করলে ফলাফল লক্ষ্যের চেয়ে কম হলে জয়।</li>
        <li>গুণিতক = ১০০ / জয়ের সম্ভাবনা, হাউস এজ বাদ দিয়ে।</li>
        <li>প্রভাবলি ফেয়ার: প্রতিটি রাউন্ড HMAC-SHA256 দিয়ে তৈরি, যা আপনি নিজে যাচাই করতে পারবেন।</li>
      </ul>
    );
  }
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>The server picks a number from 0.00 to 99.99.</li>
      <li>Pick a target (2-98). Choose Over to win when result &gt; target, or Under to win when result &lt; target.</li>
      <li>Multiplier = 100 / win chance, minus the house edge.</li>
      <li>Provably fair: every roll is HMAC-SHA256 derived and verifiable by you after the session closes.</li>
    </ul>
  );
}
