'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import bn from './dictionaries/bn.json';
import en from './dictionaries/en.json';

export type Lang = 'bn' | 'en';
type Dict = typeof bn;

const DICTS: Record<Lang, Dict> = { bn: bn as Dict, en: en as Dict };

export const LANG_COOKIE = 'sanjid14_lang';
export const LANG_STORAGE_KEY = 'sanjid14:lang';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

type Ctx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

function resolve(dict: Dict, path: string): string {
  const parts = path.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof node === 'string' ? node : path;
}

/**
 * The language is resolved on the server in `app/layout.tsx` and passed in via `initial`.
 * No client-side useEffect reads storage, so there is never a render with the wrong language.
 * When the user toggles, we persist to both cookie (for SSR) and localStorage (for offline reads).
 */
export function LanguageProvider({ children, initial }: { children: ReactNode; initial: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof document !== 'undefined') {
      document.cookie = `${LANG_COOKIE}=${next}; max-age=${COOKIE_MAX_AGE_SECONDS}; path=/; samesite=lax`;
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        // localStorage may be unavailable (private mode, embedded webview); cookie is enough.
      }
      document.documentElement.setAttribute('lang', next);
      document.documentElement.dataset.lang = next;
    }
  }, []);

  const t = useCallback(
    (path: string) => {
      const value = resolve(DICTS[lang], path);
      if (value !== path) return value;
      return resolve(DICTS.en, path);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}

export function useT() {
  return useLang().t;
}
