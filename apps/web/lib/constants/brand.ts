/**
 * Brand constants for the live Pasha 9 platform.
 *
 * `BRAND.developer.*` is the build credit and is shown only in:
 *   - the last line of the public footer
 *   - the admin sidebar credit block
 *   - the admin login card
 *   - the admin source handover page
 *
 * It is NOT the public support contact. Public support contacts (Telegram,
 * WhatsApp, support email) are stored in the SystemSetting table and shown
 * to end users only when the client has populated them via the admin panel.
 */
export const BRAND = {
  /** URL-safe slug used in cookies, package names, paths. */
  name: 'pasha9',
  /** Display name shown in UI, page titles, og metadata. */
  display: 'Pasha 9',
  /** Domain hosting the live website. */
  domain: 'pasha9.com',
  /** Primary marketing tagline, shown on landing pages and metadata. */
  tagline: {
    bn: 'রয়্যাল বাংলা ক্যাসিনো অভিজ্ঞতা',
    en: 'Royal Bangla Casino Experience',
  },
  /** Build credit, displayed in restricted surfaces only. Not the public support contact. */
  developer: {
    label: 'Built by Anointed Coder',
    name: 'Anointed Coder',
    email: 'info@anointedcoder.com',
    telegram: 'https://t.me/anointedcoder',
    whatsapp: 'https://wa.link/fi5z8a',
  },
  /** Copyright holder for the platform. */
  copyright: 'Pasha 9',
} as const;
