// Built by Anointed Coder.
//
// Colour-tinted bet bottom sheet. Slides up from the bottom on mobile,
// centred card on desktop. Tinted to the chosen selection so the player
// always sees what they are backing. Contents: quick amounts
// (1/10/100/1000), a quantity stepper (X1..X100), the live total, an
// agree-to-rules gate and a total-amount confirm button. All money
// bounds shown here are also enforced server-side on placement; the UI
// only mirrors them.

'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import {
  QUICK_AMOUNTS,
  QUANTITY_CHIPS,
  COLOR_BUTTON,
  selectionLabel,
  SELECTION_HEADLINE,
  type WingoBetType,
} from './ui';
import { WingoBall } from './WingoBall';

// Persisted acceptance of the bet rules. Once the player agrees a single
// time we remember it so every future slip is pre-accepted and they are
// never asked again (cleared on logout by the Header and blocked-account
// forced logout).
const RULES_ACCEPTED_KEY = 'pasha9:wingo_rules_accepted';

function readRulesAccepted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RULES_ACCEPTED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistRulesAccepted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RULES_ACCEPTED_KEY, '1');
  } catch {
    /* swallow */
  }
}

export interface WingoSelection {
  betType: WingoBetType;
  selection: string;
}

interface Props {
  open: boolean;
  selection: WingoSelection | null;
  initialQuantity?: number;
  minStake: number;
  maxStake: number;
  balance: number | null;
  locked: boolean; // round no longer open for betting
  submitting: boolean;
  onClose: () => void;
  onConfirm: (stake: number, quantity: number) => void;
}

// Tint (border/glow) per selection so the sheet reads as the colour or
// the ball the player tapped.
function tintFor(sel: WingoSelection | null): { border: string; head: string } {
  if (!sel) return { border: 'border-amber-400/40', head: 'from-[#2a1810] to-[#120a06]' };
  if (sel.betType === 'color') {
    if (sel.selection === 'green') return { border: 'border-emerald-400/50', head: 'from-[#08301f] to-[#06140d]' };
    if (sel.selection === 'red') return { border: 'border-rose-400/50', head: 'from-[#310a12] to-[#160608]' };
    if (sel.selection === 'violet') return { border: 'border-violet-400/50', head: 'from-[#25103a] to-[#120818]' };
  }
  if (sel.betType === 'size') {
    return sel.selection === 'big'
      ? { border: 'border-amber-400/50', head: 'from-[#30220a] to-[#160f06]' }
      : { border: 'border-sky-400/50', head: 'from-[#0a2438] to-[#061018]' };
  }
  return { border: 'border-amber-400/50', head: 'from-[#2a1810] to-[#120a06]' };
}

