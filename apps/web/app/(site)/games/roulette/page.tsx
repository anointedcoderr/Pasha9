// Built by Anointed Coder.
//
// Pasha Roulette - premium game page. European single zero. Result
// number + colour comes from /api/native-games/roulette/bet; the
// wheel animation is purely cosmetic.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useNativeGame } from '@/lib/native-games/use-native-game';
import { GameShell, GamePanel, GamePanelTitle } from '@/components/native-games/GameShell';
import { BetCard } from '@/components/native-games/BetCard';
import { DepositRequiredModal, isInsufficientFundsError } from '@/components/native-games/DepositRequiredModal';
import { safeNumber, safeToFixed } from '@/lib/native-games/safe';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Trophy } from 'lucide-react';

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
function colorOf(n: number): 'red' | 'black' | 'green' { return n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black'; }

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
  const [spinning, setSpinning] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  const projectedMultiplier = useMemo(() => (betType === 'straight' ? 36 : 2), [betType]);
  const betNumber = useMemo(() => safeNumber(bet, 0), [bet]);
  const projectedPayout = useMemo(() => betNumber * projectedMultiplier, [betNumber, projectedMultiplier]);

  const onSpin = async () => {
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
    setError(null); setLoading(true); setSpinning(true);
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
        if (isInsufficientFundsError(data)) {
          setDepositOpen(true);
          ng.refreshBalance();
          return;
        }
        setError(data?.message ?? data?.code ?? 'Spin failed');
        if (data?.code === 'SESSION_INACTIVE') ng.newSession();
        return;
      }
      const raw = (data ?? {}) as Partial<RouletteResult>;
      const colorRaw = typeof raw.resultColor === 'string' ? raw.resultColor : 'green';
      const resultColor: RouletteResult['resultColor'] = colorRaw === 'red' || colorRaw === 'black' ? colorRaw : 'green';
      const safe: RouletteResult = {
        roundId: typeof raw.roundId === 'string' ? raw.roundId : `local-${Date.now()}`,
        win: Boolean(raw.win),
        multiplier: safeNumber(raw.multiplier, 0),
        payout: safeNumber(raw.payout, 0),
        newBalance: safeNumber(raw.newBalance, 0),
        result: Math.max(0, Math.min(36, Math.round(safeNumber(raw.result, 0)))),
        resultColor,
        reused: Boolean(raw.reused),
      };
      setLast(safe);
      ng.bumpNonce();
      ng.refreshBalance();
    } catch { setError('Could not reach server'); }
    finally { setLoading(false); }
  };

  // End wheel-spin class shortly after the result lands.
  useEffect(() => {
    if (!spinning) return;
    const id = window.setTimeout(() => setSpinning(false), 1500);
    return () => window.clearTimeout(id);
  }, [spinning, last]);

  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 10_000;

  return (
    <GameShell
      code="roulette"
      titleEn="Pasha Roulette"
      titleBn="পাশা রুলেট"
      taglineEn="European single zero. Red, black, straight - your call."
      taglineBn="ইউরোপীয় সিঙ্গেল জিরো। রেড, ব্ল্যাক, সরাসরি - আপনার ইচ্ছা।"
      ctaLabelEn="Spin the Wheel"
      ctaLabelBn="হুইল ঘোরান"
      accent="red"
      ng={ng}
      rules={<RouletteRules lang={lang} />}
    >
      {/* Result + wheel */}
      <GamePanel className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_50%_40%,rgba(214,40,40,0.20),transparent_60%)]" />
        <div className="relative grid place-items-center py-4">
          <div ref={wheelRef} className={cn('relative grid h-44 w-44 place-items-center md:h-52 md:w-52', spinning && 'png-wheel')}>
            <Wheel />
            <span
              className={cn(
                'absolute inline-flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-extrabold text-white shadow-2xl ring-4 ring-black/30 md:h-20 md:w-20 md:text-3xl',
                last
                  ? last.resultColor === 'red' ? 'bg-red-600 border-red-300' : last.resultColor === 'black' ? 'bg-black border-white/30' : 'bg-emerald-600 border-emerald-200'
                  : 'bg-black/60 border-white/20',
              )}
            >
              {last ? last.result : '?'}
            </span>
          </div>
          {last ? (
            <p className={cn('mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-extrabold uppercase tracking-wider', last.win ? 'bg-amber-400/20 text-amber-100' : 'bg-white/5 text-white/70')}>
              <Trophy className="h-4 w-4" />
              {last.win ? `+${formatBDT(last.payout)} . ${safeToFixed(last.multiplier, 2)}x` : (lang === 'bn' ? 'হার' : 'No win')}
            </p>
          ) : null}
        </div>
      </GamePanel>

      {/* Bet selector */}
      <GamePanel>
        <GamePanelTitle>{lang === 'bn' ? 'বেট ধরন' : 'Bet type'}</GamePanelTitle>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          <ChoiceBtn active={betType === 'red'} onClick={() => setBetType('red')} tone="red">{lang === 'bn' ? 'রেড' : 'Red'}</ChoiceBtn>
          <ChoiceBtn active={betType === 'black'} onClick={() => setBetType('black')} tone="black">{lang === 'bn' ? 'ব্ল্যাক' : 'Black'}</ChoiceBtn>
          <ChoiceBtn active={betType === 'odd'} onClick={() => setBetType('odd')} tone="white">{lang === 'bn' ? 'বিজোড়' : 'Odd'}</ChoiceBtn>
          <ChoiceBtn active={betType === 'even'} onClick={() => setBetType('even')} tone="white">{lang === 'bn' ? 'জোড়' : 'Even'}</ChoiceBtn>
          <ChoiceBtn active={betType === 'low'} onClick={() => setBetType('low')} tone="white">{lang === 'bn' ? '১-১৮' : '1-18'}</ChoiceBtn>
          <ChoiceBtn active={betType === 'high'} onClick={() => setBetType('high')} tone="white">{lang === 'bn' ? '১৯-৩৬' : '19-36'}</ChoiceBtn>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{lang === 'bn' ? 'সরাসরি নম্বর (৩৫:১)' : 'Straight number (35:1)'}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBetType('straight')}
              className={cn(
                'h-10 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition',
                betType === 'straight' ? 'border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00]' : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
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
              aria-label={lang === 'bn' ? 'সরাসরি নম্বর' : 'Straight number'}
              className="h-10 w-24 rounded-lg border border-white/15 bg-white/5 px-3 text-base font-extrabold text-white outline-none focus:border-amber-400/60"
            />
            <span
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white',
                colorOf(straight) === 'red' ? 'bg-red-600' : colorOf(straight) === 'black' ? 'bg-black border border-white/30' : 'bg-emerald-600',
              )}
            >
              {straight}
            </span>
            <span className="text-xs text-white/55">0 - 36</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <Stat label={lang === 'bn' ? 'পেআউট' : 'Payout'} value={`${projectedMultiplier}x`} />
          <Stat label={lang === 'bn' ? 'সম্ভাব্য জয়' : 'Potential win'} value={formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)} accent />
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </GamePanel>

      <BetCard
        bet={bet}
        setBet={setBet}
        minBet={minBet}
        maxBet={maxBet}
        balance={ng.balance}
        playLabel={lang === 'bn' ? 'স্পিন' : 'Spin'}
        onPlay={onSpin}
        loading={loading}
        disabled={!ng.session}
        hint={`${lang === 'bn' ? 'জিতলে' : 'Win'}: ${formatBDT(Number.isFinite(projectedPayout) ? projectedPayout : 0)}`}
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

