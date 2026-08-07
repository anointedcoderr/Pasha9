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
  LogOut,
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
import { BlockedAccountBanner } from './BlockedAccountBanner';
import { triggerWalletRefresh } from './WalletStrip';
import { useT } from '@/lib/i18n/context';
import { useDisclosure } from '@/lib/utils/disclosure';
import { ROUTES } from '@/lib/constants/routes';
import { formatBDT } from '@/lib/utils/format';

interface Me {
  id: string;
  username: string;
  role: { key: string; label: string };
  status?: 'active' | 'blocked' | 'pending';
  blockedReason?: string | null;
  blockedAt?: string | null;
  wallet?: { balance: number | string; bonusBalance?: number | string };
}

// Last known signed-in state, so a page navigation can paint the correct
// header immediately instead of waiting on /api/auth/me.
//
// Without this the whole auth-dependent area is unknown on every full page
// load and has to render a placeholder for as long as the request takes -
// roughly a second on a mobile connection, on every navigation. That reads
// as the app flickering and feeling slow.
//
// This is a rendering hint only, never a source of truth: the probe still
// runs on every load and corrects it. A stale entry (session expired
// server-side) shows the signed-in header for that one request before being
// cleared, which is why nothing here is trusted for access - the server
// authorises every request on its own.
const AUTH_CACHE_KEY = 'pasha9:last_auth';

