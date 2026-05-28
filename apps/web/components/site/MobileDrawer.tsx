// Built by Anointed Coder.
// Left-side white drawer for mobile. Three grouped sections (Main, Games,
// Others) per the Babu-inspired reference, with a yellow active state.
// Others holds language / FAQ / live chat / download app / login / register
// / logout - guarded by the visitor's auth state.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  X,
  Gift,
  Trophy,
  Users,
  Star,
  Sparkles,
  Ticket,
  Briefcase,
  Cherry,
  Tv2,
  Zap,
  Activity,
  Dice5,
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

interface Item {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAIN: Item[] = [
  { key: 'promotion', href: '/promotions', icon: Gift },
  { key: 'rewards', href: '/rewards', icon: Trophy },
  { key: 'referralProgram', href: '/referral', icon: Users },
  { key: 'bettingPass', href: '/betting-pass', icon: Star },
  { key: 'iplBettingPass', href: '/betting-pass/ipl', icon: Sparkles },
  { key: 'affiliate', href: '/affiliate', icon: Briefcase },
  { key: 'lotto', href: '/lotto', icon: Ticket },
];

const GAMES: Item[] = [
  { key: 'pashaOriginals', href: '/games', icon: Sparkles },
  { key: 'slots', href: '/slots', icon: Cherry },
  { key: 'casino', href: '/live-casino', icon: Tv2 },
  { key: 'crash', href: '/games/crash', icon: Zap },
  { key: 'cricket', href: '/sports', icon: Activity },
  { key: 'tableGames', href: '/games/table', icon: Dice5 },
  { key: 'fast', href: '/games/fast', icon: Gauge },
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
  const pathname = usePathname();
  const [apkUrl, setApkUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/content/apk')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.url) setApkUrl(data.url as string);
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
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[300px] max-w-[88vw] bg-brand-paper text-brand-ink shadow-2xl transition-transform duration-200 ease-out lg:hidden',
          'flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Site navigation"
      >
        <div className="flex items-center justify-between border-b border-brand-divider px-4 py-3">
          <Logo tone="dark" size="md" />
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-inkMute hover:bg-brand-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Section label={t('drawer.main')}>
            {MAIN.map((item) => (
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
            <a
              href={apkUrl ?? '/apk'}
              target={apkUrl ? '_blank' : undefined}
              rel={apkUrl ? 'noreferrer' : undefined}
              onClick={onClose}
              className="drawer-link"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/10 text-brand-yellow-700">
                <Download className="h-3.5 w-3.5" />
              </span>
              <span>{t('drawer.downloadApp')}</span>
            </a>
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
      <span>{t(`drawer.${item.key}`)}</span>
    </Link>
  );
}
