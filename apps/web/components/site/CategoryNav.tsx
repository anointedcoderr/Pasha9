// Built by Anointed Coder.
// Dark horizontal category navigation strip, sits below the white site header
// on desktop. Yellow active underline. Items can mount HOT or NEW markers.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MarkerHot, MarkerNew } from './markers';
import { useT, useLang } from '@/lib/i18n/context';
import { ROUTES } from '@/lib/constants/routes';

type Marker = 'hot' | 'new' | null;

interface NavItem {
  key: string;
  href: string;
  marker?: Marker;
}

const ITEMS: NavItem[] = [
  // pashaOriginals intentionally omitted while
  // native_games_public_enabled defaults to false.
  { key: 'slots', href: ROUTES.slots },
  { key: 'liveCasino', href: ROUTES.liveCasino },
  { key: 'crash', href: '/games/provider?category=crash', marker: 'new' },
  { key: 'cricket', href: '/sports' },
  { key: 'tableGames', href: '/games/provider?category=table' },
  { key: 'fast', href: '/games/provider?category=flash', marker: 'new' },
  { key: 'fishing', href: ROUTES.fishing },
  { key: 'sportsbook', href: ROUTES.sports },
  { key: 'promotions', href: ROUTES.promotions },
  { key: 'bettingPass', href: '/betting-pass', marker: 'hot' },
  { key: 'referral', href: ROUTES.referral },
  { key: 'affiliate', href: '/affiliate' },
  { key: 'vip', href: '/vip', marker: 'new' },
  { key: 'rewards', href: '/rewards', marker: 'new' },
  { key: 'lotto', href: '/lotto', marker: 'new' },
];

export function CategoryNav() {
  const pathname = usePathname();
  const t = useT();
  const { lang } = useLang();
  const hotLabel = lang === 'bn' ? 'হট' : 'HOT';
  const newLabel = lang === 'bn' ? 'নতুন' : 'NEW';

  return (
    <nav className="nav-strip hidden lg:block">
      <div className="mx-auto flex max-w-page items-center gap-1 overflow-x-auto px-4 md:px-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && (pathname ?? '').startsWith(item.href + '/'));
          return (
            <Link
              key={item.key}
              href={item.href}
              data-active={active}
              className="nav-strip-link inline-flex shrink-0 items-center gap-1.5"
            >
              <span>{t(`navx.${item.key}`)}</span>
              {item.marker === 'hot' ? <MarkerHot label={hotLabel} /> : null}
              {item.marker === 'new' ? <MarkerNew label={newLabel} /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const CATEGORY_NAV_ITEMS = ITEMS;
