// Built by Anointed Coder.
//
// Pasha WinGo enable gates and stake-limit config, backed by
// SystemSetting rows. The game ships DISABLED by default: the global
// gate `wingo_enabled` defaults to 'false', so every /api/games/wingo*
// route reports a disabled state until an admin turns it on, exactly
// like the native games gate on native_games_enabled.
//
// Keys:
//   wingo_enabled                 global on/off ('true' | 'false'), default OFF
//   wingo_<mode>_enabled          per-mode on/off, default ON (only
//                                 consulted when the global gate is on)
//   wingo_min_stake               unit-stake minimum (BDT), default 1
//   wingo_max_stake               per-line total maximum (BDT), default 100000
//
// The stake limits are clamped to the engine's hard bounds
// (WINGO_MIN_STAKE / WINGO_MAX_STAKE): an operator may tighten them but
// never loosen past the code-enforced ceiling.

import { db } from '@/lib/db/client';
import {
  WINGO_MODE_LIST,
  WINGO_MIN_STAKE,
  WINGO_MAX_STAKE,
  isWingoMode,
  type WingoMode,
} from './config';

export const WINGO_ENABLED_KEY = 'wingo_enabled';
export const WINGO_ENABLED_DEFAULT = 'false';
export const WINGO_MIN_STAKE_KEY = 'wingo_min_stake';
export const WINGO_MAX_STAKE_KEY = 'wingo_max_stake';

export function wingoModeEnabledKey(mode: WingoMode): string {
  return `wingo_${mode}_enabled`;
}

function truthy(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'off') return false;
  return fallback;
}

function clampMin(n: number): number {
  if (!Number.isFinite(n)) return WINGO_MIN_STAKE;
  return Math.min(Math.max(n, WINGO_MIN_STAKE), WINGO_MAX_STAKE);
}

function clampMax(n: number): number {
  if (!Number.isFinite(n)) return WINGO_MAX_STAKE;
  return Math.min(Math.max(n, WINGO_MIN_STAKE), WINGO_MAX_STAKE);
}

export interface WingoSettings {
  enabled: boolean;
  modes: Record<WingoMode, boolean>;
  minStake: number;
  maxStake: number;
}

// Batched read of every WinGo setting in one query. Route handlers call
// this once so a state or bet request costs a single settings roundtrip.
export async function loadWingoSettings(): Promise<WingoSettings> {
  const keys = [
    WINGO_ENABLED_KEY,
    WINGO_MIN_STAKE_KEY,
    WINGO_MAX_STAKE_KEY,
    ...WINGO_MODE_LIST.map((m) => wingoModeEnabledKey(m)),
  ];
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await db.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  } catch {
    rows = [];
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const modes = {} as Record<WingoMode, boolean>;
  for (const m of WINGO_MODE_LIST) {
    modes[m] = truthy(map.get(wingoModeEnabledKey(m)), true);
  }

  const minRaw = Number(map.get(WINGO_MIN_STAKE_KEY));
  const maxRaw = Number(map.get(WINGO_MAX_STAKE_KEY));
  let minStake = map.has(WINGO_MIN_STAKE_KEY) ? clampMin(minRaw) : WINGO_MIN_STAKE;
  let maxStake = map.has(WINGO_MAX_STAKE_KEY) ? clampMax(maxRaw) : WINGO_MAX_STAKE;
  if (minStake > maxStake) {
    // Guard against an operator inverting the bounds.
    minStake = WINGO_MIN_STAKE;
    maxStake = WINGO_MAX_STAKE;
  }

  return {
    enabled: truthy(map.get(WINGO_ENABLED_KEY), false),
    modes,
    minStake,
    maxStake,
  };
}

export async function isWingoEnabled(): Promise<boolean> {
  const s = await loadWingoSettings();
  return s.enabled;
}

// A mode is playable only when the global gate is on AND the mode gate
// is on. Unknown modes are never enabled.
export async function isWingoModeEnabled(mode: string): Promise<boolean> {
  if (!isWingoMode(mode)) return false;
  const s = await loadWingoSettings();
  return s.enabled && s.modes[mode];
}

// ---------- Setters (used by the admin config surface) ----------

async function upsertSetting(key: string, value: string): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    update: { value, type: 'boolean', category: 'general' },
    create: { key, value, type: 'boolean', category: 'general' },
  });
}

export async function setWingoEnabled(enabled: boolean): Promise<void> {
  await upsertSetting(WINGO_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function setWingoModeEnabled(mode: WingoMode, enabled: boolean): Promise<void> {
  await upsertSetting(wingoModeEnabledKey(mode), enabled ? 'true' : 'false');
}

export async function setWingoStakeLimits(minStake: number, maxStake: number): Promise<void> {
  const min = clampMin(minStake);
  const max = clampMax(maxStake);
  await db.systemSetting.upsert({
    where: { key: WINGO_MIN_STAKE_KEY },
    update: { value: String(min), type: 'number', category: 'general' },
    create: { key: WINGO_MIN_STAKE_KEY, value: String(min), type: 'number', category: 'general' },
  });
  await db.systemSetting.upsert({
    where: { key: WINGO_MAX_STAKE_KEY },
    update: { value: String(max), type: 'number', category: 'general' },
    create: { key: WINGO_MAX_STAKE_KEY, value: String(max), type: 'number', category: 'general' },
  });
}
