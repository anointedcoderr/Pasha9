// Built by Anointed Coder.
//
// Client hook that reads the two site-section on/off flags from the cheap
// public endpoint GET /api/content/section-flags so the nav and display
// components can gate themselves. A module-level cache with a short TTL is
// shared across every consumer (Sidebar, MobileDrawer, feeds) so a page
// render costs at most one network round-trip, not one per component.
//
// It fails open: until the first response arrives, and on any error, both
// sections are treated as ENABLED so navigation never disappears on a
// transient fault. Display only, no money movement.

'use client';

import { useEffect, useState } from 'react';

export interface SectionFlags {
  leaderboard: boolean;
  recentWinners: boolean;
}

const DEFAULT_FLAGS: SectionFlags = { leaderboard: true, recentWinners: true };
const TTL_MS = 20000;

let cache: SectionFlags | null = null;
let cachedAt = 0;
let inflight: Promise<SectionFlags> | null = null;

async function fetchFlags(): Promise<SectionFlags> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/content/section-flags', { cache: 'no-store' });
      if (!res.ok) return cache ?? DEFAULT_FLAGS;
      const data = await res.json().catch(() => null);
      const next: SectionFlags = {
        leaderboard: data?.leaderboard !== false,
        recentWinners: data?.recentWinners !== false,
      };
      cache = next;
      cachedAt = Date.now();
      return next;
    } catch {
      return cache ?? DEFAULT_FLAGS;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useSectionFlags(): SectionFlags {
  const [flags, setFlags] = useState<SectionFlags>(cache ?? DEFAULT_FLAGS);

  useEffect(() => {
    let alive = true;
    fetchFlags().then((f) => {
      if (alive) setFlags(f);
    });
    return () => {
      alive = false;
    };
  }, []);

  return flags;
}
