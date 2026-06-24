// Built by Anointed Coder.
//
// Premium presentation layer for the Lotto pages.
//
// Exports:
//   LottoHeroPremium   - dark sapphire hero with jackpot + countdown
//   LottoFlipCountdown - split-flap mechanical clock
//   LottoBallTumbler   - animated ball reveal for the winning number
//   LottoWinningChips  - enamel chip display for winning digits
//   LottoTicketCardPremium - physical-feeling ticket card
//   LottoCertificateCard   - certificate-styled winning record card
//   LottoResultMosaic  - calendar mosaic of historic results

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown, Ticket, Sparkles, Trophy } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useSound } from '@/lib/sounds/client';
import { cn } from '@/lib/utils/cn';
import { HeroBackdrop } from '@/components/premium/HeroBackdrop';
import { CountUp } from '@/components/premium/CountUp';
import { FlipDigit } from '@/components/premium/FlipDigit';
import { LotteryBall } from '@/components/premium/LotteryBall';
import { stageVariants, popInVariants } from '@/lib/motion/premium';
import { formatBDT } from '@/lib/utils/format';

// ---------- LottoFlipCountdown ----------

interface FlipCountdownProps {
  drawsAt: string | null;
}

function splitTimeUntil(drawsAt: string | null): { h: string; m: string; s: string; expired: boolean } {
  if (!drawsAt) return { h: '--', m: '--', s: '--', expired: true };
  const ms = new Date(drawsAt).getTime() - Date.now();
  if (ms <= 0) return { h: '00', m: '00', s: '00', expired: true };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return { h: pad(h), m: pad(m), s: pad(s), expired: false };
}

export function LottoFlipCountdown({ drawsAt }: FlipCountdownProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [time, setTime] = useState(() => splitTimeUntil(drawsAt));

  useEffect(() => {
    setTime(splitTimeUntil(drawsAt));
    const id = window.setInterval(() => setTime(splitTimeUntil(drawsAt)), 1000);
    return () => window.clearInterval(id);
  }, [drawsAt]);

  const urgent = !time.expired && Number(time.h) === 0 && Number(time.m) < 1;

  // Split each two-digit pair into individual tiles so we can flip
  // only the digit that just changed. The whole row flips when both
  // digits change at minute boundaries.
  const [h1, h2] = time.h.split('');
  const [m1, m2] = time.m.split('');
  const [s1, s2] = time.s.split('');

  return (
    <div className={cn('pasha-premium inline-flex items-end gap-2', urgent && 'animate-pulse')}>
      <div className="flex items-end gap-1">
        <FlipDigit value={h1} size="md" />
        <FlipDigit value={h2} size="md" label={bn ? 'ঘণ্টা' : 'HRS'} />
      </div>
      <span className="pa-display pb-3 text-3xl font-black text-amber-300/70">:</span>
      <div className="flex items-end gap-1">
        <FlipDigit value={m1} size="md" />
        <FlipDigit value={m2} size="md" label={bn ? 'মিনিট' : 'MIN'} />
      </div>
      <span className="pa-display pb-3 text-3xl font-black text-amber-300/70">:</span>
      <div className="flex items-end gap-1">
        <FlipDigit value={s1} size="md" />
        <FlipDigit value={s2} size="md" label={bn ? 'সেকেন্ড' : 'SEC'} />
      </div>
    </div>
  );
}

// ---------- LottoHeroPremium ----------

interface HeroProps {
  jackpot: number;
  ticketBase: number;
  drawsAt: string | null;
  schedule?: string | null;
  children?: React.ReactNode;
}

