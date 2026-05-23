// Built by Anointed Coder.
// Top app-download strip that appears only on small screens and only until
// the visitor dismisses it. The download link comes from the
// `apk_download_url` system setting; if it's empty the strip stays hidden.

'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

const DISMISS_KEY = 'pasha9_app_strip_dismissed';

export function MobileTopBar() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [apkUrl, setApkUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1') return;
    setOpen(true);
    fetch('/api/content/apk')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.url) setApkUrl(data.url as string);
      })
      .catch(() => {});
  }, []);

  if (!open) return null;

  const dismiss = () => {
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 border-b border-brand-divider bg-brand-paper px-3 py-2 lg:hidden">
      <button
        type="button"
        aria-label="Dismiss app download"
        onClick={dismiss}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-inkMute hover:bg-brand-surface"
      >
        <X className="h-4 w-4" />
      </button>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-grad-yellow text-brand-ink">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z" stroke="#0F1115" strokeWidth="1.6" />
          <path d="M12 8 L15 12 L12 16 L9 12 Z" fill="#0F1115" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-brand-ink">{t('navx.downloadApp')}</p>
        <p className="truncate text-[11px] text-brand-inkMute">Pasha 9</p>
      </div>
      <a
        href={apkUrl ?? '/apk'}
        target={apkUrl ? '_blank' : undefined}
        rel={apkUrl ? 'noreferrer' : undefined}
        className="btn-yellow inline-flex h-9 items-center rounded-lg px-4 text-sm"
      >
        {t('navx.downloadApp')}
      </a>
    </div>
  );
}
