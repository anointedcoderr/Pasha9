'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, ArrowDownToLine, ArrowUpToLine, Gift, Users, ReceiptText, User, ShieldCheck, Briefcase } from 'lucide-react';
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
  return (
    <aside className="card-glow lg:sticky lg:top-[88px] lg:h-fit">
      <nav className="p-3">
        {ITEMS.map(({ key, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                active ? 'bg-neon/10 text-ink-hi ring-neon-soft' : 'text-ink-mid hover:bg-white/[0.04] hover:text-ink-hi',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-neon' : 'text-ink-mid group-hover:text-neon')} />
              <span>{t(`dashboard.${key}`)}</span>
              {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-neon" /> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
