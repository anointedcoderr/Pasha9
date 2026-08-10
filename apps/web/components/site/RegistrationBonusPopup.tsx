// Built by Anointed Coder.
//
// Tells a player what is happening with their registration bonus:
//
//   locked   - how much they still need to deposit before it unlocks
//   unlocked - it has been released, and what the winning limit was
//
// Shown to signed-in players only, and only when they actually have one, so it
// can never appear over the registration screen. That was the specific
// complaint about reward popups: they were reaching people with no account.
//
// Each state is announced once per player. The unlocked message is worth
// interrupting for because money has moved; the locked one is a reminder and
// is deliberately dismissible and quiet.

'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Gift, X } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface BonusStatus {
  active: boolean;
  amount: string;
  deposited: string;
  requiredDeposit: string;
  requiredDepositPercent: string;
  depositMet: boolean;
  maxWinning: string;
  locked: string;
  unlocked: boolean;
  cappedAt: string | null;
}

// Per player per state, so an unlock is announced once and never nags again.
function seenKey(state: 'locked' | 'unlocked') {
  return `pasha9_regbonus_${state}_seen`;
}

function hasSeen(state: 'locked' | 'unlocked'): boolean {
  try { return window.localStorage.getItem(seenKey(state)) === '1'; } catch { return false; }
}

function markSeen(state: 'locked' | 'unlocked') {
  try { window.localStorage.setItem(seenKey(state), '1'); } catch { /* storage blocked */ }
}

export function RegistrationBonusPopup() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [bonus, setBonus] = useState<BonusStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'locked' | 'unlocked'>('locked');

  useEffect(() => {
    let alive = true;
    fetch('/api/me/registration-bonus', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const b = d?.bonus as BonusStatus | null | undefined;
        // A 401 gives no bonus, so a signed-out visitor simply never sees this.
        if (!b) return;
        const next = b.unlocked ? 'unlocked' : 'locked';
        if (hasSeen(next)) return;
        setBonus(b);
        setState(next);
        setOpen(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const close = () => {
    markSeen(state);
    setOpen(false);
  };

  if (!bonus) return null;

  const remainingToDeposit = Math.max(
    0,
    Number(bonus.requiredDeposit) - Number(bonus.deposited),
  ).toFixed(2);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brand-divider bg-brand-paper p-5 shadow-xl focus:outline-none">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-grad-yellow text-brand-ink">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </span>
            <Dialog.Close
              className="flex h-9 w-9 items-center justify-center rounded-full text-brand-inkMute hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {state === 'unlocked' ? (
            <>
              <Dialog.Title className="text-lg font-bold text-brand-ink">
                {bn ? 'আপনার বোনাস আনলক হয়েছে' : 'Your bonus is unlocked'}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-brand-inkMute">
                {bn
                  ? `আপনার রেজিস্ট্রেশন বোনাস এখন মূল ব্যালেন্সে যোগ হয়েছে।`
                  : 'Your registration bonus has been added to your main balance.'}
                {bonus.cappedAt ? (
                  <span className="mt-2 block">
                    {bn
                      ? `সর্বোচ্চ ৳${bonus.cappedAt} পর্যন্ত রাখা যায়।`
                      : `The maximum you can keep from this bonus is ${bonus.cappedAt}.`}
                  </span>
                ) : null}
              </Dialog.Description>
            </>
          ) : (
            <>
              <Dialog.Title className="text-lg font-bold text-brand-ink">
                {bn ? 'আপনার রেজিস্ট্রেশন বোনাস অপেক্ষা করছে' : 'Your registration bonus is waiting'}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-brand-inkMute">
                {bn
                  ? `৳${bonus.amount} বোনাস আপনার জন্য রাখা আছে। এটি আনলক করতে আরও ৳${remainingToDeposit} ডিপোজিট করুন।`
                  : `${bonus.amount} is being held for you. Deposit ${remainingToDeposit} more to unlock it.`}
              </Dialog.Description>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-brand-inkMute">{bn ? 'ডিপোজিট করেছেন' : 'Deposited so far'}</dt>
                  <dd className="font-semibold text-brand-ink">{bonus.deposited}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-brand-inkMute">{bn ? 'প্রয়োজন' : 'Required'}</dt>
                  <dd className="font-semibold text-brand-ink">{bonus.requiredDeposit}</dd>
                </div>
                {bonus.cappedAt ? (
                  <div className="flex justify-between">
                    <dt className="text-brand-inkMute">{bn ? 'সর্বোচ্চ জেতা' : 'Maximum you can keep'}</dt>
                    <dd className="font-semibold text-brand-ink">{bonus.cappedAt}</dd>
                  </div>
                ) : null}
              </dl>
              <a
                href="/deposit"
                onClick={close}
                className="btn-yellow mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
              >
                {bn ? 'ডিপোজিট করুন' : 'Deposit now'}
              </a>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