export function LottoHeroPremium({ jackpot, ticketBase, drawsAt, schedule, children }: HeroProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';

  return (
    <motion.section
      variants={stageVariants}
      initial="hidden"
      animate="show"
      className="pasha-premium relative overflow-hidden rounded-3xl border border-amber-400/25 shadow-[var(--pa-glow-gold)]"
    >
      <HeroBackdrop slot="lotto_hero_backdrop" scheme="sapphire" />

      <div className="relative px-5 py-7 md:px-9 md:py-10">
        <div className="grid gap-7 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/90">
              <Sparkles className="h-3 w-3" /> {bn ? 'ডেইলি 4D লটারি' : 'Daily 4D Draw'}
            </span>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/70">
              {bn ? 'বর্তমান জ্যাকপট' : 'Tonight jackpot'}
            </p>
            <p className="pa-display pa-gold-text mt-1 inline-flex items-baseline gap-3 text-5xl font-black leading-none drop-shadow-[0_4px_18px_rgba(245,180,0,0.45)] md:text-6xl">
              <CountUp to={jackpot} prefix="৳" durationMs={1600} />
            </p>
            <p className="mt-3 text-[12px] text-amber-100/85">
              {bn
                ? `টিকেট মূল্য ৳${ticketBase}. ${schedule ?? 'প্রতিদিন সন্ধ্যা ৭:৩০টা'}`
                : `Ticket base ৳${ticketBase}. ${schedule ?? 'Drawn every day at 7:30 PM BST'}`}
            </p>
            {children ? <div className="mt-4">{children}</div> : null}
          </div>

          {/* Countdown column */}
          <div className="flex flex-col items-center md:items-end">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/70">
              {bn ? 'পরবর্তী ড্র' : 'Next draw in'}
            </p>
            <LottoFlipCountdown drawsAt={drawsAt} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// ---------- LottoBallTumbler ----------

interface TumblerProps {
  /** The 4-digit winning number to reveal. */
  number: string;
  /** Auto-animate on mount when true. */
  animate?: boolean;
}

export function LottoBallTumbler({ number, animate = true }: TumblerProps) {
  const digits = number.split('').slice(0, 4);
  const [revealed, setRevealed] = useState<number>(animate ? 0 : digits.length);
  const tumbler = useSound('lotto_tumbler');
  const pop = useSound('lotto_ball_pop');
  const reveal = useSound('lotto_reveal');

  useEffect(() => {
    if (!animate) return;
    setRevealed(0);
    tumbler.play();
    const intervals: number[] = [];
    digits.forEach((_, i) => {
      const id = window.setTimeout(() => {
        setRevealed(i + 1);
        pop.play();
        if (i === digits.length - 1) reveal.play();
      }, 800 + i * 420);
      intervals.push(id);
    });
    return () => {
      intervals.forEach((id) => window.clearTimeout(id));
    };
  }, [number, animate]); // eslint-disable-line react-hooks/exhaustive-deps

  const colors: Array<'gold' | 'silver' | 'bronze' | 'emerald'> = ['gold', 'silver', 'bronze', 'emerald'];

  return (
    <div className="pasha-premium relative inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/25 px-4 py-4" style={{ background: 'var(--pa-grad-sapphire)' }}>
      {digits.map((d, i) => (
        <motion.div
          key={`${number}-${i}`}
          variants={popInVariants}
          initial="hidden"
          animate={revealed > i ? 'show' : 'hidden'}
          transition={{ delay: animate ? 0.1 : 0 }}
        >
          <LotteryBall color={colors[i % colors.length]} digit={d} size={56} />
        </motion.div>
      ))}
    </div>
  );
}

// ---------- LottoWinningChips ----------

/**
 * Compact chip row used inside result history cards. No animation,
 * no sound - just an elegant static representation of the digits.
 */
export function LottoWinningChips({ number, size = 'md' }: { number: string; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 36 : size === 'lg' ? 64 : 48;
  const colors: Array<'gold' | 'silver' | 'bronze' | 'emerald'> = ['gold', 'silver', 'bronze', 'emerald'];
  return (
    <div className="pasha-premium inline-flex gap-1.5">
      {number.split('').slice(0, 4).map((d, i) => (
        <LotteryBall key={i} color={colors[i % colors.length]} digit={d} size={px} />
      ))}
    </div>
  );
}

// ---------- LottoTicketCardPremium ----------

interface TicketProps {
  id: string;
  number: string;
  drawName: string | null;
  drawAt: string | null;
  status: string;
  won?: boolean;
  prize?: number | null;
  index?: number;
}

export function LottoTicketCardPremium({ number, drawName, drawAt, status, won, prize, index = 0 }: TicketProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const stampSound = useSound('lotto_stamp');
  const printSound = useSound('lotto_ticket_print');
  const stampPlayedRef = useRef(false);

  useEffect(() => {
    if (index === 0) printSound.play();
    if (won && !stampPlayedRef.current) {
      stampPlayedRef.current = true;
      window.setTimeout(() => stampSound.play(), 600);
    }
  }, [index, won, printSound, stampSound]);

  return (
    <motion.article
      variants={popInVariants}
      initial="hidden"
      animate="show"
      custom={index}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
      className="pasha-premium relative isolate"
    >
      {/* Outer card with perforated left edge */}
      <div className="relative grid grid-cols-[20px_1fr] overflow-hidden rounded-xl border border-amber-400/30 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.6)]" style={{ background: 'var(--pa-grad-mahogany)' }}>
        {/* Perforated stub edge */}
        <div className="relative">
          <span aria-hidden className="absolute inset-y-0 right-0 w-px bg-amber-400/30" />
          <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-around">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="block h-1.5 w-1.5 rounded-full bg-black/60" />
            ))}
          </div>
        </div>

        {/* Ticket body */}
        <div className="relative px-4 py-3">
          {/* Holographic strip across the top */}
          <span aria-hidden className="pa-holo pointer-events-none absolute inset-x-0 top-0 h-3" />

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-300/85">
                {bn ? 'টিকেট' : 'Ticket'}
              </p>
              <p className="pa-display pa-gold-text mt-1 text-3xl font-black leading-none tracking-[0.08em]">
                {number}
              </p>
              <p className="mt-2 text-[10px] text-amber-200/70">
                {drawName ?? (bn ? 'অপেক্ষমান ড্র' : 'Pending draw')}
              </p>
              {drawAt ? <p className="text-[10px] text-amber-200/60">{new Date(drawAt).toLocaleString()}</p> : null}
            </div>
            <span className="rounded-full border border-amber-400/40 bg-amber-300/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200">
              {status === 'won'
                ? (bn ? 'জিতেছে' : 'Won')
                : status === 'lost'
                  ? (bn ? 'হেরেছে' : 'Lost')
                  : status === 'void' || status === 'voided'
                    ? (bn ? 'বাতিল' : 'Voided')
                    : status === 'used'
                      ? (bn ? 'ব্যবহৃত' : 'Used')
                      : (bn ? 'ড্রয়ের অপেক্ষায়' : 'Pending draw')}
            </span>
          </div>

          {won ? (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
                {bn ? 'জিতেছে' : 'Won'}
              </span>
              {prize != null ? (
                <span className="pa-display text-base font-black text-emerald-200">
                  {formatBDT(prize)}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* WINNER stamp overlay */}
          {won ? (
            <motion.span
              aria-hidden
              initial={{ opacity: 0, scale: 1.6, rotate: -8 }}
              animate={{ opacity: 0.85, scale: 1, rotate: -8 }}
              transition={{ delay: 0.5, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="pa-display pointer-events-none absolute -right-2 top-2 inline-flex rotate-[-12deg] items-center justify-center rounded-md border-2 border-rose-500/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.32em] text-rose-300"
              style={{
                background: 'rgba(60, 8, 12, 0.15)',
                boxShadow: 'inset 0 0 0 1px rgba(255,80,90,0.25)',
              }}
            >
              {bn ? 'বিজয়ী' : 'WINNER'}
            </motion.span>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

// ---------- LottoCertificateCard ----------

interface CertificateProps {
  ticketNumber: string;
  prizeTier: string;
  amount: number;
  date: string;
  winningNumber: string;
  index?: number;
}

export function LottoCertificateCard({ ticketNumber, prizeTier, amount, date, winningNumber, index = 0 }: CertificateProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';

  return (
    <motion.article
      variants={popInVariants}
      initial="hidden"
      animate="show"
      transition={{ delay: Math.min(index * 0.05, 0.6) }}
      className="pasha-premium relative overflow-hidden rounded-2xl border-2 border-amber-300/55 p-5 shadow-[0_18px_44px_-22px_rgba(245,180,0,0.55)]"
      style={{ background: 'var(--pa-grad-mahogany)' }}
    >
      {/* Decorative corners */}
      <span aria-hidden className="absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-amber-300/70" />
      <span aria-hidden className="absolute right-2 top-2 h-5 w-5 border-r-2 border-t-2 border-amber-300/70" />
      <span aria-hidden className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-amber-300/70" />
      <span aria-hidden className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-amber-300/70" />

      <div className="relative">
        <p className="pa-display pa-gold-text text-center text-[11px] font-black uppercase tracking-[0.4em]">
          {bn ? 'পাশা ৯ লটারি বিজয়পত্র' : 'Pasha 9 Lottery Certificate'}
        </p>
        <div className="pa-gold-rule mx-auto mt-2 w-40" />

        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/70">
          {bn ? 'পুরস্কারের পরিমাণ' : 'Prize amount'}
        </p>
        <p className="pa-display pa-gold-text mt-1 text-center text-4xl font-black leading-none">
          {formatBDT(amount)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">
              {bn ? 'বিজয়ী নম্বর' : 'Winning'}
            </p>
            <p className="pa-display mt-1 text-2xl font-black tracking-[0.18em] text-amber-100">
              {winningNumber}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">
              {bn ? 'আপনার টিকেট' : 'Your ticket'}
            </p>
            <p className="pa-display mt-1 text-2xl font-black tracking-[0.18em] text-amber-100">
              {ticketNumber}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-amber-300/30 pt-3 text-[10px] text-amber-200/70">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 font-bold uppercase tracking-[0.18em]">
            {prizeTier}
          </span>
          <span>{new Date(date).toLocaleDateString()}</span>
        </div>
      </div>
    </motion.article>
  );
}

// ---------- LottoResultMosaic ----------

interface MosaicCell {
  id: string;
  drawsAt: string | null;
  publishedAt: string;
  winningNumber: string;
  totalWinners: number;
  totalPaid: number;
}

export function LottoResultMosaic({ results }: { results: MosaicCell[] }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [expanded, setExpanded] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <div className="pasha-premium rounded-2xl border border-amber-400/20 bg-black/30 px-4 py-6 text-center text-[12px] text-amber-200/70">
        {bn
          ? 'প্রথম ফলাফলের জন্য অপেক্ষা করুন।'
          : 'No results yet - the first winning number will appear here as soon as it is published.'}
      </div>
    );
  }

  // Group by date string. Each cell shows the day's winning number.
  return (
    <div className="pasha-premium space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
        {results.map((r) => {
          const isExpanded = expanded === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setExpanded(isExpanded ? null : r.id)}
              aria-expanded={isExpanded}
              className={cn(
                'group relative overflow-hidden rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60',
                isExpanded
                  ? 'border-amber-300 shadow-[0_12px_28px_-14px_rgba(245,180,0,0.65)]'
                  : 'border-amber-400/20 hover:border-amber-300/60',
              )}
              style={{ background: 'var(--pa-grad-sapphire)' }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-200/70">
                {new Date(r.publishedAt).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}
              </p>
              <p className="pa-display mt-1.5 text-2xl font-black tracking-[0.18em] text-amber-100">
                {r.winningNumber}
              </p>
              <p className="mt-1 text-[10px] text-amber-200/65">
                {r.totalWinners} {bn ? 'বিজয়ী' : 'won'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
