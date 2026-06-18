// Built by Anointed Coder.
//
// /robots.txt for pasha9.com. Allows the public marketing surface to
// be indexed; blocks every admin / dashboard / API path so the
// operator console and the player wallet never leak into search.

import type { MetadataRoute } from 'next';

const SITE_URL = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'https://pasha9.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/dashboard/',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
