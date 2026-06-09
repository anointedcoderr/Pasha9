// Built by Anointed Coder.
//
// Atelier asset URL provider. One fetch per session; components
// read by slot id. Components have CSS-only fallbacks so missing
// assets never break the layout.

'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface AssetMap { [slotId: string]: string | null; }

const AssetContext = createContext<AssetMap | null>(null);

export function AtelierProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<AssetMap | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/atelier', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const next: AssetMap = {};
        const src = (j?.assets ?? {}) as Record<string, string | null>;
        for (const k in src) next[k] = src[k];
        setMap(next);
      })
      .catch(() => { /* keep null; fallbacks render */ });
    return () => { alive = false; };
  }, []);

  const value = useMemo(() => map, [map]);
  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export function useAsset(slotId: string): string | null {
  const map = useContext(AssetContext);
  if (!map) return null;
  return map[slotId] ?? null;
}
