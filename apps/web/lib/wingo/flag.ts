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
import { DEFAULT_WINGO_PAYTABLE, type WingoPaytable } from './paytable';

export const WINGO_ENABLED_KEY = 'wingo_enabled';
export const WINGO_ENABLED_DEFAULT = 'false';
export const WINGO_MIN_STAKE_KEY = 'wingo_min_stake';
export const WINGO_MAX_STAKE_KEY = 'wingo_max_stake';

// Admin-editable paytable, stored as a single JSON SystemSetting row and
// frozen onto each round at open. Each field is clamped to [MIN, MAX] on
// both read and write so a bad edit can never pay an unbounded multiple.
// MIN is 0 so an operator has full control to set house-favorable rates
// below 1 (a total-return multiplier under 1 means a winner gets back less
// than their stake); 0 means that bet type pays nothing.
export const WINGO_PAYTABLE_KEY = 'wingo_paytable';
export const WINGO_PAYOUT_MIN = 0;
export const WINGO_PAYOUT_MAX = 100;

// Optional operator-managed homepage card image for the Pasha WinGo Hot
// Games card. String setting; empty / missing falls back to generated art.
export const WINGO_HOMEPAGE_IMAGE_KEY = 'wingo_homepage_image';

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

// Clamp one payout field: finite, >= MIN, <= MAX, at most 2 decimals,
// falling back to the DEFAULT for the field when the input is unusable.
function clampPayout(value: unknown, fallback: number): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  const bounded = Math.min(Math.max(v, WINGO_PAYOUT_MIN), WINGO_PAYOUT_MAX);
  return Math.round(bounded * 100) / 100;
}

// Turn any raw (possibly partial / malformed) object into a fully-clamped
// WingoPaytable. Every field falls back to the live DEFAULT independently
// so a single bad field never discards the rest.
function clampPaytable(raw: unknown): WingoPaytable {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    colorGreen: clampPayout(o.colorGreen, DEFAULT_WINGO_PAYTABLE.colorGreen),
    colorRed: clampPayout(o.colorRed, DEFAULT_WINGO_PAYTABLE.colorRed),
    colorViolet: clampPayout(o.colorViolet, DEFAULT_WINGO_PAYTABLE.colorViolet),
    colorHalf: clampPayout(o.colorHalf, DEFAULT_WINGO_PAYTABLE.colorHalf),
    number: clampPayout(o.number, DEFAULT_WINGO_PAYTABLE.number),
    big: clampPayout(o.big, DEFAULT_WINGO_PAYTABLE.big),
    small: clampPayout(o.small, DEFAULT_WINGO_PAYTABLE.small),
  };
}

// Parse a stored JSON paytable value into a clamped WingoPaytable, never
// throwing: a missing row or bad JSON returns the DEFAULT paytable.
function parsePaytableValue(value: string | null | undefined): WingoPaytable {
  if (value == null) return { ...DEFAULT_WINGO_PAYTABLE };
  try {
    return clampPaytable(JSON.parse(value));
  } catch {
    return { ...DEFAULT_WINGO_PAYTABLE };
  }
}

export interface WingoSettings {
  enabled: boolean;
  modes: Record<WingoMode, boolean>;
  minStake: number;
  maxStake: number;
  // Frozen-at-open payout multipliers, clamped on read.
  paytable: WingoPaytable;
  // Operator homepage card image, or null to use generated art.
  homepageImageUrl: string | null;
}

// Batched read of every WinGo setting in one query. Route handlers call
// this once so a state or bet request costs a single settings roundtrip.
export async function loadWingoSettings(): Promise<WingoSettings> {
  const keys = [
    WINGO_ENABLED_KEY,
    WINGO_MIN_STAKE_KEY,
    WINGO_MAX_STAKE_KEY,
    WINGO_PAYTABLE_KEY,
    WINGO_HOMEPAGE_IMAGE_KEY,
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

  const homepageImageRaw = map.get(WINGO_HOMEPAGE_IMAGE_KEY)?.trim();

  return {
    enabled: truthy(map.get(WINGO_ENABLED_KEY), false),
    modes,
    minStake,
    maxStake,
    paytable: parsePaytableValue(map.get(WINGO_PAYTABLE_KEY)),
    homepageImageUrl: homepageImageRaw ? homepageImageRaw : null,
  };
}

// Standalone paytable read for the settlement freeze choke point. Never
// throws: any failure falls back to the DEFAULT paytable so a round can
// always be opened. This is the ONLY paytable read allowed at round open;
// settlement itself must read the frozen round.paytable, never this.
export async function loadWingoPaytable(): Promise<WingoPaytable> {
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: WINGO_PAYTABLE_KEY },
      select: { value: true },
    });
    return parsePaytableValue(row?.value);
  } catch {
    return { ...DEFAULT_WINGO_PAYTABLE };
  }
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

// String-typed upsert (the boolean upsertSetting above hardcodes the
// type). Used by the homepage image setter.
async function upsertStringSetting(key: string, value: string): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    update: { value, type: 'string', category: 'general' },
    create: { key, value, type: 'string', category: 'general' },
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

// Validate + clamp every field, then persist the whole paytable as one
// JSON row. Reads (loadWingoPaytable / loadWingoSettings) clamp again, so
// even a hand-edited row can never settle out of bounds.
export async function setWingoPaytable(pt: WingoPaytable): Promise<void> {
  const clean = clampPaytable(pt);
  const value = JSON.stringify(clean);
  await db.systemSetting.upsert({
    where: { key: WINGO_PAYTABLE_KEY },
    update: { value, type: 'json', category: 'general' },
    create: { key: WINGO_PAYTABLE_KEY, value, type: 'json', category: 'general' },
  });
}

// Set (or clear) the homepage card image. Passing null / empty removes the
// row so the card falls back to generated art.
export async function setWingoHomepageImage(url: string | null): Promise<void> {
  const clean = (url ?? '').trim();
  if (!clean) {
    await db.systemSetting.deleteMany({ where: { key: WINGO_HOMEPAGE_IMAGE_KEY } });
    return;
  }
  await upsertStringSetting(WINGO_HOMEPAGE_IMAGE_KEY, clean);
}
