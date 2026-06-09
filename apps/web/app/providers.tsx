'use client';

import { type ReactNode } from 'react';
import { LanguageProvider, type Lang } from '@/lib/i18n/context';
import { SoundProvider } from '@/lib/sounds/client';
import { AtelierProvider } from '@/lib/atelier/client';

export function Providers({ children, initialLang }: { children: ReactNode; initialLang: Lang }) {
  return (
    <LanguageProvider initial={initialLang}>
      <AtelierProvider>
        <SoundProvider>{children}</SoundProvider>
      </AtelierProvider>
    </LanguageProvider>
  );
}
