'use client';

import { type ReactNode } from 'react';
import { LanguageProvider, type Lang } from '@/lib/i18n/context';
import { SoundProvider } from '@/lib/sounds/client';
import { AtelierProvider } from '@/lib/atelier/client';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';

export function Providers({ children, initialLang }: { children: ReactNode; initialLang: Lang }) {
  return (
    <LanguageProvider initial={initialLang}>
      <AtelierProvider>
        <SoundProvider>
          <LiveRegionProvider>{children}</LiveRegionProvider>
        </SoundProvider>
      </AtelierProvider>
    </LanguageProvider>
  );
}
