// Built by Anointed Coder.
// Left-side white drawer for mobile. Three grouped sections (Main, Games,
// Others) per the Babu-inspired reference, with a yellow active state.
// Others holds language / FAQ / live chat / download app / login / register
// / logout - guarded by the visitor's auth state.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  X,
  Gift,
  Trophy,
  Users,
  Star,
  Ticket,
  Briefcase,
  Crown,
  Cherry,
  Tv2,
  Zap,
  Activity,
  Dice5,
  Medal,
  Gauge,
  Fish,
  Languages,
  HelpCircle,
  MessageCircle,
  Download,
  LogOut,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
import { Logo } from './Logo';
import { cn } from '@/lib/utils/cn';
import { useSectionFlags } from '@/lib/content/use-section-flags';

interface Item {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  // Optional full dictionary path for the label. Defaults to drawer.<key>.
  // WinGo + Leaderboard reuse the shared nav.* keys so their labels stay in
  // step with the desktop sidebar.
  i18nKey?: string;
}

const MAIN: Item[] = [
  { key: 'leaderboard', href: '/leaderboard', icon: Medal, i18nKey: 'nav.leaderboard' },
  { key: 'promotion', href: '/promotions', icon: Gift },
  { key: 'rewards', href: '/rewards', icon: Trophy },
  // VIP Club. The desktop CategoryNav (hidden lg:block) carries this link,
  // so on mobile the drawer is the only place a player can reach /vip.
  { key: 'vip', href: '/vip', icon: Crown },
  { key: 'referralProgram', href: '/referral', icon: Users },
  { key: 'bettingPass', href: '/betting-pass', icon: Star },
  { key: 'affiliate', href: '/affiliate', icon: Briefcase },
  { key: 'lotto', href: '/lotto', icon: Ticket },
];

const GAMES: Item[] = [
  // Pasha Originals is intentionally omitted from the public drawer
  // until real custom games launch. The admin tooling at
  // /admin/native-games remains available so the operator can flip
  // native_games_public_enabled=true once games are ready.
  { key: 'wingo', href: '/games/wingo', icon: Dice5, i18nKey: 'nav.wingo' },
  { key: 'slots', href: '/slots', icon: Cherry },
  { key: 'casino', href: '/live-casino', icon: Tv2 },
  { key: 'crash', href: '/games/provider?category=crash', icon: Zap },
  { key: 'cricket', href: '/sports', icon: Activity },
  { key: 'tableGames', href: '/games/provider?category=table', icon: Dice5 },
  { key: 'fast', href: '/games/provider?category=flash', icon: Gauge },
  { key: 'fishing', href: '/fishing', icon: Fish },
];

interface Props {
  open: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  onRequestLogin: () => void;
  onRequestSignup: () => void;
  onLogout: () => void;
}

