// Built by Anointed Coder.
//
// Babu88-style Deposit / Withdrawal tab bar shown at the top of both
// /deposit and /withdraw. Active tab is highlighted in brand yellow
// with an underline. The active variant is decided by the consuming
// page, not by inspecting the pathname, so the bar stays a pure
// presentational component.

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
    <div className={cn('mb-4 overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink', className)}>
      <div role="tablist" aria-label="Cashier" className="grid grid-cols-2">
        <Link
          role="tab"
          aria-selected={active === 'deposit'}
          href="/deposit"
          className={cn(
            'relative flex h-12 items-center justify-center text-sm font-extrabold uppercase tracking-wider transition',
            active === 'deposit' ? 'text-white' : 'text-white/60 hover:text-white',
          )}
        >
          {t('deposit.title')}
          {active === 'deposit' ? (
            <span aria-hidden className="absolute inset-x-3 bottom-0 h-1 rounded-full bg-brand-yellow-500" />
          ) : null}
        </Link>
        <Link
          role="tab"
          aria-selected={active === 'withdraw'}
          href="/withdraw"
          className={cn(
            'relative flex h-12 items-center justify-center text-sm font-extrabold uppercase tracking-wider transition',
            active === 'withdraw' ? 'text-white' : 'text-white/60 hover:text-white',
          )}
        >
          {t('withdraw.title')}
          {active === 'withdraw' ? (
            <span aria-hidden className="absolute inset-x-3 bottom-0 h-1 rounded-full bg-brand-yellow-500" />
          ) : null}
        </Link>
      </div>
    </div>
  );
}
