// Built by Anointed Coder.
//
// Site-section on/off flags, backed by SystemSetting rows, following the
// exact boolean-setting pattern used by lib/wingo/flag.ts.
//
// Two display-only sections are gated here:
//   leaderboard_enabled       the /leaderboard page + its nav entries +
//                             the 24h winnings API. Default ON.
//   recent_winners_enabled    the public LiveWinnersFeed + the
//                             /api/winners/recent feed. Default ON.
//
// Both default TRUE so the sections stay live unless an admin turns them
// off. Nothing here moves money; these gates only decide whether a
// read-only display surface renders.

import { db } from '@/lib/db/client';

export const LEADERBOARD_ENABLED_KEY = 'leaderboard_enabled';
export const RECENT_WINNERS_ENABLED_KEY = 'recent_winners_enabled';

export interface SectionFlags {
  leaderboard: boolean;
  recentWinners: boolean;
}

export const DEFAULT_SECTION_FLAGS: SectionFlags = {
  leaderboard: true,
  recentWinners: true,
};

function truthy(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'off') return false;
  return fallback;
}

// Batched read of both flags in one query. Never throws: any failure
// falls back to the defaults (both ON) so a display surface never breaks
// on a transient DB fault.
export async function loadSectionFlags(): Promise<SectionFlags> {
  const keys = [LEADERBOARD_ENABLED_KEY, RECENT_WINNERS_ENABLED_KEY];
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await db.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  } catch {
    return { ...DEFAULT_SECTION_FLAGS };
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    leaderboard: truthy(map.get(LEADERBOARD_ENABLED_KEY), DEFAULT_SECTION_FLAGS.leaderboard),
    recentWinners: truthy(map.get(RECENT_WINNERS_ENABLED_KEY), DEFAULT_SECTION_FLAGS.recentWinners),
  };
}

async function upsertBooleanSetting(key: string, value: boolean): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    update: { value: value ? 'true' : 'false', type: 'boolean', category: 'general' },
    create: { key, value: value ? 'true' : 'false', type: 'boolean', category: 'general' },
  });
}

export async function setLeaderboardEnabled(enabled: boolean): Promise<void> {
  await upsertBooleanSetting(LEADERBOARD_ENABLED_KEY, enabled);
}

export async function setRecentWinnersEnabled(enabled: boolean): Promise<void> {
  await upsertBooleanSetting(RECENT_WINNERS_ENABLED_KEY, enabled);
}
