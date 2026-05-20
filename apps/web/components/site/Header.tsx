'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Wallet, X } from 'lucide-react';
import { Logo } from './Logo';
import { LanguageToggle } from './LanguageToggle';
import { Button } from '@/components/ui/Button';
import { AuthModal } from './AuthModal';
import { MobileSidebar } from './Sidebar';
import { useT } from '@/lib/i18n/context';
import { useDisclosure } from '@/lib/utils/disclosure';
import { ROUTES } from '@/lib/constants/routes';
import { formatBDT } from '@/lib/utils/format';
import { currentUser } from '@/lib/mock/users';

export function Header() {
  const t = useT();
  const auth = useDisclosure();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neon/10 bg-base-deep/80 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-page items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMobileNav((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neon/15 text-ink-mid hover:text-ink-hi lg:hidden"
          >
            {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Logo />

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {(
              [
                ['home', ROUTES.home],
                ['liveCasino', ROUTES.liveCasino],
                ['slots', ROUTES.slots],
                ['fishing', ROUTES.fishing],
                ['lottery', ROUTES.lottery],
                ['promotions', ROUTES.promotions],
              ] as const
            ).map(([key, href]) => (
              <Link
                key={key}
                href={href}
                className="rounded-lg px-3 py-2 text-sm text-ink-mid transition hover:bg-white/5 hover:text-ink-hi"
              >
                {t(`nav.${key}`)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <LanguageToggle />
            </div>
            <Link
              href={ROUTES.wallet}
              className="hidden items-center gap-2 rounded-xl border border-neon/15 bg-base-panel/60 px-3 py-2 text-sm md:inline-flex"
            >
              <Wallet className="h-4 w-4 text-neon" />
              <span className="text-ink-hi tabular-nums">{formatBDT(currentUser.balance)}</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTab('login');
                auth.onOpen();
              }}
              className="hidden sm:inline-flex"
            >
              {t('common.login')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTab('signup');
                auth.onOpen();
              }}
            >
              {t('common.signup')}
            </Button>
          </div>
        </div>

        {mobileNav ? (
          <div className="border-t border-neon/10 bg-base-panel/95 px-4 py-3 lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <LanguageToggle compact />
              <Link
                href={ROUTES.wallet}
                onClick={() => setMobileNav(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-neon/15 bg-base-elev px-3 py-2 text-sm"
              >
                <Wallet className="h-4 w-4 text-neon" />
                <span className="tabular-nums">{formatBDT(currentUser.balance)}</span>
              </Link>
            </div>
            <MobileSidebar onSelect={() => setMobileNav(false)} />
          </div>
        ) : null}
      </header>

      <AuthModal open={auth.open} onOpenChange={auth.setOpen} initialTab={tab} />
    </>
  );
}
