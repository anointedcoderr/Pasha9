// Built by Anointed Coder.
//
// Reads /api/content/branding on mount and, if the operator has set a
// favicon URL under /admin/website, swaps the document's icon <link>
// to that URL. Falls back to whatever was set in metadata.icons.
//
// Tiny, safe and self-contained: only runs once per page load, no
// react re-renders, no flicker if no remote URL is set.

'use client';

import { useEffect } from 'react';

export function DynamicFavicon() {
  useEffect(() => {
    let cancelled = false;
    fetch('/api/content/branding', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.faviconUrl) return;
        const href = String(data.faviconUrl);
        // Remove existing favicon link tags so the browser picks the new one.
        document.querySelectorAll('link[rel~="icon"]').forEach((node) => node.remove());
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = href;
        document.head.appendChild(link);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return null;
}
