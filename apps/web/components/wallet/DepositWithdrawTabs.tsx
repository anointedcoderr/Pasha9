// Built by Anointed Coder.
//
// Cashier tab bar shown at the top of /deposit and /withdraw. Both
// labels stay readable at all times. The active tab gets a gold pill
// and the inactive tab keeps a high-contrast ink colour against the
// brand-paper surface. Earlier rev used a deep ink fill with low-alpha
// white text which read as a blank dark strip on mobile.

'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export interface DepositWithdrawTabsProps {
  active: 'deposit' | 'withdraw';
  className?: string;
}

export function DepositWithdrawTabs({ active, className }: DepositWithdrawTabsProps) {
  const t = useT();
  return (
    <div
      role="tablist"
      aria-label="Cashier"
      className={cn(
        'mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-brand-divider bg-brand-paper p-1 shadow-sm',
        className,
      )}
    >
      <Link
        role="tab"
        aria-selected={active === 'deposit'}
        href="/deposit"
        className={cn(
          'relative inline-flex h-11 items-center justify-center rounded-xl text-sm font-extrabold uppercase tracking-wider transition',
          active === 'deposit'
            ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_10px_-4px_rgba(245,180,0,0.55)]'
            : 'text-brand-inkSoft hover:bg-brand-surface hover:text-brand-ink',
        )}
      >
        {t('deposit.title')}
      </Link>
      <Link
        role="tab"
        aria-selected={active === 'withdraw'}
        href="/withdraw"
        className={cn(
          'relative inline-flex h-11 items-center justify-center rounded-xl text-sm font-extrabold uppercase tracking-wider transition',
          active === 'withdraw'
            ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_10px_-4px_rgba(245,180,0,0.55)]'
            : 'text-brand-inkSoft hover:bg-brand-surface hover:text-brand-ink',
        )}
      >
        {t('withdraw.title')}
      </Link>
    </div>
  );
}
