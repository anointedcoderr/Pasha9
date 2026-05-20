'use client';

import { useLang } from '@/lib/i18n/context';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function LanguageToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full border border-neon/15 bg-base-panel/60 p-1', compact ? 'h-9' : 'h-10')}>
      <Globe className="ml-2 mr-1 h-4 w-4 text-ink-lo" />
      <button
        type="button"
        onClick={() => setLang('bn')}
        className={cn(
          'rounded-full px-3 text-sm font-medium transition',
          compact ? 'h-7' : 'h-8',
          lang === 'bn' ? 'btn-gold text-base-deep' : 'text-ink-mid hover:text-ink-hi',
        )}
        aria-pressed={lang === 'bn'}
      >
        BN
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={cn(
          'rounded-full px-3 text-sm font-medium transition',
          compact ? 'h-7' : 'h-8',
          lang === 'en' ? 'btn-gold text-base-deep' : 'text-ink-mid hover:text-ink-hi',
        )}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
    </div>
  );
}
