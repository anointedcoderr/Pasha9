'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import bn from './dictionaries/bn.json';
import en from './dictionaries/en.json';

export type Lang = 'bn' | 'en';
type Dict = typeof bn;

const DICTS: Record<Lang, Dict> = { bn: bn as Dict, en: en as Dict };

export const LANG_COOKIE = 'pasha9_lang';
export const LANG_STORAGE_KEY = 'pasha9:lang';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

function isLang(value: unknown): value is Lang {
  return value === 'bn' || value === 'en';
}

/**
 * Read the persisted language on the client. Cookie first (this is what
 * SSR reads on the next request), then localStorage as a fallback for
 * app webviews where the cookie sometimes does not ride the very first
 * navigation. Returns null when nothing usable is stored. Guarded so it
 * is a no-op during server rendering.
 */
function readPersistedLang(): Lang | null {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)pasha9_lang=(bn|en)\b/);
    if (match && isLang(match[1])) return match[1];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (isLang(stored)) return stored;
    }
  } catch {
    // localStorage may be unavailable (private mode, embedded webview).
  }
  return null;
}

/**
 * Persist the chosen language to the cookie (so SSR resolves it on the
 * next request) and to localStorage (so we can correct SSR on mount when
 * the cookie did not arrive). Also stamps the html element so CSS and
 * screen readers stay in sync. Adds Secure on https, keeps SameSite=Lax,
 * path=/ and a 1-year lifetime. Guarded for SSR safety.
 */
function writePersistedLang(next: Lang): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${LANG_COOKIE}=${next}; max-age=${COOKIE_MAX_AGE_SECONDS}; path=/; samesite=lax${secure}`;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {
    // localStorage may be unavailable (private mode, embedded webview); cookie is enough.
  }
  document.documentElement.setAttribute('lang', next);
  document.documentElement.dataset.lang = next;
}

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
 * When the user toggles, we persist to both cookie (for SSR) and localStorage.
 *
 * On mount we reconcile the SSR value with what is actually persisted: if the
 * cookie did not ride the first request (common in the app webview) SSR falls
 * back to Bangla, so we read the stored preference (cookie, then localStorage)
 * and, when it differs, apply it and re-write the cookie so the next SSR render
 * is already correct. This is what makes an English choice survive a refresh.
 */
export function LanguageProvider({ children, initial }: { children: ReactNode; initial: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writePersistedLang(next);
  }, []);

  // Correct the SSR fallback from the persisted preference after mount.
  // Runs once; guarded window/document access lives inside the helpers so
  // there is no server access and no hydration mismatch (state only changes
  // in an effect, never during render).
  useEffect(() => {
    const persisted = readPersistedLang();
    if (!persisted) return;
    if (persisted !== lang) {
      setLangState(persisted);
    }
    // Re-write so the cookie is present and correct for the next SSR render,
    // even when the value only lived in localStorage this load.
    writePersistedLang(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