function Wheel() {
  // 12-segment stylized wheel (compact). All visuals; the spin result
  // is server-decided and shown in the central plate.
  const segs = Array.from({ length: 12 });
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="r-gold" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFE9A0" />
          <stop offset="100%" stopColor="#8C5F00" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#r-gold)" />
      {segs.map((_, i) => {
        const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
        const x0 = 100 + 86 * Math.cos(a0);
        const y0 = 100 + 86 * Math.sin(a0);
        const x1 = 100 + 86 * Math.cos(a1);
        const y1 = 100 + 86 * Math.sin(a1);
        const fill = i === 0 ? '#1B1E25' : i % 2 === 1 ? '#D62828' : '#1B1E25';
        return (
          <path
            key={i}
            d={`M 100 100 L ${x0} ${y0} A 86 86 0 0 1 ${x1} ${y1} Z`}
            fill={fill}
            stroke="rgba(255,213,84,0.4)"
            strokeWidth="0.6"
          />
        );
      })}
      <circle cx="100" cy="100" r="34" fill="url(#r-gold)" stroke="#7A4F00" strokeWidth="2" />
    </svg>
  );
}

function ChoiceBtn({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: 'red' | 'black' | 'white'; children: React.ReactNode }) {
  const base = 'h-12 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60';
  const activeMap = {
    red: 'border-red-300 bg-gradient-to-b from-red-400 to-red-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
    black: 'border-white/40 bg-gradient-to-b from-zinc-700 to-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]',
    white: 'border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]',
  };
  return (
    <button type="button" onClick={onClick} className={cn(base, active ? activeMap[tone] : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10')}>
      {children}
    </button>
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

function RouletteRules({ lang }: { lang: 'bn' | 'en' }) {
  if (lang === 'bn') {
    return (
      <ul className="list-disc space-y-2 pl-5">
        <li>ইউরোপীয় সিঙ্গেল জিরো হুইল (০-৩৬)। ১/৩৭ হাউস এজ।</li>
        <li>ইভেন-মানি বাজি (রেড/ব্ল্যাক, জোড়/বিজোড়, ১-১৮/১৯-৩৬) ১:১ পেআউট দেয়।</li>
        <li>সরাসরি নম্বর বাজি (০-৩৬) ৩৫:১ পেআউট দেয়।</li>
        <li>সার্ভার HMAC-SHA256 দিয়ে ফলাফল ঠিক করে। ক্লায়েন্ট শুধু রেন্ডার করে।</li>
      </ul>
    );
  }
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>European single-zero wheel (0-36). 1/37 house edge.</li>
      <li>Even-money bets (red/black, odd/even, 1-18/19-36) pay 1:1.</li>
      <li>Straight number bet (0-36) pays 35:1.</li>
      <li>The server decides the result via HMAC-SHA256. The client only renders.</li>
    </ul>
  );
}
