// Built by Anointed Coder.
// Babu-style mobile bottom navigation (final polish pass).
//
// 5 slots, centre is a raised yellow Home button with triple ring.
//
//   Logged-in :  Promotion | Lotto |  HOME  | Betting Pass | Referral
//   Guest     :  Promotion | Lotto |  HOME  | Register     | Login
//
// Each side icon sits in its own premium .bnav-icon-wrap so the active
// state can swap to a gold gradient tile instead of just a colour
// change. Centre Home FAB has a double halo (white + gold).

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gift, Ticket, Home as HomeIcon, Star, Users, UserPlus, LogIn } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
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
  const { lang } = useLang();
  const newLabel = lang === 'bn' ? 'নতুন' : 'NEW';
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw ?? '';
  const onHome = pathname === '/';

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-brand-divider bg-[linear-gradient(180deg,#FFFFFF_0%,#FAFBFC_100%)] pb-[max(env(safe-area-inset-bottom),10px)] shadow-[0_-10px_30px_-12px_rgba(15,17,21,0.18)] lg:hidden"
    >
      <Link
        href="/promotions"
        className="bnav-btn"
        data-active={pathname.startsWith('/promotions')}
        aria-label={t('navx.promotions')}
      >
        <span className="bnav-icon-wrap">
          <Gift className="h-[18px] w-[18px] text-brand-yellow-700" />
        </span>
        <span>{t('navx.promotions')}</span>
      </Link>

      <Link
        href="/lotto"
        className="bnav-btn"
        data-active={pathname.startsWith('/lotto')}
        aria-label={t('navx.lotto')}
      >
        <span className="bnav-icon-wrap relative">
          <Ticket className="h-[18px] w-[18px] text-brand-yellow-700" />
          <span className="absolute -right-2.5 -top-2"><MarkerNew label={newLabel} /></span>
        </span>
        <span>{t('navx.lotto')}</span>
      </Link>

      <Link href="/" className="bnav-fab" aria-label={t('nav.home')}>
        <span className="bnav-fab-circle" data-active={onHome}>
          <HomeIcon className="h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
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
            <span className="bnav-icon-wrap">
              <Star className="h-[18px] w-[18px] text-brand-yellow-700" />
            </span>
            <span>{t('navx.bettingPass')}</span>
          </Link>
          <Link
            href="/dashboard/referral"
            className="bnav-btn"
            data-active={pathname.endsWith('/referral')}
            aria-label={t('navx.referral')}
          >
            <span className="bnav-icon-wrap">
              <Users className="h-[18px] w-[18px] text-brand-yellow-700" />
            </span>
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
            <span className="bnav-icon-wrap">
              <UserPlus className="h-[18px] w-[18px] text-brand-yellow-700" />
            </span>
            <span>{t('navx.register')}</span>
          </button>
          <button
            type="button"
            onClick={onRequestLogin}
            className="bnav-btn"
            aria-label={t('navx.login')}
          >
            <span className="bnav-icon-wrap" style={{ background: 'linear-gradient(180deg, rgba(30,115,232,0.10) 0%, rgba(30,115,232,0.02) 100%)' }}>
              <LogIn className="h-[18px] w-[18px] text-brand-blue-600" />
            </span>
            <span>{t('navx.login')}</span>
          </button>
        </>
      )}
    </nav>
  );
}
