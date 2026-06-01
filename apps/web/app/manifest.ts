// Built by Anointed Coder.
//
// PWA manifest served at /manifest.webmanifest. Lets a player
// "Add to Home Screen" before a signed APK exists, and is also
// the asset Capacitor wraps when the APK is generated. Asset
// paths point at apps/web/public/app-assets/ - operators replace
// the placeholders before any Play Store release.

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pasha 9 | Royal Bangla Casino',
    short_name: 'Pasha 9',
    description: 'Premium Bangla casino and betting platform.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#06120c',
    theme_color: '#06120c',
    lang: 'en',
    icons: [
      {
        src: '/app-assets/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-assets/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-assets/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    categories: ['games', 'entertainment'],
  };
}
