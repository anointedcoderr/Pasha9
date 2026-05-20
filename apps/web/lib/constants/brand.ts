export const BRAND = {
  /** Temporary site brand name until the client finalizes the production brand */
  name: 'sanjid14',
  display: 'sanjid14',
  tagline: {
    bn: 'রয়্যাল বাংলা ক্যাসিনো অভিজ্ঞতা',
    en: 'Royal Bangla Casino Experience',
  },
  /** Build credit shown across the platform */
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
