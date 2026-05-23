// Built by Anointed Coder.
// Left-side white drawer for mobile. Grouped sections (Main, Games) per the
// Babu88-inspired reference, with a yellow active state.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { X, Gift, Trophy, Users, Star, Sparkles, Ticket, Briefcase, Cherry, Tv2, Zap, Activity, Dice5, Gauge, Fish } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
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
  { key: 'slots', href: '/slots', icon: Cherry },
  { key: 'casino', href: '/live-casino', icon: Tv2 },
  { key: 'crash', href: '/games/crash', icon: Zap },
  { key: 'cricket', href: '/sports', icon: Activity },
  { key: 'tableGames', href: '/games/table', icon: Dice5 },
  { key: 'fast', href: '/games/fast', icon: Gauge },
  { key: 'fishing', href: '/fishing', icon: Fish },
];

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on route change
  useEffect(() => { if (open) onClose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

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
          <Logo tone="dark" />
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
              <DrawerLink key={item.key} item={item} t={t} pathname={pathname} />
            ))}
          </Section>
          <Section label={t('drawer.games')}>
            {GAMES.map((item) => (
              <DrawerLink key={item.key} item={item} t={t} pathname={pathname} />
            ))}
          </Section>
        </nav>

        <div className="border-t border-brand-divider p-3">
          <div className="grid grid-cols-2 gap-2">
            <Link href="/?login=1" className="btn-blue inline-flex h-10 items-center justify-center rounded-lg text-sm">
              {t('drawer.login')}
            </Link>
            <Link href="/?signup=1" className="btn-yellow inline-flex h-10 items-center justify-center rounded-lg text-sm">
              {t('drawer.register')}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-inkMute">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DrawerLink({ item, t, pathname }: { item: Item; t: (k: string) => string; pathname: string }) {
  const active = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link href={item.href} className="drawer-link" data-active={active}>
      <Icon className="h-4 w-4 text-brand-yellow-600" />
      <span>{t(`drawer.${item.key}`)}</span>
    </Link>
  );
}
