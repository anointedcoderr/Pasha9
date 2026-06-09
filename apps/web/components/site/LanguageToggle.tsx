// Built by Anointed Coder.
'use client';

import { useLang } from '@/lib/i18n/context';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Tone = 'light' | 'dark';

export function LanguageToggle({ compact, tone = 'light' }: { compact?: boolean; tone?: Tone }) {
  const { lang, setLang } = useLang();

  const wrap =
    tone === 'light'
      ? 'border-brand-divider bg-brand-surface'
      : 'border-neon/15 bg-base-panel/60';
  const inactive = tone === 'light' ? 'text-brand-inkSoft hover:text-brand-ink' : 'text-ink-mid hover:text-ink-hi';
  const activeBg = tone === 'light' ? 'btn-yellow' : 'btn-gold';
  const activeText = tone === 'light' ? 'text-brand-ink' : 'text-base-deep';
  const iconClass = tone === 'light' ? 'text-brand-inkMute' : 'text-ink-lo';

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full border p-1', wrap, compact ? 'h-10' : 'h-11')}>
      <Globe className={cn('ml-2 mr-1 h-4 w-4', iconClass)} aria-hidden />
      <button
        type="button"
        onClick={() => setLang('bn')}
        className={cn(
          'min-w-[40px] rounded-full px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40',
          compact ? 'h-8' : 'h-9',
          lang === 'bn' ? `${activeBg} ${activeText}` : inactive,
        )}
        aria-label="Bangla"
        aria-pressed={lang === 'bn'}
      >
        BN
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={cn(
          'min-w-[40px] rounded-full px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40',
          compact ? 'h-8' : 'h-9',
          lang === 'en' ? `${activeBg} ${activeText}` : inactive,
        )}
        aria-label="English"
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
    </div>
  );
}
