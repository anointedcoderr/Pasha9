// Built by Anointed Coder.
// 4-button sticky bottom navigation for mobile.
// Guest state: Menu, Promotion, Register (yellow), Login (blue).
// Logged-in state: Home, Deposit, Wallet, Profile.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Gift, Wallet as WalletIcon, User as UserIcon, Menu as MenuIcon, ArrowDownToLine } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

interface Props {
  isLoggedIn: boolean;
  onOpenMenu: () => void;
  onRequestLogin: () => void;
  onRequestSignup: () => void;
}

export function StickyBottomNav({ isLoggedIn, onOpenMenu, onRequestLogin, onRequestSignup }: Props) {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-brand-divider bg-brand-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(15,17,21,0.15)] lg:hidden"
    >
      {!isLoggedIn ? (
        <>
          <button type="button" onClick={onOpenMenu} className="bnav-btn" aria-label={t('navx.menu')}>
            <MenuIcon className="h-5 w-5" />
            <span>{t('navx.menu')}</span>
          </button>
          <Link href="/promotions" className="bnav-btn" data-active={pathname === '/promotions'}>
            <Gift className="h-5 w-5 text-brand-yellow-600" />
            <span>{t('navx.promotions')}</span>
          </Link>
          <button type="button" onClick={onRequestSignup} className="bnav-btn">
            <span className="btn-yellow flex h-9 w-full max-w-[120px] items-center justify-center rounded-lg px-3 text-sm font-bold">
              {t('navx.register')}
            </span>
          </button>
          <button type="button" onClick={onRequestLogin} className="bnav-btn">
            <span className="btn-blue flex h-9 w-full max-w-[120px] items-center justify-center rounded-lg px-3 text-sm font-bold">
              {t('navx.login')}
            </span>
          </button>
        </>
      ) : (
        <>
          <Link href="/" className="bnav-btn" data-active={pathname === '/'}>
            <Home className="h-5 w-5" />
            <span>{t('nav.home')}</span>
          </Link>
          <Link href="/deposit" className="bnav-btn" data-active={pathname === '/deposit'}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full btn-yellow">
              <ArrowDownToLine className="h-4 w-4" />
            </span>
            <span>{t('navx.deposit')}</span>
          </Link>
          <Link href="/wallet" className="bnav-btn" data-active={pathname === '/wallet'}>
            <WalletIcon className="h-5 w-5" />
            <span>{t('navx.wallet')}</span>
          </Link>
          <Link href="/dashboard/profile" className="bnav-btn" data-active={pathname.startsWith('/dashboard/profile')}>
            <UserIcon className="h-5 w-5" />
            <span>{t('navx.profile')}</span>
          </Link>
        </>
      )}
    </nav>
  );
}
