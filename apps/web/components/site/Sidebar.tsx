'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/context';
import { ROUTES } from '@/lib/constants/routes';
import {
  Home,
  Flame,
  Dice5,
  Medal,
  Cherry,
  Fish,
  Trophy,
  Gamepad2,
  Tv2,
  Spade,
  Ticket,
  Gift,
  Users,
  Crown,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const items = [
  { key: 'home', href: ROUTES.home, icon: Home },
  { key: 'hot', href: '/games/hot', icon: Flame },
  { key: 'wingo', href: '/games/wingo', icon: Dice5 },
  { key: 'leaderboard', href: ROUTES.leaderboard, icon: Medal },
  { key: 'slots', href: ROUTES.slots, icon: Cherry },
  { key: 'fishing', href: ROUTES.fishing, icon: Fish },
  { key: 'sports', href: ROUTES.sports, icon: Trophy },
  { key: 'esports', href: '/games/esports', icon: Gamepad2 },
  { key: 'liveCasino', href: ROUTES.liveCasino, icon: Tv2 },
  { key: 'poker', href: '/games/poker', icon: Spade },
  { key: 'lottery', href: ROUTES.lottery, icon: Ticket },
  { key: 'promotions', href: ROUTES.promotions, icon: Gift },
  { key: 'referral', href: ROUTES.referral, icon: Users },
  { key: 'rewards', href: ROUTES.promotions + '#rewards', icon: Crown },
  { key: 'support', href: ROUTES.support, icon: LifeBuoy },
] as const;

export function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const t = useT();
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'sticky top-[72px] hidden h-[calc(100vh-88px)] shrink-0 overflow-y-auto rounded-card border border-neon/10 bg-base-panel/40 p-3 lg:block',
        collapsed ? 'w-rail' : 'w-sidebar',
      )}
    >
      <nav className="space-y-1">
        {items.map(({ key, href, icon: Icon }) => {
          const active = pathname === href || (pathname ?? '').startsWith(href + '/');
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                active ? 'bg-neon/10 text-ink-hi ring-neon-soft' : 'text-ink-mid hover:bg-white/[0.04] hover:text-ink-hi',
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-neon' : 'text-ink-mid group-hover:text-neon')} />
              {!collapsed ? <span className="truncate">{t(`nav.${key}`)}</span> : null}
              {active && !collapsed ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-neon shadow-glow-neon" /> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileSidebar({ items: navItems = items, onSelect }: { items?: typeof items; onSelect?: () => void }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {navItems.map(({ key, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            onClick={onSelect}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-base transition',
              active ? 'bg-neon/10 text-ink-hi' : 'text-ink-mid hover:bg-white/5 hover:text-ink-hi',
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{t(`nav.${key}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