export function MobileDrawer({ open, onClose, isLoggedIn, onRequestLogin, onRequestSignup, onLogout }: Props) {
  const t = useT();
  const { lang, setLang } = useLang();
  const flags = useSectionFlags();
  // Hide the Leaderboard entry from the Main group when an admin has
  // turned the section off.
  const mainItems = MAIN.filter((it) => (it.key === 'leaderboard' ? flags.leaderboard : true));
  const pathname = usePathname() ?? '';
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  // Remember which element opened the drawer so focus can be restored to
  // it on close, per dialog semantics.
  const triggerRef = useRef<HTMLElement | null>(null);
  // Hold the latest onClose so the dialog effect can depend only on `open`
  // and never re-run (and steal focus) when the parent passes a new
  // callback identity.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // The download entry only renders when the operator has configured
  // the APK url (same treatment as AppDownloadSection); the old /apk
  // fallback 404'd for players, so no url means no drawer entry.
  useEffect(() => {
    if (!open) return;
    fetch('/api/content/apk')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setApkUrl(typeof data?.url === 'string' && data.url.trim() ? (data.url as string) : null);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on route change
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Dialog behaviour: Escape to close, focus trap while open, and focus
  // restoration to the trigger on close. The drawer stays mounted for the
  // slide animation, but when closed it is made inert (below) so its links
  // are not tabbable.
  useEffect(() => {
    if (!open) return;

    // Capture the element that had focus when the drawer opened so we can
    // return focus there on close.
    triggerRef.current = (document.activeElement as HTMLElement | null) ?? null;

    const drawer = drawerRef.current;
    const getFocusable = (): HTMLElement[] => {
      if (!drawer) return [];
      return Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    // Move focus into the drawer (first focusable, typically the close
    // button) once it is open.
    const focusFirst = window.setTimeout(() => {
      const focusable = getFocusable();
      (focusable[0] ?? drawer)?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === first || !drawer?.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !drawer?.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus to the trigger when the drawer closes.
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
  }, [open]);

  // Make the off-screen drawer non-interactive when closed so its ~20
  // links are not tabbable. `inert` is a DOM property; setting it here
  // keeps the slide animation intact (the element stays mounted).
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (open) {
      drawer.removeAttribute('inert');
    } else {
      drawer.setAttribute('inert', '');
    }
  }, [open]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[300px] max-w-[88vw] bg-brand-paper text-brand-ink shadow-2xl transition-transform duration-200 ease-out lg:hidden outline-none',
          'flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={lang === 'bn' ? 'সাইট নেভিগেশন' : 'Site navigation'}
      >
        <div className="flex items-center justify-between border-b border-brand-divider px-4 py-3">
          <Logo tone="dark" size="md" />
          <button
            type="button"
            aria-label={lang === 'bn' ? 'মেনু বন্ধ করুন' : 'Close menu'}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-inkMute hover:bg-brand-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Section label={t('drawer.main')}>
            {mainItems.map((item) => (
              <DrawerLink key={item.key} item={item} t={t} pathname={pathname} onClose={onClose} />
            ))}
          </Section>
          <Section label={t('drawer.games')}>
            {GAMES.map((item) => (
              <DrawerLink key={item.key} item={item} t={t} pathname={pathname} onClose={onClose} />
            ))}
          </Section>
          <Section label={t('drawer.others')}>
            <button
              type="button"
              onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
              className="drawer-link w-full text-left"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/10 text-brand-yellow-700">
                <Languages className="h-3.5 w-3.5" />
              </span>
              <span>{t('drawer.language')}</span>
              <span className="ml-auto rounded-md border border-brand-divider bg-brand-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-inkSoft">
                {lang === 'bn' ? 'বাং' : 'EN'}
              </span>
            </button>
            <Link
              href="/faq"
              onClick={onClose}
              className="drawer-link"
              data-active={pathname === '/faq'}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/10 text-brand-yellow-700">
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
              <span>{t('drawer.faq')}</span>
            </Link>
            <Link
              href="/support"
              onClick={onClose}
              className="drawer-link"
              data-active={pathname === '/support'}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/10 text-brand-yellow-700">
                <MessageCircle className="h-3.5 w-3.5" />
              </span>
              <span>{t('drawer.liveChat')}</span>
            </Link>
            {apkUrl ? (
              <a
                href={apkUrl}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className="drawer-link"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/10 text-brand-yellow-700">
                  <Download className="h-3.5 w-3.5" />
                </span>
                <span>{t('drawer.downloadApp')}</span>
              </a>
            ) : null}
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="drawer-link w-full text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-600">
                  <LogOut className="h-3.5 w-3.5" />
                </span>
                <span className="text-red-700">{t('drawer.logout')}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestLogin();
                  }}
                  className="drawer-link w-full text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-blue-500/10 text-brand-blue-600">
                    <LogIn className="h-3.5 w-3.5" />
                  </span>
                  <span>{t('drawer.login')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestSignup();
                  }}
                  className="drawer-link w-full text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/10 text-brand-yellow-700">
                    <UserPlus className="h-3.5 w-3.5" />
                  </span>
                  <span>{t('drawer.register')}</span>
                </button>
              </>
            )}
          </Section>
        </nav>

        {!isLoggedIn ? (
          <div className="border-t border-brand-divider p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestLogin();
                }}
                className="btn-blue inline-flex h-10 items-center justify-center rounded-lg text-sm"
              >
                {t('drawer.login')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestSignup();
                }}
                className="btn-yellow inline-flex h-10 items-center justify-center rounded-lg text-sm"
              >
                {t('drawer.register')}
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-2 px-3">
        <span className="h-1 w-1 rounded-full bg-brand-yellow-500" />
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-inkMute">{label}</p>
        <span className="h-px flex-1 bg-gradient-to-r from-brand-divider via-brand-divider to-transparent" />
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DrawerLink({ item, t, pathname, onClose }: { item: Item; t: (k: string) => string; pathname: string; onClose: () => void }) {
  const active = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClose} className="drawer-link" data-active={active}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/10 text-brand-yellow-700">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>{t(item.i18nKey ?? `drawer.${item.key}`)}</span>
    </Link>
  );
}
