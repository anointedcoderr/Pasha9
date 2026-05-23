// Built by Anointed Coder.
// Babu88-inspired mobile bottom navigation.
//
// Slot layout (4 items total):
//   1. Promotion           navigation link
//   2. Lotto               navigation link with NEW marker
//   3. RAISED YELLOW CTA   primary action: Register (guest) | Deposit (logged-in)
//   4. Login (guest) | Profile (logged-in)
//
// Home is reachable via the Pasha 9 logo in the header. Drawer with all
// other categories opens from the hamburger.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gift, Ticket, UserPlus, LogIn, Plus, User as UserIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { MarkerNew } from './markers';

interface Props {
  isLoggedIn: boolean;
  onOpenMenu: () => void;
  onRequestLogin: () => void;
  onRequestSignup: () => void;
  balance?: number | null;
}

export function StickyBottomNav({ isLoggedIn, onRequestLogin, onRequestSignup, balance }: Props) {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-brand-divider bg-brand-paper pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-8px_24px_-12px_rgba(15,17,21,0.15)] lg:hidden"
    >
      <Link href="/promotions" className="bnav-btn" data-active={pathname.startsWith('/promotions')} aria-label={t('navx.promotions')}>
        <Gift className="h-5 w-5 text-brand-yellow-600" />
        <span>{t('navx.promotions')}</span>
      </Link>

      <Link href="/lotto" className="bnav-btn" data-active={pathname.startsWith('/lotto')} aria-label={t('navx.lotto')}>
        <span className="relative inline-flex">
          <Ticket className="h-5 w-5 text-brand-yellow-600" />
          <span className="absolute -right-3 -top-2"><MarkerNew /></span>
        </span>
        <span>{t('navx.lotto')}</span>
      </Link>

      {isLoggedIn ? (
        <Link
          href="/deposit"
          className="bnav-fab"
          aria-label={t('navx.deposit')}
        >
          <span className="bnav-fab-circle">
            <Plus className="h-7 w-7" />
          </span>
          <span className="bnav-fab-label">{t('navx.deposit')}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRequestSignup}
          className="bnav-fab"
          aria-label={t('navx.register')}
        >
          <span className="bnav-fab-circle">
            <UserPlus className="h-7 w-7" />
          </span>
          <span className="bnav-fab-label">{t('navx.register')}</span>
        </button>
      )}

      {isLoggedIn ? (
        <Link
          href="/dashboard/profile"
          className="bnav-btn"
          data-active={pathname.startsWith('/dashboard/profile')}
          aria-label={t('navx.profile')}
        >
          <UserIcon className="h-5 w-5" />
          <span className="truncate">
            {balance != null ? formatBDT(balance) : t('navx.profile')}
          </span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRequestLogin}
          className="bnav-btn"
          aria-label={t('navx.login')}
        >
          <LogIn className="h-5 w-5 text-brand-blue-600" />
          <span>{t('navx.login')}</span>
        </button>
      )}
    </nav>
  );
}
