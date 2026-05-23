// Built by Anointed Coder.
// Public-site header. White desktop, mobile chrome with hamburger + language.
// Guest desktop: clear Login (blue) + Register (yellow) buttons.
// Logged-in desktop: username, notifications, balance chip, deposit (+) button,
// language, logout.
//
// Mobile chrome (Phase 8A): hamburger + logo on the left, bell +
// user/profile + deposit (logged-in) or compact register pill (guest) on
// the right. Bell opens a notification drawer for both states. User icon
// goes to dashboard/profile for logged-in or opens the auth modal for
// guests so the visitor never sees a dead-end icon.

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Lock,
  Menu as MenuIcon,
  Plus,
  User as UserIcon,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Logo } from './Logo';
import { LanguageToggle } from './LanguageToggle';
import { AuthModal } from './AuthModal';
import { MobileDrawer } from './MobileDrawer';
import { MobileTopBar } from './MobileTopBar';
import { StickyBottomNav } from './StickyBottomNav';
import { CategoryNav } from './CategoryNav';
import { NotificationDrawer } from './NotificationDrawer';
import { triggerWalletRefresh } from './WalletStrip';
import { useT } from '@/lib/i18n/context';
import { useDisclosure } from '@/lib/utils/disclosure';
import { ROUTES } from '@/lib/constants/routes';
import { formatBDT } from '@/lib/utils/format';

interface Me {
  id: string;
  username: string;
  role: { key: string; label: string };
  wallet?: { balance: number | string; bonusBalance?: number | string };
}

export function Header() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const auth = useDisclosure();
  const notif = useDisclosure();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  // Open auth modal from query params (?login=1 or ?signup=1) used by drawer + bottom nav
  useEffect(() => {
    const l = params.get('login');
    const s = params.get('signup');
    if (l === '1') { setTab('login'); auth.onOpen(); }
    else if (s === '1') { setTab('signup'); auth.onOpen(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('login'), params.get('signup')]);

  const loadMe = () => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setMe(data.user as Me);
        else setMe(null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.user) setMe(data.user as Me);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Listen to wallet-refresh events from deposit / withdraw pages so the
  // header balance stays in sync without a hard reload.
  useEffect(() => {
    const handler = () => loadMe();
    window.addEventListener('pasha9:wallet-refresh', handler);
    return () => window.removeEventListener('pasha9:wallet-refresh', handler);
  }, []);

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setMe(null);
    triggerWalletRefresh();
    router.refresh();
  };

  const openLogin = () => { setTab('login'); auth.onOpen(); };
  const openSignup = () => { setTab('signup'); auth.onOpen(); };

  return (
    <>
      <MobileTopBar />

      <header className="sticky top-0 z-30 border-b border-brand-divider bg-brand-paper">
        <div className="mx-auto flex h-[68px] max-w-page items-center gap-3 px-3 md:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-surface lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <Logo tone="dark" size="md" />

          <div className="ml-auto flex items-center gap-2">
            {me ? (
              <>
                <div className="hidden md:block">
                  <LanguageToggle compact />
                </div>
                <button
                  type="button"
                  onClick={notif.onOpen}
                  aria-label="Notifications"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-surface"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-brand-paper bg-brand-hot" />
                </button>
                <Link href={ROUTES.wallet} className="pill-light tabular-nums">
                  <WalletIcon className="h-4 w-4 text-brand-yellow-600" />
                  <span className="hidden sm:inline">
                    {formatBDT(Number(me.wallet?.balance ?? 0))}
                  </span>
                </Link>
                <Link
                  href={ROUTES.deposit}
                  aria-label="Deposit"
                  className="btn-yellow inline-flex h-10 w-10 items-center justify-center rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/profile"
                  aria-label="My account"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brand-divider bg-brand-paper text-brand-ink hover:border-brand-yellow-500"
                >
                  <UserIcon className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Logout"
                  className="hidden h-10 w-10 items-center justify-center rounded-lg text-brand-inkMute hover:text-brand-ink md:inline-flex"
                >
                  <Lock className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <div className="hidden md:block">
                  <LanguageToggle compact />
                </div>
                <button
                  type="button"
                  onClick={notif.onOpen}
                  aria-label="Notifications"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-surface"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={openLogin}
                  aria-label={t('navx.login')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brand-divider bg-brand-paper text-brand-ink hover:border-brand-yellow-500 md:hidden"
                >
                  <UserIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={openLogin}
                  className="btn-blue hidden h-10 items-center justify-center rounded-lg px-4 text-sm md:inline-flex"
                >
                  {t('navx.login')}
                </button>
                <button
                  type="button"
                  onClick={openSignup}
                  className="btn-yellow hidden h-10 items-center justify-center rounded-lg px-4 text-sm md:inline-flex"
                >
                  {t('navx.register')}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <CategoryNav />

      <AuthModal open={auth.open} onOpenChange={auth.setOpen} initialTab={tab} />

      <NotificationDrawer open={notif.open} onOpenChange={notif.setOpen} isLoggedIn={!!me} />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isLoggedIn={!!me}
        onRequestLogin={openLogin}
        onRequestSignup={openSignup}
        onLogout={logout}
      />

      <StickyBottomNav
        isLoggedIn={!!me}
        onOpenMenu={() => setDrawerOpen(true)}
        onRequestLogin={openLogin}
        onRequestSignup={openSignup}
        balance={me?.wallet?.balance != null ? Number(me.wallet.balance) : null}
      />
    </>
  );
}