export function WingoBetSheet({ open, selection, initialQuantity = 1, minStake, maxStake, balance, locked, submitting, onClose, onConfirm }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';

  const [stake, setStake] = useState<number>(minStake > 0 ? Math.max(1, minStake) : 1);
  const [quantity, setQuantity] = useState<number>(1);
  // Seed acceptance from storage so a returning player is never re-asked.
  const [agreed, setAgreed] = useState<boolean>(() => readRulesAccepted());

  // Reset on each open so a fresh slip never inherits stale numbers. The
  // rules acceptance is intentionally NOT reset to false: it is re-read
  // from storage so a previously accepted player stays accepted.
  useEffect(() => {
    if (open) {
      setStake(Math.max(1, minStake));
      setQuantity(Math.min(100, Math.max(1, initialQuantity)));
      setAgreed(readRulesAccepted());
    }
  }, [open, minStake, initialQuantity]);

  const tint = tintFor(selection);
  const total = useMemo(() => Math.max(0, Math.round(stake)) * quantity, [stake, quantity]);
  const overMax = total > maxStake;
  const underMin = stake < minStake;
  const overBalance = balance != null && total > balance;
  const canConfirm = !locked && !submitting && agreed && !overMax && !underMin && total > 0 && !overBalance;

  const headline = selection ? SELECTION_HEADLINE[selection.betType === 'number' ? 'number' : selection.selection] ?? 0 : 0;
  const potential = total * headline;

  if (!selection) return null;
  const label = selectionLabel(selection.betType, selection.selection, lang);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-md overflow-hidden rounded-t-3xl border bg-[#0d0a12] text-white outline-none',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl',
            'wingo-sheet-in',
            tint.border,
          )}
        >
          {/* Tinted header */}
          <div className={cn('relative bg-gradient-to-b px-5 pb-4 pt-5', tint.head)}>
            <button
              type="button"
              onClick={onClose}
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 hover:bg-black/50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              {selection.betType === 'number' ? (
                <WingoBall n={Number(selection.selection)} size={44} asBadge />
              ) : (
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-xs font-black uppercase text-white shadow-inner"
                  style={{
                    background:
                      selection.betType === 'color'
                        ? COLOR_BUTTON[selection.selection as 'green' | 'red' | 'violet']?.grad
                        : selection.selection === 'big'
                          ? 'linear-gradient(180deg,#f6b73c,#a15c0a)'
                          : 'linear-gradient(180deg,#4aa8ff,#0a4a8f)',
                  }}
                >
                  {label.slice(0, 3)}
                </span>
              )}
              <div>
                <Dialog.Title className="text-lg font-black leading-tight">{label}</Dialog.Title>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                  {bn ? 'সম্ভাব্য রিটার্ন' : 'Return'} {headline}x
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-5 py-4">
            {/* Quick amounts */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
                {bn ? 'পরিমাণ' : 'Amount'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setStake(a)}
                    aria-pressed={stake === a}
                    className={cn(
                      'h-11 min-w-[44px] rounded-xl border px-2 text-sm font-extrabold tabular-nums transition-transform duration-150 ease-out active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50',
                      stake === a
                        ? 'border-amber-300/80 bg-gradient-to-b from-amber-300/30 to-amber-500/15 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_-6px_rgba(245,180,0,0.6)]'
                        : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3">
                <span className="text-[10px] font-bold uppercase text-white/45">BDT</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={minStake}
                  value={String(stake)}
                  onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  aria-label={bn ? 'বাজির পরিমাণ' : 'Stake amount'}
                  className="h-11 w-full bg-transparent text-right text-base font-extrabold text-white outline-none"
                />
              </div>
            </div>

            {/* Quantity stepper */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
                {bn ? 'গুণিতক' : 'Quantity'}
              </p>
              <div className="flex items-center gap-2">
                <StepBtn ariaLabel={bn ? 'কমান' : 'Decrease'} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </StepBtn>
                <span className="grid h-11 flex-1 place-items-center rounded-xl border border-white/15 bg-white/5 text-base font-black tabular-nums text-white">
                  X{quantity}
                </span>
                <StepBtn ariaLabel={bn ? 'বাড়ান' : 'Increase'} onClick={() => setQuantity((q) => Math.min(100, q + 1))}>
                  <Plus className="h-4 w-4" />
                </StepBtn>
              </div>
              <div className="mt-2 grid grid-cols-6 gap-1.5">
                {QUANTITY_CHIPS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    aria-pressed={quantity === q}
                    className={cn(
                      'h-11 rounded-lg border px-1 text-xs font-bold tabular-nums transition-transform duration-150 ease-out active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50',
                      quantity === q
                        ? 'border-amber-300/80 bg-gradient-to-b from-amber-300/30 to-amber-500/15 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_-6px_rgba(245,180,0,0.6)]'
                        : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10',
                    )}
                  >
                    X{q}
                  </button>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">{bn ? 'মোট বাজি' : 'Total stake'}</span>
                <span className="font-extrabold tabular-nums text-white">{formatBDT(total)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-white/60">{bn ? 'সম্ভাব্য জয়' : 'Potential win'}</span>
                <span className="font-extrabold tabular-nums text-amber-200">{formatBDT(potential)}</span>
              </div>
            </div>

            {/* Validation messages */}
            {overMax ? (
              <p role="alert" className="text-xs font-semibold text-rose-300">
                {bn
                  ? `এক লাইনের সর্বোচ্চ ${formatBDT(maxStake)}। পরিমাণ বা গুণিতক কমান।`
                  : `Max ${formatBDT(maxStake)} per line. Lower the amount or quantity.`}
              </p>
            ) : null}
            {underMin ? (
              <p role="alert" className="text-xs font-semibold text-rose-300">
                {bn ? `সর্বনিম্ন বাজি ${formatBDT(minStake)}।` : `Minimum stake is ${formatBDT(minStake)}.`}
              </p>
            ) : null}
            {overBalance && !overMax ? (
              <p role="alert" className="text-xs font-semibold text-rose-300">
                {bn ? 'ওয়ালেট ব্যালেন্স যথেষ্ট নয়।' : 'Not enough wallet balance.'}
              </p>
            ) : null}
            {locked ? (
              <p role="alert" className="text-xs font-semibold text-rose-300">
                {bn ? 'বাজি বন্ধ। পরের রাউন্ডের অপেক্ষা করুন।' : 'Betting is closed. Wait for the next round.'}
              </p>
            ) : null}

            {/* Agree to rules */}
            <label className="flex items-start gap-2.5 text-xs text-white/70">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAgreed(next);
                  if (next) persistRulesAccepted();
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
              />
              <span>
                {bn
                  ? 'আমি বাজির নিয়ম মেনে নিচ্ছি এবং জানি ফলাফল সার্ভারে জেনারেট হয়।'
                  : 'I agree to the game rules and understand the result is generated on the server.'}
              </span>
            </label>

            {/* Confirm */}
            <button
              type="button"
              onClick={() => { persistRulesAccepted(); onConfirm(Math.round(stake), quantity); }}
              disabled={!canConfirm}
              className={cn(
                'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-base font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_22px_-8px_rgba(245,180,0,0.7)] transition',
                'hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 active:translate-y-px',
                !canConfirm && 'opacity-50',
              )}
            >
              {submitting
                ? bn ? 'জমা হচ্ছে...' : 'Placing...'
                : `${bn ? 'নিশ্চিত করুন' : 'Confirm'} ${formatBDT(total)}`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepBtn({ children, onClick, ariaLabel }: { children: React.ReactNode; onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
    >
      {children}
    </button>
  );
}
