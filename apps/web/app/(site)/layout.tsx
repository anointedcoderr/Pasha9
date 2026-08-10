// Built by Anointed Coder.
'use client';

import { useEffect, type ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { FloatingContact } from '@/components/site/FloatingContact';
import { NotificationAutoPrompt } from '@/components/site/NotificationAutoPrompt';
import { CashbackCelebration } from '@/components/site/CashbackCelebration';
import { RewardCelebration } from '@/components/site/RewardCelebration';
import { AnnouncementPopup } from '@/components/site/AnnouncementPopup';
import { RegistrationBonusPopup } from '@/components/site/RegistrationBonusPopup';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useT } from '@/lib/i18n/context';

const SKIP_LINK_CLASS =
  'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-pill focus:bg-brand-blue-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export default function SiteLayout({ children }: { children: ReactNode }) {
  const t = useT();
  // Apply the light theme to the body for every public-site route. The
  // legacy dark tokens remain available for the dashboard and admin until
  // they migrate.
  useEffect(() => {
    document.body.classList.add('theme-light');
    return () => { document.body.classList.remove('theme-light'); };
  }, []);

  // Bottom-nav clearance. The StickyBottomNav itself is fixed and
  // adds its own env(safe-area-inset-bottom) padding. The wrapping
  // div has to reserve enough space underneath the main content so a
  // tall scrolling page does not leave its last cards/buttons hidden
  // behind the nav at the bottom of the viewport. nav height + safe
  // area on iPhone X+ peaks around 110px; we reserve 116 to absorb
  // 12px chat-button overlap room as well. min-h-dvh keeps the
  // layout stable when the iOS Safari address bar collapses (the
  // legacy 100vh / min-h-screen jumps with the URL bar).
  return (
    <TooltipProvider>
      <div className="flex min-h-dvh w-full flex-col overflow-x-hidden pb-[calc(116px+env(safe-area-inset-bottom))] lg:pb-0">
        <a href="#main-content" className={SKIP_LINK_CLASS}>
          {t('common.skipToContent')}
        </a>
        <Header />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-page grow px-3 py-4 md:px-6">
          {children}
        </main>
        <Footer />
        <FloatingContact />
        <NotificationAutoPrompt />
        <CashbackCelebration />
        <RewardCelebration />
        <AnnouncementPopup />
        <RegistrationBonusPopup />
      </div>
    </TooltipProvider>
  );
}
