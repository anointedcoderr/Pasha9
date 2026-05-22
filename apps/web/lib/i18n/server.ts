import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, type Lang } from './context';

/**
 * Resolves the visitor language on the server, before any React renders.
 *
 * Order:
 *  1. `pasha9_lang` cookie if it holds 'bn' or 'en' (set by the LanguageToggle).
 *  2. `Accept-Language` header, only honoured if it starts with 'bn'.
 *  3. Default to 'bn'. The target market is Bangladesh, so we never fall back to English
 *     for first-time visitors.
 *
 * Because this runs in the root layout, the html `lang` attribute and the initial
 * dictionary lookup both use the same value, eliminating any English-to-Bangla flash.
 */
export function resolveLang(): Lang {
  const cookieValue = cookies().get(LANG_COOKIE)?.value;
  if (cookieValue === 'bn' || cookieValue === 'en') return cookieValue;

  const accept = headers().get('accept-language') ?? '';
  if (accept.trim().toLowerCase().startsWith('bn')) return 'bn';

  return 'bn';
}
