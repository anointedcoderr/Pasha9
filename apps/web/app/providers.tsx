'use client';

import { type ReactNode } from 'react';
import { LanguageProvider, type Lang } from '@/lib/i18n/context';

export function Providers({ children, initialLang }: { children: ReactNode; initialLang: Lang }) {
  return <LanguageProvider initial={initialLang}>{children}</LanguageProvider>;
}
