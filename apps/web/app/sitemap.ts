// Built by Anointed Coder.
//
// /sitemap.xml for pasha9.com. Emits the public marketing pages so
// Googlebot / Bing crawler can discover them. Operator can extend the
// list by editing the STATIC_PATHS array. Game / promotion landing
// pages are added dynamically from the DB once we expose
// public-readable slugs - kept minimal here for the handover.

import type { MetadataRoute } from 'next';

const SITE_URL = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'https://pasha9.com';

const STATIC_PATHS: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/promotions', changeFrequency: 'daily', priority: 0.9 },
  { path: '/games', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/live-casino', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/sports', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/lotto', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/rewards', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/affiliate', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/referral', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
