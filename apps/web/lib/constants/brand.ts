/**
 * Brand constants for the live Pasha9 platform.
 * Update here when the client confirms any final brand asset.
 */
export const BRAND = {
  /** Slug used for cookies, package names, paths. */
  name: 'pasha9',
  /** Display name shown in UI, page titles, og metadata. */
  display: 'Pasha9',
  /** Domain hosting the live website. */
  domain: 'pasha9.com',
  /** Primary marketing tagline, shown on landing pages and metadata. */
  tagline: {
    bn: 'রয়্যাল বাংলা ক্যাসিনো অভিজ্ঞতা',
    en: 'Royal Bangla Casino Experience',
  },
  /** Build credit shown across the platform. */
  builtBy: 'Built by Anointed Coder',
  builderName: 'Anointed Coder',
  builderEmail: 'anointedcoder@gmail.com',
  telegram: 'https://t.me/AnointedCoder',
  whatsapp: 'https://wa.link/fi5z8a',
  copyright: 'Anointed Coder',
} as const;

export const CONTACT_LINKS = [
  { label: 'Telegram', href: BRAND.telegram, icon: 'telegram' as const },
  { label: 'WhatsApp', href: BRAND.whatsapp, icon: 'whatsapp' as const },
] as const;
