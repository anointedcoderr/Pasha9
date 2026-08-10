'use client';

import { useEffect, type ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { FloatingContact } from '@/components/site/FloatingContact';
import { AnnouncementPopup } from '@/components/site/AnnouncementPopup';
import { RegistrationBonusPopup } from '@/components/site/RegistrationBonusPopup';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useT } from '@/lib/i18n/context';

const SKIP_LINK_CLASS =
  'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-pill focus:bg-brand-blue-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useT();
  useEffect(() => {
    document.body.classList.add('theme-light');
    return () => { document.body.classList.remove('theme-light'); };
  }, []);

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col pb-[calc(116px+env(safe-area-inset-bottom))] lg:pb-0">
        <a href="#main-content" className={SKIP_LINK_CLASS}>
          {t('common.skipToContent')}
        </a>
        <Header />
        <div className="mx-auto w-full max-w-page grow px-4 py-6 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <DashboardNav />
            <main id="main-content" tabIndex={-1} className="min-w-0">{children}</main>
          </div>
        </div>
        <Footer />
        <FloatingContact />
        {/* Popups were mounted only in the (site) layout, so nothing could
            ever appear on a /dashboard/* page - Referral Center included,
            which is where the bottom nav's Referral link goes. A custom-URL
            popup pointed at one of these pages simply never rendered. */}
        <AnnouncementPopup />
        <RegistrationBonusPopup />
      </div>
    </TooltipProvider>
  );
}