function readCachedMe(): Me | null {
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Me | null;
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedMe(me: Me | null): void {
  try {
    if (me) window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(me));
    else window.localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // Private mode / quota. The probe still works, we just lose the hint.
  }
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
  const [unreadCount, setUnreadCount] = useState(0);
  // Auth probe completion flag. Until the /api/auth/me round-trip
  // returns the header renders a fixed-width placeholder so the
  // guest/authed button swap does not cause a visible width jump
  // after hydration (the cause of the "header becomes unstable
  // after refresh" report).
  const [authLoaded, setAuthLoaded] = useState(false);

  // Open auth modal from query params (?login=1 or ?signup=1) used by
  // drawer + bottom nav.
  //
  // This effect was the source of the "logged in user sees login
  // popup after pressing back" report. The original implementation
  // fired whenever the URL carried login=1 or signup=1 with no
  // regard for whether the player was already authenticated and
  // never stripped the trigger from the URL once it had been
  // consumed. So a guest clicking deposit, landing on /?login=1,
  // logging in, navigating to /dashboard, and then pressing back
  // returned the browser to /?login=1 - the previous history entry -
  // which re-fired this effect and re-opened the login dialog on
  // an already-authenticated session.
  //
  // The fix waits for the initial /api/auth/me probe (authLoaded),
  // strips the trigger param via history.replaceState so the URL
  // can never re-trigger again on a subsequent back-navigation,
  // and only opens the dialog when the user is actually a guest
  // (me is null after the probe).
  useEffect(() => {
    if (!authLoaded) return;
    const l = params?.get('login');
    const s = params?.get('signup');
    if (l !== '1' && s !== '1') return;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('login');
      url.searchParams.delete('signup');
      window.history.replaceState({}, '', url.toString());
    }
    if (me) return;
    if (l === '1') { setTab('login'); auth.onOpen(); }
    else if (s === '1') { setTab('signup'); auth.onOpen(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.get('login'), params?.get('signup'), authLoaded, me]);

  // Same-page event channel for components (WalletStrip guest card,
  // etc) that need to open the modal without relying on a search-param
  // round-trip. Search-param navigation on the same path is reliable
  // for fresh page loads but Next.js' soft-routing skips the modal
  // when the URL is already at '/' with a different fragment.
  useEffect(() => {
    const openLogin = () => { setTab('login'); auth.onOpen(); };
    const openSignup = () => { setTab('signup'); auth.onOpen(); };
    window.addEventListener('pasha9:open-login', openLogin);
    window.addEventListener('pasha9:open-signup', openSignup);
    return () => {
      window.removeEventListener('pasha9:open-login', openLogin);
      window.removeEventListener('pasha9:open-signup', openSignup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMe = () => {
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json().catch(() => null);
          if (data?.user) {
            setMe(data.user as Me);
            writeCachedMe(data.user as Me);
          } else {
            setMe(null);
            writeCachedMe(null);
          }
        } else if (r.status === 401) {
          setMe(null);
          writeCachedMe(null);
        }
        // Anything else (5xx, network blip) preserves the last known me.
      })
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;

    // Paint the last known state first so navigation does not flash a
    // placeholder (or, worse, a Login button) while the probe is in flight.
    // Read here rather than in useState so the server-rendered markup and
    // the first client render still agree - no hydration mismatch.
    const cached = readCachedMe();
    if (cached) {
      setMe(cached);
      setAuthLoaded(true);
    }

    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then(async (r) => {
        if (!alive) return;
        if (r.ok) {
          const data = await r.json().catch(() => null);
          if (data?.user) {
            setMe(data.user as Me);
            writeCachedMe(data.user as Me);
          }
        } else if (r.status === 401) {
          // Genuinely signed out: drop the hint so the next load starts
          // correctly rather than flashing a signed-in header.
          setMe(null);
          writeCachedMe(null);
        }
        // 5xx / network: keep whatever we have rather than logging the UI out.
        setAuthLoaded(true);
      })
      .catch(() => { if (alive) setAuthLoaded(true); });
    return () => { alive = false; };
  }, []);

  // Listen to wallet-refresh events from deposit / withdraw pages so the
  // header balance stays in sync without a hard reload. pasha9:auth-changed
  // fires specifically on sign-in/sign-up so the Login button swaps to the
  // signed-in UI right away, without waiting on router.refresh() (which
  // only re-renders server components, not this client component's state).
  useEffect(() => {
    const handler = () => loadMe();
    window.addEventListener('pasha9:wallet-refresh', handler);
    window.addEventListener('pasha9:auth-changed', handler);
    return () => {
      window.removeEventListener('pasha9:wallet-refresh', handler);
      window.removeEventListener('pasha9:auth-changed', handler);
    };
  }, []);

  // Notification unread badge. Poll every 60s while signed in; the
  // notification drawer fires pasha9:notification-refresh whenever it
  // marks items read so the dot disappears immediately on a local
  // tap without waiting for the next poll.
  useEffect(() => {
    if (!me) {
      setUnreadCount(0);
      return;
    }
    let alive = true;
    const tick = () => {
      fetch('/api/me/notifications', { cache: 'no-store', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!alive) return;
          setUnreadCount(Number(j?.unreadCount ?? 0));
        })
        .catch(() => { /* ignore */ });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    const handler = () => tick();
    window.addEventListener('pasha9:notification-refresh', handler);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener('pasha9:notification-refresh', handler);
    };
  }, [me]);

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    // Forget the once-only WinGo rules acceptance so the next player on
    // this device is asked to agree again.
    try { window.localStorage.removeItem('pasha9:wingo_rules_accepted'); } catch { /* ignore */ }
    // Must clear, or the next page load would paint a signed-in header from
    // the stale hint before the probe corrects it.
    writeCachedMe(null);
    setMe(null);
    triggerWalletRefresh();
    router.refresh();
  };

  const openLogin = () => { setTab('login'); auth.onOpen(); };
  const openSignup = () => { setTab('signup'); auth.onOpen(); };

  return (
    <>
      <MobileTopBar />

      <header
        className="sticky top-0 z-30 border-b border-brand-divider bg-brand-paper shadow-[0_1px_0_rgba(15,17,21,0.04)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Top hairline gold glow */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-yellow-500/35 to-transparent" />
        <div className="relative mx-auto flex h-[68px] max-w-page items-center gap-2 px-2 sm:gap-3 sm:px-3 md:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-divider bg-brand-paper text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <Logo tone="dark" size="md" />

          <div className="ml-auto flex min-h-[40px] items-center justify-end gap-1.5 sm:min-w-[200px] sm:gap-2">
            {!authLoaded ? (
              // Skeleton placeholder. Matches the visual footprint of
              // either auth state (guest or authed) so the right
              // column does not jump width when the probe resolves.
              <>
                <span aria-hidden className="inline-flex h-10 w-10 animate-pulse rounded-xl bg-brand-surface/60" />
                <span aria-hidden className="inline-flex h-10 w-10 animate-pulse rounded-xl bg-brand-surface/60" />
                <span aria-hidden className="inline-flex h-10 w-10 animate-pulse rounded-xl bg-brand-surface/60" />
              </>
            ) : me ? (
              <>
                <div className="hidden md:block">
                  <LanguageToggle compact />
                </div>
                <button
                  type="button"
                  onClick={notif.onOpen}
                  aria-label="Notifications"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-divider bg-brand-paper text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-brand-paper bg-brand-hot px-1 text-[9px] font-bold leading-none text-white shadow-[0_0_6px_rgba(255,78,58,0.85)]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </button>
                <Link href={ROUTES.wallet} className="pill-light tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_8px_-4px_rgba(245,180,0,0.35)]">
                  <WalletIcon className="h-4 w-4 text-brand-yellow-600" />
                  <span className="hidden font-bold sm:inline">
                    {formatBDT(Number(me.wallet?.balance ?? 0))}
                  </span>
                </Link>
                <Link
                  href={ROUTES.deposit}
                  aria-label="Deposit"
                  className="btn-yellow inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-6px_rgba(245,180,0,0.7)]"
                >
                  <Plus className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/profile"
                  aria-label="My account"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-divider bg-brand-paper text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface"
                >
                  <UserIcon className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Logout"
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-brand-divider bg-brand-paper text-brand-inkMute transition hover:border-brand-yellow-500 hover:text-brand-ink md:inline-flex"
                >
                  <LogOut className="h-4 w-4" />
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
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-divider bg-brand-paper text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={openLogin}
                  aria-label={t('navx.login')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-divider bg-brand-paper text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface md:hidden"
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

      {me?.status === 'blocked' ? (
        <BlockedAccountBanner username={me.username} reason={me.blockedReason ?? null} at={me.blockedAt ?? null} />
      ) : null}

      <CategoryNav />

      <AuthModal open={auth.open} onOpenChange={auth.setOpen} initialTab={tab} />

      <NotificationDrawer open={notif.open} onOpenChange={notif.setOpen} isLoggedIn={!!me} />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isLoggedIn={!!me}
        authLoaded={authLoaded}
        onRequestLogin={openLogin}
        onRequestSignup={openSignup}
        onLogout={logout}
      />

      <StickyBottomNav
        isLoggedIn={!!me}
        authLoaded={authLoaded}
        onOpenMenu={() => setDrawerOpen(true)}
        onRequestLogin={openLogin}
        onRequestSignup={openSignup}
        balance={me?.wallet?.balance != null ? Number(me.wallet.balance) : null}
      />
    </>
  );
}
