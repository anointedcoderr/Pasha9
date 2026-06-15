// Built by Anointed Coder.
//
// Premium presentation layer for the Spin tab on /rewards. Pure
// rendering - all data fetching, settlement, wallet refresh logic
// stays in the parent rewards/page.tsx so settlement code is
// untouched.
//
// Exports:
//   SpinStage          - dark cinematic stage frame
//   SpinTierCardRow    - premium passport-style tier selector
//   SpinPremiumWheel   - SpinWheel wrapped with sound + wind-up
//   SpinWinCelebration - staged win modal (replaces SpinResultModal)
//   SpinWinnersMarquee - horizontal live winners ticker

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, X } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useSound } from '@/lib/sounds/client';
import { cn } from '@/lib/utils/cn';
import { HeroBackdrop } from '@/components/premium/HeroBackdrop';
import { TierCrest } from '@/components/premium/TierCrest';
import { CountUp } from '@/components/premium/CountUp';
import { SpinWheel, type SpinWheelSegment } from '@/components/site/SpinWheel';
import { stageVariants, popInVariants, medallionVariants, ribbonUnfurlVariants } from '@/lib/motion/premium';

// ---------- SpinStage ----------

interface StageProps {
  coins: number;
  freeSpinsRemaining: number;
  costPerSpin: number;
  tierLabel: string;
  tierDescription: string;
  children: React.ReactNode;
}

export function SpinStage({ coins, freeSpinsRemaining, costPerSpin, tierLabel, tierDescription, children }: StageProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';

  return (
    <motion.section
      variants={stageVariants}
      initial="hidden"
      animate="show"
      className="pasha-premium relative overflow-hidden rounded-3xl border border-amber-400/30 shadow-[var(--pa-glow-gold)]"
    >
      <HeroBackdrop slot="spin_hero_backdrop" scheme="mahogany" />

      <div className="relative px-5 py-7 md:px-9 md:py-10">
        {/* Brass nameplate at the top */}
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/90">
            <Sparkles className="h-3 w-3" /> {bn ? 'লাকি স্পিন' : 'Royal Spin Cabinet'}
          </span>
          <h2 className="pa-display pa-gold-text text-center text-3xl font-black uppercase leading-none tracking-[0.04em] md:text-4xl">
            {tierLabel}
          </h2>
          <div className="pa-gold-rule w-32" />
          <p className="max-w-md text-center text-[12px] leading-relaxed text-amber-200/80 md:text-[13px]">
            {tierDescription}
          </p>
        </div>

        {/* Balance plaques row */}
        <div className="mt-6 flex flex-wrap items-stretch justify-center gap-2">
          <BrassPlaque
            label={bn ? 'কয়েন' : 'Coins'}
            value={<CountUp to={coins} className="pa-display" />}
          />
          <BrassPlaque
            label={bn ? 'ফ্রি স্পিন' : 'Free spins'}
            value={<span className="pa-display">{freeSpinsRemaining}</span>}
            accent="emerald"
          />
          <BrassPlaque
            label={bn ? 'প্রতি স্পিন' : 'Per spin'}
            value={<span className="pa-display">{costPerSpin}</span>}
            accent="ruby"
          />
        </div>

        {/* Stage interior */}
        <div className="mt-7 flex flex-col items-center gap-4">
          {children}
        </div>

        {/* Fair-play disclosure. Required wording per compliance
            engineering brief - the operator is allowed to mark wedges
            as display-only and players must be told this can happen.
            The line stays small and unobtrusive at the bottom of the
            stage so the cabinet still reads premium. */}
        <p className="mt-6 text-center text-[10px] leading-relaxed text-amber-200/55">
          {bn
            ? 'বিজয়ের সম্ভাবনা ওয়েট-ভিত্তিক। কিছু পুরস্কার সময়ে সময়ে অপারেটর কর্তৃক ডিসপ্লে-অনলি হিসেবে চিহ্নিত হতে পারে।'
            : 'Prize odds are weight-based. Some prizes may be marked as display-only by the operator from time to time.'}
        </p>
      </div>
    </motion.section>
  );
}

