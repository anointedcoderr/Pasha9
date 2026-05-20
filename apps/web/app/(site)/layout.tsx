import { type ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Sidebar } from '@/components/site/Sidebar';
import { Footer } from '@/components/site/Footer';
import { FloatingContact } from '@/components/site/FloatingContact';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto flex max-w-page gap-6 px-4 py-6 md:px-6">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <Footer />
        <FloatingContact />
      </div>
    </TooltipProvider>
  );
}
