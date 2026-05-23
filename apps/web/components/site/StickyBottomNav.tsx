// Built by Anointed Coder.
// Babu-style mobile bottom navigation (Phase 8A redesign).
//
// 5 slots, center is a raised yellow Home button.
//
//   Logged-in :  Promotion | Lotto |  HOME  | Betting Pass | Referral
//   Guest     :  Promotion | Lotto |  HOME  | Register     | Login
//
// Home brings the user back to the landing page from any internal route,
// matching the client's "users must never feel trapped" requirement.
// Deposit and Profile are reachable from the header (balance pill,
// user icon, hamburger Others section) so they are intentionally not in
// the bottom rail anymore.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gift, Ticket, Home as HomeIcon, Star, Users, UserPlus, LogIn } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { MarkerNew } from './markers';

interface Props {
  isLoggedIn: boolean;
  onOpenMenu: () => void;
  onRequestLogin: () => void;
  onRequestSignup: () => void;
  balance?: number | null;
}

export function StickyBottomNav({ isLoggedIn, onRequestLogin, onRequestSignup }: Props) {
  const t = useT();
  const pathname = usePathname();
  const onHome = pathname === '/';

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-brand-divider bg-brand-paper pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-8px_24px_-12px_rgba(15,17,21,0.15)] lg:hidden"
    >
      <Link
        href="/promotions"
        className="bnav-btn"
        data-active={pathname.startsWith('/promotions')}
        aria-label={t('navx.promotions')}
      >
        <Gift className="h-5 w-5 text-brand-yellow-600" />
        <span>{t('navx.promotions')}</span>
      </Link>

      <Link
        href="/lotto"
        className="bnav-btn"
        data-active={pathname.startsWith('/lotto')}
        aria-label={t('navx.lotto')}
      >
        <span className="relative inline-flex">
          <Ticket className="h-5 w-5 text-brand-yellow-600" />
          <span className="absolute -right-3 -top-2">
            <MarkerNew />
          </span>
        </span>
        <span>{t('navx.lotto')}</span>
      </Link>

      <Link href="/" className="bnav-fab" aria-label={t('nav.home')} data-active={onHome}>
        <span className="bnav-fab-circle">
          <HomeIcon className="h-7 w-7" />
        </span>
        <span className="bnav-fab-label">{t('nav.home')}</span>
      </Link>

      {isLoggedIn ? (
        <>
          <Link
            href="/betting-pass"
            className="bnav-btn"
            data-active={pathname.startsWith('/betting-pass')}
            aria-label={t('navx.bettingPass')}
          >
            <Star className="h-5 w-5 text-brand-yellow-600" />
            <span>{t('navx.bettingPass')}</span>
          </Link>
          <Link
            href="/dashboard/referral"
            className="bnav-btn"
            data-active={pathname.endsWith('/referral')}
            aria-label={t('navx.referral')}
          >
            <Users className="h-5 w-5 text-brand-yellow-600" />
            <span>{t('navx.referral')}</span>
          </Link>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onRequestSignup}
            className="bnav-btn"
            aria-label={t('navx.register')}
          >
            <UserPlus className="h-5 w-5 text-brand-yellow-600" />
            <span>{t('navx.register')}</span>
          </button>
          <button
            type="button"
            onClick={onRequestLogin}
            className="bnav-btn"
            aria-label={t('navx.login')}
          >
            <LogIn className="h-5 w-5 text-brand-blue-600" />
            <span>{t('navx.login')}</span>
          </button>
        </>
      )}
    </nav>
  );
}
