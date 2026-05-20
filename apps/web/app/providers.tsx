'use client';

import { type ReactNode } from 'react';
import { LanguageProvider } from '@/lib/i18n/context';

export function Providers({ children }: { children: ReactNode }) {
  return <LanguageProvider initial="bn">{children}</LanguageProvider>;
}
