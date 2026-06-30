// Built by Anointed Coder.
//
// Pasha Crash - premium game page. Phase 1 ships the safer turn-
// based variant: player declares the auto-cashout target up-front,
// server reveals the crashPoint, settles instantly.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useNativeGame } from '@/lib/native-games/use-native-game';
import { GameShell, GamePanel, GamePanelTitle } from '@/components/native-games/GameShell';
import { BetCard } from '@/components/native-games/BetCard';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';
import { safeNumber, safeToFixed } from '@/lib/native-games/safe';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Rocket, Trophy } from 'lucide-react';

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
  const [history, setHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);

  const betNumber = useMemo(() => safeNumber(bet, 0), [bet]);
  const targetNumber = useMemo(() => safeNumber(target, minTarget), [target, minTarget]);
  const projectedPayout = useMemo(() => betNumber * targetNumber, [betNumber, targetNumber]);

  useEffect(() => {
    if (!last) return;
    setHistory((prev) => [safeNumber(last.crashPoint, 1), ...prev].slice(0, 14));
  }, [last]);

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
    if (ng.balance != null && amount > ng.balance) {
      setDepositOpen(true);
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
        if (isInsufficientFundsError(data)) {
          setDepositOpen(true);
          ng.refreshBalance();
          return;
        }
        setError(data?.message ?? data?.code ?? 'Round failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const raw = (data ?? {}) as Partial<CrashResult>;
      const safe: CrashResult = {
        roundId: typeof raw.roundId === 'string' ? raw.roundId : `local-${Date.now()}`,
        win: Boolean(raw.win),
        multiplier: safeNumber(raw.multiplier, 0),
        payout: safeNumber(raw.payout, 0),
        newBalance: safeNumber(raw.newBalance, 0),
        crashPoint: safeNumber(raw.crashPoint, 1),
        targetMultiplier: safeNumber(raw.targetMultiplier, tgt),
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
      code="crash"
      titleEn="Pasha Crash"
      titleBn="পাশা ক্র্যাশ"
      taglineEn="Set your target. Reveal the crash point. Take the multiplier if you survive it."
      taglineBn="লক্ষ্য সেট করুন। ক্র্যাশ পয়েন্ট প্রকাশ করুন। লক্ষ্যের আগে ক্র্যাশ না হলে গুণিতক জিতবেন।"
      ctaLabelEn="Start Round"
      ctaLabelBn="রাউন্ড শুরু"
      accent="sapphire"
      ng={ng}
      rules={<CrashRules lang={lang} />}
    >
      {/* Screen-reader announcement of the latest round result. Visually
          hidden; polite so it does not interrupt other speech. */}
      <div aria-live="polite" className="sr-only">
        {last
          ? last.win
            ? (lang === 'bn' ? `আপনি জিতেছেন ${formatBDT(last.payout)}` : `You won ${formatBDT(last.payout)}`)
            : (lang === 'bn' ? 'আপনি হেরেছেন' : 'You lost')
          : ''}
      </div>

      {/* Curve + crash point display */}
      <GamePanel className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_50%_30%,rgba(58,134,255,0.15),transparent_60%)]" />
        <div className="relative">
          <svg viewBox="0 0 320 180" className="h-44 w-full md:h-56" aria-hidden>
            <defs>
              <linearGradient id="c-curve" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFE9A0" />
                <stop offset="100%" stopColor="#FFB400" />
              </linearGradient>
              <linearGradient id="c-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,200,69,0.4)" />
                <stop offset="100%" stopColor="rgba(255,200,69,0)" />
              </linearGradient>
            </defs>
            {/* grid */}
            <g stroke="rgba(80,140,255,0.12)" strokeWidth="0.8">
              {Array.from({ length: 5 }).map((_, i) => (<line key={`h${i}`} x1="0" y1={36 + i * 32} x2="320" y2={36 + i * 32} />))}
              {Array.from({ length: 7 }).map((_, i) => (<line key={`v${i}`} x1={20 + i * 50} y1="0" x2={20 + i * 50} y2="180" />))}
            </g>
            <line x1="0" y1="160" x2="320" y2="160" stroke="rgba(58,134,255,0.5)" strokeWidth="1.5" />
            {last ? (
              <g key={animKey}>
                <path d="M 10 160 Q 110 158 170 110 T 290 22" fill="url(#c-fill)" />
                <path
                  d="M 10 160 Q 110 158 170 110 T 290 22"
                  fill="none"
                  stroke="url(#c-curve)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="png-curve-draw"
                />
                <circle cx="290" cy="22" r="6" fill="#FFE9A0" className="png-glow" />
              </g>
            ) : null}
          </svg>

          <div className="mt-3 grid place-items-center">
            <div
              className={cn(
                'inline-flex flex-col items-center rounded-2xl border px-6 py-4 text-center backdrop-blur',
                last
                  ? last.win
                    ? 'border-amber-400/50 bg-amber-400/10 png-win'
                    : 'border-rose-400/40 bg-rose-500/10 png-loss'
                  : 'border-white/10 bg-white/5',
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
                {lang === 'bn' ? 'ক্র্যাশ পয়েন্ট' : 'Crash point'}
              </span>
              <span
                className={cn(
                  'mt-1 text-5xl font-extrabold tabular-nums md:text-6xl',
                  !last && 'text-white/30',
                  last?.win && 'text-amber-200',
                  last && !last.win && 'text-rose-300',
                )}
              >
                {last ? `${safeToFixed(last.crashPoint, 2)}x` : '0.00x'}
              </span>
              {last ? (
                <span className={cn('mt-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider', last.win ? 'text-amber-200' : 'text-rose-200')}>
                  <Trophy className="h-3.5 w-3.5" />
                  {last.win
                    ? lang === 'bn' ? `+${formatBDT(last.payout)} . ${safeToFixed(last.targetMultiplier, 2)}x` : `+${formatBDT(last.payout)} . ${safeToFixed(last.targetMultiplier, 2)}x`
                    : lang === 'bn' ? 'লক্ষ্যের আগে ক্র্যাশ' : 'Crashed before target'}
                </span>
              ) : (
                <span className="mt-1 text-xs text-white/40">{lang === 'bn' ? 'লক্ষ্য সেট করে শুরু করুন' : 'Set a target to start'}</span>
              )}
            </div>
          </div>
        </div>
      </GamePanel>

      {/* Target picker */}
      <GamePanel>
        <GamePanelTitle hint={`${minTarget}x - ${maxTarget}x`}>
          {lang === 'bn' ? 'অটো ক্যাশআউট লক্ষ্য' : 'Auto-cashout target'}
        </GamePanelTitle>
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={minTarget}
              max={maxTarget}
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label={lang === 'bn' ? 'অটো ক্যাশআউট লক্ষ্য' : 'Auto-cashout target'}
              className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-base font-extrabold text-white outline-none focus:border-amber-400/60"
            />
            <span className="text-sm font-bold text-white/55">x</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1.5, 2, 3, 5, 10].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTarget(v.toFixed(2))}
                className={cn(
                  'h-10 min-w-[52px] rounded-lg border px-3 text-xs font-extrabold transition',
                  targetNumber === v
                    ? 'border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00]'
                    : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10',
                )}
              >
                {v.toFixed(2)}x
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">{lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'}</p>
          <p className="mt-0.5 text-2xl font-extrabold text-amber-100">{formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}</p>
        </div>
        {error ? <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p> : null}
      </GamePanel>

      {/* Recent crash points */}
      {history.length > 0 ? (
        <GamePanel>
          <GamePanelTitle>{lang === 'bn' ? 'সাম্প্রতিক ক্র্যাশ' : 'Recent crash points'}</GamePanelTitle>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto scrollbar-none">
            {history.map((cp, i) => (
              <span
                key={i}
                className={cn(
                  'shrink-0 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-extrabold tabular-nums',
                  cp >= 2 ? 'border-amber-400/40 bg-amber-400/15 text-amber-100' : 'border-rose-400/30 bg-rose-500/10 text-rose-200',
                )}
              >
                {safeToFixed(cp, 2)}x
              </span>
            ))}
          </div>
        </GamePanel>
      ) : null}

      <BetCard
        bet={bet}
        setBet={setBet}
        minBet={minBet}
        maxBet={maxBet}
        balance={ng.balance}
        playLabel={lang === 'bn' ? 'রাউন্ড শুরু' : 'Start round'}
        onPlay={onPlace}
        loading={loading}
        disabled={!ng.session}
        hint={`${lang === 'bn' ? 'লক্ষ্য' : 'Target'} ${safeToFixed(targetNumber, 2)}x`}
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

function CrashRules({ lang }: { lang: 'bn' | 'en' }) {
  if (lang === 'bn') {
    return (
      <ul className="list-disc space-y-2 pl-5">
        <li>রাউন্ড শুরুর আগেই অটো ক্যাশআউট লক্ষ্য বেছে নিন (১.০১x - ১০০x)।</li>
        <li>সার্ভার HMAC-SHA256 দিয়ে ক্র্যাশ পয়েন্ট জেনারেট করে।</li>
        <li>ক্র্যাশ পয়েন্ট লক্ষ্যের চেয়ে বেশি বা সমান হলে জয়, পেআউট = বেট × লক্ষ্য।</li>
        <li>এই সংস্করণটি ইনস্ট্যান্ট-সেটল (টার্ন-বেইজড) যাতে ওয়ালেট নিরাপদ থাকে।</li>
      </ul>
    );
  }
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>Pick your auto-cashout target (1.01x - 100x) before the round.</li>
      <li>The server generates the crash point via HMAC-SHA256.</li>
      <li>If the crash point is at or above your target, you win bet * target.</li>
      <li>This phase ships as instant-settle (turn-based) for wallet safety.</li>
    </ul>
  );
}
