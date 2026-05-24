'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Wallet,
  ArrowDownToLine,
  ArrowUpToLine,
  Gift,
  Users,
  ReceiptText,
  User,
  ShieldCheck,
  Briefcase,
  ChevronDown,
  Menu as MenuIcon,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

const ITEMS = [
  { key: 'overview', href: ROUTES.dashboard.home, icon: LayoutDashboard },
  { key: 'wallet', href: ROUTES.dashboard.wallet, icon: Wallet },
  { key: 'deposit', href: ROUTES.dashboard.deposit, icon: ArrowDownToLine },
  { key: 'withdraw', href: ROUTES.dashboard.withdraw, icon: ArrowUpToLine },
  { key: 'bonus', href: ROUTES.dashboard.bonus, icon: Gift },
  { key: 'referral', href: ROUTES.dashboard.referral, icon: Users },
  { key: 'affiliate', href: '/dashboard/affiliate', icon: Briefcase },
  { key: 'transactions', href: ROUTES.dashboard.transactions, icon: ReceiptText },
  { key: 'profile', href: ROUTES.dashboard.profile, icon: User },
  { key: 'security', href: ROUTES.dashboard.security, icon: ShieldCheck },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);

  // Auto-close the mobile menu on every navigation so the user does not
  // have to manually dismiss it after each tap.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const active = ITEMS.find((i) => i.href === pathname);

  return (
    <aside className="card-light lg:sticky lg:top-[88px] lg:h-fit">
      {/* Mobile-only collapsed header. Hidden on lg+ where the full
          list is shown directly. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="dashboard-nav-list"
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left lg:hidden"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink">
          <MenuIcon className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
            {t('dashboard.title')}
          </p>
          <p className="text-sm font-bold text-brand-ink">
            {active ? t(`dashboard.${active.key}`) : t('dashboard.overview')}
          </p>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-brand-inkMute transition-transform', open && 'rotate-180 text-brand-ink')} />
      </button>

      <nav
        id="dashboard-nav-list"
        className={cn(
          'p-3 lg:block',
          open ? 'block border-t border-brand-divider' : 'hidden',
        )}
      >
        {ITEMS.map(({ key, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={key}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                isActive
                  ? 'bg-brand-yellow-500/15 text-brand-ink shadow-[inset_3px_0_0_#FFCC00]'
                  : 'text-brand-inkSoft hover:bg-brand-surface hover:text-brand-ink',
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-brand-yellow-600' : 'text-brand-inkMute group-hover:text-brand-ink')} />
              <span>{t(`dashboard.${key}`)}</span>
              {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-yellow-500" /> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
