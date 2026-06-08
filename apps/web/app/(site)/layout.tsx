// Built by Anointed Coder.
'use client';

import { useEffect, type ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { FloatingContact } from '@/components/site/FloatingContact';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function SiteLayout({ children }: { children: ReactNode }) {
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
        <Header />
        <main className="mx-auto w-full max-w-page grow px-3 py-4 md:px-6">
          {children}
        </main>
        <Footer />
        <FloatingContact />
      </div>
    </TooltipProvider>
  );
}
