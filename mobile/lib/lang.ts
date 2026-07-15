// Built by Anointed Coder.
//
// Minimal app-wide language store (en/bn), mirroring the web useLang hook so
// the header language pill and the bottom-tab labels switch together. The web
// app ships a full i18n context; the player app only needs a two-value toggle
// shared across chrome components, so this is a tiny module-level store read
// through useSyncExternalStore. No provider is required: any component can call
// useAppLang() and every reader re-renders when setAppLang runs.

import { useSyncExternalStore } from 'react';

export type AppLang = 'en' | 'bn';

let current: AppLang = 'en';
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AppLang {
  return current;
}

export function setAppLang(next: AppLang) {
  if (next === current) return;
  current = next;
  emit();
}

export function toggleAppLang() {
  setAppLang(current === 'en' ? 'bn' : 'en');
}

/** Returns the active language plus setters. Re-renders on any language change. */
export function useAppLang() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { lang, setLang: setAppLang, toggle: toggleAppLang };
}