function BrassPlaque({ label, value, accent }: { label: string; value: React.ReactNode; accent?: 'emerald' | 'ruby' }) {
  return (
    <div className="pa-brass-plate inline-flex min-w-[112px] flex-col items-center rounded-xl px-4 py-2.5">
      <span className={cn(
        'text-[10px] font-bold uppercase tracking-[0.18em]',
        accent === 'emerald' ? 'text-emerald-900/70' : accent === 'ruby' ? 'text-rose-900/70' : 'text-amber-900/80',
      )}>
        {label}
      </span>
      <span className="text-xl font-black leading-tight tabular-nums text-[#3a1f00]">
        {value}
      </span>
    </div>
  );
}

// ---------- SpinTierCardRow ----------

export interface SpinTierCardData {
  id: string;
  key: string;
  nameEn: string;
  nameBn: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  costPerSpin: number;
  freeSpinsPerDay: number;
}

interface TierRowProps {
  tiers: SpinTierCardData[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  coinBalance: number;
  freeRemainingByTier: Record<string, number>;
}

// Map the tier index to a crest "world". Operator can ship 3 tiers
// or fewer; index-based mapping keeps every tier visually distinct.
function crestFor(index: number): 'lucky' | 'royal' | 'supreme' {
  if (index === 0) return 'lucky';
  if (index === 1) return 'royal';
  return 'supreme';
}

export function SpinTierCardRow({ tiers, selectedKey, onSelect, coinBalance, freeRemainingByTier }: TierRowProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const ui = useSound('ui_click');

  if (tiers.length === 0) return null;

  return (
    <div className="pasha-premium grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((t, i) => {
        const active = t.key === selectedKey;
        const insufficient = coinBalance < t.costPerSpin;
        const free = freeRemainingByTier[t.key] ?? 0;
        const crest = crestFor(i);
        const name = bn && t.nameBn ? t.nameBn : t.nameEn;
        const description = (bn && t.descriptionBn) ? t.descriptionBn : (t.descriptionEn ?? '');

        return (
          <motion.button
            key={t.id}
            type="button"
            variants={popInVariants}
            initial="hidden"
            animate="show"
            onClick={() => { ui.play(); onSelect(t.key); }}
            aria-pressed={active}
            className={cn(
              'pa-shine-trigger group relative overflow-hidden rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
              active
                ? 'border-amber-300 shadow-[0_18px_44px_-22px_rgba(245,180,0,0.85)]'
                : 'border-amber-400/20 hover:border-amber-300/60',
            )}
            style={{ background: 'var(--pa-grad-mahogany)' }}
          >
            <span className="pa-shine" aria-hidden />
            {/* corner ribbon if active */}
            {active ? (
              <span className="absolute -right-8 top-3 z-10 rotate-45 bg-amber-400 px-10 py-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-[#3a1f00] shadow">
                {bn ? 'সক্রিয়' : 'Active'}
              </span>
            ) : null}

            <div className="relative flex items-center gap-3">
              <TierCrest tier={crest} size={64} />
              <div className="min-w-0 flex-1">
                <p className="pa-display pa-gold-text truncate text-base font-black uppercase tracking-wider">
                  {name}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">
                  {t.costPerSpin} {bn ? 'কয়েন / স্পিন' : 'coins per spin'}
                </p>
              </div>
            </div>

            {description ? (
              <p className="relative mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-amber-100/75">
                {description}
              </p>
            ) : null}

            <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-200">
                {bn ? `প্রতিদিন ${t.freeSpinsPerDay} ফ্রি` : `${t.freeSpinsPerDay} free / day`}
              </span>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2 py-0.5 font-bold uppercase tracking-wider text-emerald-200">
                {bn ? `অবশিষ্ট ${free}` : `${free} left`}
              </span>
              {insufficient ? (
                <span className="rounded-full border border-rose-300/40 bg-rose-300/10 px-2 py-0.5 font-bold uppercase tracking-wider text-rose-200">
                  {bn ? 'কয়েন কম' : 'Low coins'}
                </span>
              ) : null}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ---------- SpinPremiumWheel ----------

interface WheelProps {
  segments: SpinWheelSegment[];
  spinning: boolean;
  landingIndex: number | null;
  onLandingComplete: () => void;
  disabled: boolean;
  onSpinClick: () => void;
}

export function SpinPremiumWheel({ segments, spinning, landingIndex, onLandingComplete, disabled, onSpinClick }: WheelProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const windup = useSound('spin_windup');
  const tick = useSound('spin_tick');
  const land = useSound('spin_land');
  const prevSpinning = useRef(spinning);

  // Manage sound choreography across the spin lifecycle.
  useEffect(() => {
    if (spinning && !prevSpinning.current) {
      windup.play();
      tick.play({ loop: true });
    } else if (!spinning && prevSpinning.current) {
      tick.stop();
      land.play();
    }
    prevSpinning.current = spinning;
  }, [spinning, windup, tick, land]);

  return (
    <div className="pasha-premium relative flex flex-col items-center">
      {/* Spotlight glow behind the wheel */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 mx-auto h-[360px] w-[360px] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(245,200,80,0.18), transparent 70%)' }}
      />
      <SpinWheel
        segments={segments}
        spinning={spinning}
        landingIndex={landingIndex}
        onLandingComplete={onLandingComplete}
        disabled={disabled}
        onSpinClick={onSpinClick}
        centerLabel={bn ? 'স্পিন' : 'SPIN'}
        size={340}
      />
    </div>
  );
}

// ---------- SpinWinCelebration ----------

export interface SpinResultPayload {
  label: string;
  payoutType: string;
  payoutAmount: number;
}

interface WinProps {
  open: boolean;
  result: SpinResultPayload | null;
  isJackpot: boolean;
  onClose: () => void;
}

export function SpinWinCelebration({ open, result, isJackpot, onClose }: WinProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const winSound = useSound('spin_win');
  const jackpotSound = useSound('spin_jackpot');
  const lossSound = useSound('spin_loss');
  const playedRef = useRef(false);

  useEffect(() => {
    if (!open || !result) { playedRef.current = false; return; }
    if (playedRef.current) return;
    playedRef.current = true;
    if (result.payoutAmount <= 0) {
      lossSound.play();
    } else if (isJackpot) {
      // jackpotSound auto-falls back to winSound if the slot is empty
      // (no-op when slot URL is null, then winSound covers it).
      jackpotSound.play();
      winSound.play();
    } else {
      winSound.play();
    }
  }, [open, result, isJackpot, winSound, jackpotSound, lossSound]);

  if (!result) return null;
  const isWin = result.payoutAmount > 0;

  const headline = isWin
    ? (isJackpot ? (bn ? 'জ্যাকপট!' : 'JACKPOT') : (bn ? 'অভিনন্দন' : 'Congratulations'))
    : (bn ? 'পরের বার শুভকামনা' : 'Better luck next spin');

  const payoutLine = (() => {
    if (!isWin) return bn ? 'আবার চেষ্টা করুন। ফ্রি স্পিন এখনও আছে।' : 'Spin again. Free spins still available.';
    if (result.payoutType === 'bonus') {
      return bn
        ? `${result.payoutAmount} বোনাস লকড। উইথড্রয়ের আগে টার্নওভার সম্পূর্ণ করুন।`
        : `${result.payoutAmount} bonus locked. Complete turnover before withdrawal.`;
    }
    if (result.payoutType === 'coins') {
      return bn ? `${result.payoutAmount} কয়েন যোগ হয়েছে।` : `${result.payoutAmount} coins added.`;
    }
    return bn ? 'পুরস্কার আপনার অ্যাকাউন্টে জমা হয়েছে।' : 'Prize credited to your account.';
  })();

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="pasha-premium fixed left-1/2 top-1/2 z-[71] w-[calc(100%-1.5rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 shadow-[0_40px_100px_-30px_rgba(245,180,0,0.85)] outline-none"
          style={{ background: 'var(--pa-grad-mahogany)' }}
        >
          <Dialog.Title className="sr-only">{headline}</Dialog.Title>

          {/* Stage lights */}
          <span aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/35 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-rose-400/30 blur-3xl" />
          <div className="pa-dust" />

          <Dialog.Close
            aria-label={bn ? 'বন্ধ' : 'Close'}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-amber-100 transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          <div className="relative z-[2] flex flex-col items-center px-6 pb-8 pt-10 text-center">
            {/* Medallion */}
            <motion.div variants={medallionVariants} initial="hidden" animate="show">
              <TierCrest tier={isJackpot ? 'supreme' : (isWin ? 'royal' : 'lucky')} size={120} />
            </motion.div>

            {/* Ribbon */}
            <AnimatePresence>
              {isWin ? (
                <motion.div
                  variants={ribbonUnfurlVariants}
                  initial="hidden"
                  animate="show"
                  className="relative mt-5"
                  style={{ transformOrigin: 'center' }}
                >
                  <div
                    className="pa-brass-plate rounded-xl px-5 py-2"
                    style={{ background: 'var(--pa-grad-gold-rich)' }}
                  >
                    <p className="pa-display text-[11px] font-bold uppercase tracking-[0.32em] text-[#3a1f00]">
                      {headline}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.28em] text-amber-200/85">
                  {headline}
                </p>
              )}
            </AnimatePresence>

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="pa-display pa-gold-text mt-4 break-words text-4xl font-black leading-tight md:text-5xl"
            >
              {result.label}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32, duration: 0.4 }}
              className="mt-3 max-w-sm text-sm leading-relaxed text-amber-100/85"
            >
              {payoutLine}
            </motion.p>

            <motion.button
              type="button"
              onClick={onClose}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="pa-display pa-brass-plate mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-black uppercase tracking-[0.28em] text-[#3a1f00] active:scale-[0.985]"
              style={{ background: 'var(--pa-grad-gold-rich)' }}
            >
              {bn ? 'চালিয়ে যান' : 'Continue'}
            </motion.button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------- SpinWinnersMarquee ----------

interface MarqueeRow {
  id: string;
  maskedName: string;
  segmentLabel: string;
  payoutAmount: number;
  tierKey: string | null;
  tierNameEn: string | null;
  tierNameBn: string | null;
  createdAt: string;
}

export function SpinWinnersMarquee({ tierKey, refreshKey }: { tierKey?: string | null; refreshKey?: number }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [rows, setRows] = useState<MarqueeRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const qs = tierKey ? `?tierKey=${encodeURIComponent(tierKey)}` : '';
    fetch(`/api/content/spin-winners${qs}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setRows(Array.isArray(j?.winners) ? (j.winners as MarqueeRow[]) : []); })
      .catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [tierKey, refreshKey]);

  // Duplicate the row list so the marquee loops smoothly.
  const stream = useMemo(() => {
    if (!rows || rows.length === 0) return [] as MarqueeRow[];
    return [...rows, ...rows];
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <div className="pasha-premium rounded-2xl border border-amber-400/20 bg-black/30 px-4 py-3 text-center text-[11px] text-amber-200/70">
        {bn ? 'আজ এখনো কোনো বিজয়ী নেই। প্রথম জনপ্রিয় হোন!' : 'No winners yet today. Be the first.'}
      </div>
    );
  }

  return (
    <div className="pasha-premium relative overflow-hidden rounded-2xl border border-amber-400/20 bg-black/30">
      <div className="pa-marquee flex w-max gap-2 py-2.5 pl-2">
        {stream.map((w, i) => (
          <span
            key={`${w.id}-${i}`}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-300/5 px-3 py-1 text-[11px] text-amber-100/90"
          >
            <Trophy className="h-3 w-3 text-amber-300" />
            <span className="font-semibold">{w.maskedName}</span>
            {w.tierNameEn ? (
              <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                {bn && w.tierNameBn ? w.tierNameBn : w.tierNameEn}
              </span>
            ) : null}
            <span className="pa-display font-bold tracking-wider text-amber-200">{w.segmentLabel}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
