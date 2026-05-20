'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import bn from './dictionaries/bn.json';
import en from './dictionaries/en.json';

export type Lang = 'bn' | 'en';
type Dict = typeof bn;

const DICTS: Record<Lang, Dict> = { bn: bn as Dict, en: en as Dict };
const STORAGE_KEY = 'sanjid14:lang';

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

export function LanguageProvider({ children, initial = 'bn' }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Lang | null) : null;
    if (stored && stored !== lang) setLangState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
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
