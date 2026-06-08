// Built by Anointed Coder.
//
// PWA manifest served at /manifest.webmanifest. Lets a player
// "Add to Home Screen" before a signed APK exists, and is also
// the asset Capacitor wraps when the APK is generated. Asset
// paths point at apps/web/public/app-assets/ - operators replace
// the placeholders before any Play Store release.

import type { MetadataRoute } from 'next';
import { db } from '@/lib/db/client';

// The manifest is rendered dynamically so operator uploads (favicon,
// site name) are picked up without a redeploy. Browsers cache the
// manifest aggressively; reinstalling the PWA refreshes the icons.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const rows = await db.systemSetting
    .findMany({ where: { key: { in: ['site_name', 'favicon_url', 'favicon_version'] } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  const siteName = map.site_name ?? 'Pasha 9';
  const faviconBase = map.favicon_url ?? null;
  const version = map.favicon_version ?? '1';
  const versioned = (url: string) => {
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(version)}`;
  };
  const uploadedIcon = faviconBase ? versioned(faviconBase) : null;

  // Prefer the operator-uploaded favicon at PWA install time when set
  // so a freshly-installed Home Screen shortcut already uses it. The
  // bundled placeholder PNGs stay in the list for browsers that
  // require a specific size + purpose pair.
  const icons: MetadataRoute.Manifest['icons'] = [];
  if (uploadedIcon) {
    icons.push(
      { src: uploadedIcon, sizes: 'any', type: 'image/png', purpose: 'any' },
      { src: uploadedIcon, sizes: 'any', type: 'image/png', purpose: 'maskable' },
    );
  }
  icons.push(
    { src: '/app-assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/app-assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/app-assets/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
  );

  return {
    name: `${siteName} | Royal Bangla Casino`,
    short_name: siteName,
    description: 'Premium Bangla casino and betting platform.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#06120c',
    theme_color: '#06120c',
    lang: 'en',
    icons,
    categories: ['games', 'entertainment'],
  };
}
