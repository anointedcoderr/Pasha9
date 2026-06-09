// Built by Anointed Coder.
//
// Celebration modal shown after a winning spin. Renders the prize
// label, a short body line that explains where the reward landed
// (wallet credit, locked bonus, or coins), and a confetti burst made
// of CSS-only animated particles so we do not ship a confetti
// library. Falls back to a static layout when the user has
// prefers-reduced-motion enabled. The modal is dismissible with
// Continue, Escape, or a backdrop tap so it never feels stuck.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, Trophy, X } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export interface SpinResultPayload {
  label: string;
  payoutType: string;
  payoutAmount: number;
}

interface Props {
  open: boolean;
  result: SpinResultPayload | null;
  onClose: () => void;
}

const PARTICLE_COUNT = 36;
const PARTICLE_COLORS = ['#FFCC00', '#F5B400', '#FFE066', '#1E73E8', '#36FF9A', '#FF6B6B'];

function usePrefersReducedMotion(): boolean {
  const ref = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    ref.current = mq.matches;
  }, []);
  return ref.current;
}

export function SpinResultModal({ open, result, onClose }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const reduced = usePrefersReducedMotion();

  const particles = useMemo(() => {
    if (reduced) return [];
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
      // Deterministic spread based on index so we never call
      // Math.random during render (would re-pick on every paint).
      const seed = (i * 9301 + 49297) % 233280;
      const norm = seed / 233280;
      const xJitter = (norm - 0.5) * 240;
      const delay = (i % 8) * 60;
      const duration = 1100 + ((i * 73) % 700);
      const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
      const rotateStart = (i * 47) % 360;
      const rotateEnd = rotateStart + (i % 2 === 0 ? 540 : -540);
      const size = 6 + (i % 4) * 2;
      return { i, xJitter, delay, duration, color, rotateStart, rotateEnd, size };
    });
  }, [reduced]);

  if (!result) return null;

  const isWin = result.payoutAmount > 0;
  const payoutLine = (() => {
    if (!isWin) return bn ? 'পরের বার শুভকামনা!' : 'Better luck next time!';
    if (result.payoutType === 'bonus') {
      return bn
        ? `${result.payoutAmount} বোনাস লকড। উইথড্রয়ের আগে টার্নওভার সম্পূর্ণ করুন।`
        : `${result.payoutAmount} bonus locked. Complete turnover before withdrawal.`;
    }
    if (result.payoutType === 'coins') {
      return bn
        ? `${result.payoutAmount} কয়েন আপনার ব্যালেন্সে যোগ হয়েছে।`
        : `${result.payoutAmount} coins added to your balance.`;
    }
    if (result.payoutType === 'cash' || result.payoutType === 'wallet') {
      return bn
        ? `${result.payoutAmount} টাকা ওয়ালেটে জমা হয়েছে।`
        : `${result.payoutAmount} BDT credited to your wallet.`;
    }
    return bn ? 'পুরস্কার আপনার অ্যাকাউন্টে জমা হয়েছে।' : 'Prize credited to your account.';
  })();

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-1.5rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 bg-[linear-gradient(160deg,#1a1107_0%,#2a1a08_55%,#0f0805_100%)] text-amber-50 shadow-[0_30px_80px_-30px_rgba(245,180,0,0.8)] outline-none"
        >
          <Dialog.Title className="sr-only">
            {isWin
              ? (bn ? 'অভিনন্দন আপনি জিতেছেন' : 'Congratulations you won')
              : (bn ? 'স্পিন ফলাফল' : 'Spin result')}
          </Dialog.Title>

          {/* Confetti layer. Only mounted when motion is allowed and
              the spin actually produced a prize. Particles are pure
              CSS keyframes so the cleanup is free. */}
          {isWin && !reduced ? (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {particles.map((p) => {
                const fallY = 380 + (p.i % 5) * 24;
                const driftX = p.xJitter * (1 + ((p.i % 3) * 0.2));
                return (
                  <span
                    key={p.i}
                    className="absolute left-1/2 top-[18%] block"
                    style={{
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      background: p.color,
                      borderRadius: p.i % 3 === 0 ? '50%' : '2px',
                      // CSS custom properties drive the animation
                      // end point so each particle lands in a unique
                      // spot without spawning a unique keyframe per
                      // particle.
                      ['--pasha-fall' as string]: `${fallY}px`,
                      ['--pasha-drift' as string]: `${driftX}px`,
                      ['--pasha-rot-from' as string]: `${p.rotateStart}deg`,
                      ['--pasha-rot-to' as string]: `${p.rotateEnd}deg`,
                      animation: `pasha9-confetti ${p.duration}ms ease-out ${p.delay}ms forwards`,
                      opacity: 0,
                    }}
                  />
                );
              })}
            </div>
          ) : null}

          <Dialog.Close
            aria-label={bn ? 'বন্ধ' : 'Close'}
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-amber-100 transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          <div className="relative z-[2] px-6 pb-7 pt-9 text-center">
            <span
              className={cn(
                'mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full text-brand-ink shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_8px_22px_-6px_rgba(245,180,0,0.85)]',
                'bg-[linear-gradient(135deg,#FFE066_0%,#FFCC00_55%,#F5B400_100%)]',
              )}
            >
              {isWin ? <Trophy className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
            </span>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
              {isWin
                ? (bn ? 'অভিনন্দন' : 'Congratulations')
                : (bn ? 'স্পিন সম্পন্ন' : 'Spin complete')}
            </p>
            <h2 className="mt-2 break-words text-3xl font-extrabold leading-tight text-amber-100 drop-shadow-[0_3px_12px_rgba(245,180,0,0.45)] md:text-4xl">
              {result.label}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-200/85">
              {payoutLine}
            </p>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                'mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl font-bold uppercase tracking-wider text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_18px_-6px_rgba(245,180,0,0.7)] transition',
                'bg-[linear-gradient(135deg,#FFE066_0%,#FFCC00_55%,#F5B400_100%)] hover:brightness-110 active:scale-[0.98]',
              )}
            >
              {bn ? 'চালিয়ে যান' : 'Continue'}
            </button>
          </div>

          <style jsx>{`
            @keyframes pasha9-confetti {
              0%   { opacity: 0; transform: translate(0, 0) rotate(var(--pasha-rot-from, 0deg)); }
              15%  { opacity: 1; }
              100% {
                opacity: 0;
                transform: translate(var(--pasha-drift, 0px), var(--pasha-fall, 380px))
                           rotate(var(--pasha-rot-to, 360deg));
              }
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
