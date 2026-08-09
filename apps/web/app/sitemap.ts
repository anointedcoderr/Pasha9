// Built by Anointed Coder.
//
// /sitemap.xml for pasha9.com. Emits the public marketing pages so
// Googlebot / Bing crawler can discover them. Operator can extend the
// list by editing the STATIC_PATHS array. Game / promotion landing
// pages are added dynamically from the DB once we expose
// public-readable slugs - kept minimal here for the handover.

import type { MetadataRoute } from 'next';

const SITE_URL = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'https://pasha9.com';

// Every entry must be a real, indexable page with its own metadata. A sitemap
// listing pages that share one generic title tells a crawler they are
// near-duplicates, which is worse than not listing them - each of these now
// has its own title and description via its route layout.
const STATIC_PATHS: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/promotions', changeFrequency: 'daily', priority: 0.9 },
  { path: '/games', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/slots', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/live-casino', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/sports', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/lotto', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/rewards', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/betting-pass', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/affiliate', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/referral', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/responsible-gaming', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
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
