// Built by Anointed Coder.
//
// Win popup for the Lotto page. Mirrors the SpinWinCelebration look
// (mahogany backdrop, gold ribbon, large prize tally, Continue button)
// but takes lotto winning fields. Opens automatically when the parent
// /lotto page detects a new winning row.

'use client';

import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trophy } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';

const TIER_LABEL: Record<string, { en: string; bn: string }> = {
  first_exact: { en: '1st Prize (exact)', bn: '১ম পুরস্কার (এক্সাক্ট)' },
  first_ibox: { en: '1st Prize (iBox)', bn: '১ম পুরস্কার (আইবক্স)' },
  second: { en: '2nd Prize', bn: '২য় পুরস্কার' },
  third: { en: '3rd Prize', bn: '৩য় পুরস্কার' },
  special: { en: 'Special Prize', bn: 'বিশেষ পুরস্কার' },
  consolation: { en: 'Consolation Prize', bn: 'সান্ত্বনা পুরস্কার' },
};

export interface LottoWin {
  id: string;
  ticketNumber: string;
  prizeTier: string;
  amount: number;
  winningNumber?: string | null;
}

interface Props {
  open: boolean;
  win: LottoWin | null;
  totalWinnings?: number;
  onClose: () => void;
}

export function LottoWinCelebration({ open, win, totalWinnings, onClose }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const playedRef = useRef(false);

  useEffect(() => {
    if (!open || !win) { playedRef.current = false; return; }
    if (playedRef.current) return;
    playedRef.current = true;
    if (typeof window !== 'undefined' && typeof window.navigator?.vibrate === 'function') {
      window.navigator.vibrate?.([60, 50, 90]);
    }
  }, [open, win]);

  if (!win) return null;

  const tier = TIER_LABEL[win.prizeTier] ?? { en: 'Prize', bn: 'পুরস্কার' };
  const tierLabel = bn ? tier.bn : tier.en;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-1.5rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 shadow-[0_40px_100px_-30px_rgba(245,180,0,0.85)] outline-none"
          style={{ background: 'linear-gradient(180deg,#5a3a1d 0%,#2a1a10 100%)' }}
        >
          <Dialog.Title className="sr-only">
            {bn ? 'অভিনন্দন' : 'Congratulations'}
          </Dialog.Title>

          {/* Stage lights */}
          <span aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/35 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-amber-400/25 blur-3xl" />

          <Dialog.Close
            aria-label={bn ? 'বন্ধ' : 'Close'}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-amber-100 transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          <div className="relative z-[2] flex flex-col items-center px-6 pb-7 pt-9 text-center">
            {/* Trophy medallion */}
            <div className="relative">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-amber-300/70 shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_8px_28px_-8px_rgba(245,180,0,0.65)]"
                style={{ background: 'radial-gradient(circle at 30% 30%, #fbd66a 0%, #c98c10 70%)' }}
              >
                <Trophy className="h-12 w-12 text-[#3a1f00]" strokeWidth={2.4} />
              </div>
            </div>

            {/* Congratulations ribbon */}
            <div className="relative mt-5">
              <div
                className="rounded-xl px-5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_12px_-4px_rgba(245,180,0,0.55)]"
                style={{ background: 'linear-gradient(180deg,#fbd66a 0%,#d99a17 100%)' }}
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-[#3a1f00]">
                  {bn ? 'অভিনন্দন' : 'Congratulations'}
                </p>
              </div>
            </div>

            {/* Tier */}
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-200/85">
              {tierLabel}
            </p>

            {/* Prize amount */}
            <p className="mt-2 text-4xl font-extrabold tabular-nums text-amber-200 sm:text-5xl">
              {formatBDT(win.amount)}
            </p>

            {/* Ticket details */}
            <div className="mt-4 inline-flex items-baseline gap-2 rounded-lg border border-amber-300/30 bg-black/35 px-3 py-1.5 text-xs">
              <span className="font-bold uppercase tracking-wider text-amber-200/70">
                {bn ? 'টিকিট' : 'Ticket'}:
              </span>
              <span className="font-extrabold tabular-nums text-amber-100">{win.ticketNumber}</span>
              {win.winningNumber ? (
                <>
                  <span className="text-amber-200/40">/</span>
                  <span className="font-bold uppercase tracking-wider text-amber-200/70">
                    {bn ? 'জয়ী' : 'Winning'}:
                  </span>
                  <span className="font-extrabold tabular-nums text-amber-100">{win.winningNumber}</span>
                </>
              ) : null}
            </div>

            {/* Helper line */}
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-amber-200/75">
              {bn
                ? 'পুরস্কার আপনার লটো ওয়ালেটে যুক্ত হয়েছে। মেইন ওয়ালেটে স্থানান্তর করতে নিচের “দাবি” বোতাম ব্যবহার করুন।'
                : 'Prize credited to your Lotto Wallet. Tap Claim below to transfer it to your main wallet.'}
            </p>

            {totalWinnings != null && totalWinnings > win.amount ? (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
                {bn ? 'মোট অপরিচিত জয়' : 'Total pending'}: {formatBDT(totalWinnings)}
              </p>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-extrabold uppercase tracking-[0.18em] text-[#3a1f00] shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_8px_18px_-8px_rgba(245,180,0,0.75)] transition active:translate-y-px"
              style={{ background: 'linear-gradient(180deg,#fbd66a 0%,#d99a17 100%)' }}
            >
              {bn ? 'চালিয়ে যান' : 'Continue'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
