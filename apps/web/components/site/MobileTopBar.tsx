// Built by Anointed Coder.
//
// Mobile app-download strip. Sits ABOVE the sticky header. The strip
// reserves a fixed slot on first paint to prevent a layout shift when
// the localStorage dismissal check runs in useEffect - the header
// used to jump downward after hydration on a fresh refresh.

'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

const DISMISS_KEY = 'pasha9_app_strip_dismissed';

// Visual states:
//   'pending'   - effect has not run or the /api/content/apk probe has
//                 not resolved; render a hidden skeleton at the same
//                 height as 'open' so the header sits at its final Y
//                 from frame 1
//   'open'      - real strip visible (APK url is configured)
//   'closed'    - strip dismissed, or no APK url configured; height
//                 collapses to 0 and the header rises to top. Like
//                 AppDownloadSection, the strip never links to the dead
//                 /apk fallback - it simply stays hidden until the
//                 operator sets the download URL.
type State = 'pending' | 'open' | 'closed';

export function MobileTopBar() {
  const t = useT();
  const [state, setState] = useState<State>('pending');
  const [apkUrl, setApkUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const dismissed = typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
    if (dismissed) { setState('closed'); return; }
    fetch('/api/content/apk')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        const url = typeof data?.url === 'string' && data.url.trim() ? (data.url as string) : null;
        setApkUrl(url);
        setState(url ? 'open' : 'closed');
      })
      .catch(() => { if (alive) setState('closed'); });
    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1');
    setState('closed');
  };

  if (state === 'closed') return null;

  // Pre-hydration skeleton holds the same height + border so the
  // header below does not shift when the real strip materialises.
  if (state === 'pending' || !apkUrl) {
    return (
      <div aria-hidden className="flex h-[57px] items-center border-b border-brand-divider bg-brand-paper lg:hidden" />
    );
  }

  return (
    <div className="flex h-[57px] items-center gap-2 border-b border-brand-divider bg-brand-paper px-3 py-2 lg:hidden">
      <button
        type="button"
        aria-label="Dismiss app download"
        onClick={dismiss}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-inkMute hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
      >
        <X className="h-4 w-4" />
      </button>
      <span role="img" aria-label="Pasha 9" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-grad-yellow text-brand-ink">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z" stroke="#0F1115" strokeWidth="1.6" />
          <path d="M12 8 L15 12 L12 16 L9 12 Z" fill="#0F1115" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-brand-ink">{t('navx.downloadApp')}</p>
        <p className="truncate text-[11px] text-brand-inkMute">Pasha 9</p>
      </div>
      <a
        href={apkUrl}
        target="_blank"
        rel="noreferrer"
        className="btn-yellow inline-flex h-11 items-center rounded-lg px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
      >
        {t('navx.downloadApp')}
      </a>
    </div>
  );
}
