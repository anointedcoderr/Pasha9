// Built by Anointed Coder.
//
// Pasha WinGo colour-prediction config. Defines the four independent
// round modes, their timing, the tags baked into the human-facing
// period number, the stake limits and the bilingual labels reused by
// the player UI and the admin console.
//
// The whole scheduler is anchored to a fixed epoch (WINGO_EPOCH_MS) so
// that, given a mode and a wall-clock instant, the current round window
// and its period number are computed deterministically without reading
// the database. Every round for a mode starts exactly where the
// previous one drew, so the stream is continuous.

export const WINGO_GAME_CODE = 'wingo';

export type WingoMode = 'wingo_30s' | 'wingo_1m' | 'wingo_3m' | 'wingo_5m';

export interface WingoModeConfig {
  mode: WingoMode;
  // Full round length. betCloseAt = drawsAt - WINGO_BET_CLOSE_LEAD_MS.
  durationMs: number;
  // Zero-padded seconds string embedded in the period number so the id
  // is self-describing (0030 / 0060 / 0180 / 0300).
  secondsTag: string;
  labelEn: string;
  labelBn: string;
}

export const WINGO_MODES: Record<WingoMode, WingoModeConfig> = {
  wingo_30s: { mode: 'wingo_30s', durationMs: 30_000, secondsTag: '0030', labelEn: 'WinGo 30 Seconds', labelBn: 'উইনগো ৩০ সেকেন্ড' },
  wingo_1m: { mode: 'wingo_1m', durationMs: 60_000, secondsTag: '0060', labelEn: 'WinGo 1 Minute', labelBn: 'উইনগো ১ মিনিট' },
  wingo_3m: { mode: 'wingo_3m', durationMs: 180_000, secondsTag: '0180', labelEn: 'WinGo 3 Minutes', labelBn: 'উইনগো ৩ মিনিট' },
  wingo_5m: { mode: 'wingo_5m', durationMs: 300_000, secondsTag: '0300', labelEn: 'WinGo 5 Minutes', labelBn: 'উইনগো ৫ মিনিট' },
};

export const WINGO_MODE_LIST: WingoMode[] = ['wingo_30s', 'wingo_1m', 'wingo_3m', 'wingo_5m'];

export function isWingoMode(value: string): value is WingoMode {
  return Object.prototype.hasOwnProperty.call(WINGO_MODES, value);
}

// Betting locks this many milliseconds before the draw. The last 5
// seconds are the CLOSED window and the UI takeover.
export const WINGO_BET_CLOSE_LEAD_MS = 5_000;

// Stake limits (BDT). Min applies to the unit stake of a bet line; max
// applies to the TOTAL of the line after the quantity chip is applied
// (unitAmount * quantity <= WINGO_MAX_STAKE). These are the hard engine
// bounds; an operator may tighten them through admin config but never
// loosen past these without a code change.
export const WINGO_MIN_STAKE = 1;
export const WINGO_MAX_STAKE = 100_000;

// Quantity / multiplier chip bounds (X1..X100).
export const WINGO_MIN_QUANTITY = 1;
export const WINGO_MAX_QUANTITY = 100;

// ---------- Deterministic scheduler anchor ----------
//
// Bangladesh Standard Time is a fixed UTC+6 with no daylight saving, so
// a single offset gives a stable calendar day for the period number and
// a clean per-day round sequence. The epoch is pinned to a BST midnight
// (2024-01-01 00:00:00 +06:00) and every mode duration divides a day
// evenly (86400 / 30, / 60, / 180, / 300 are all integers), so each
// calendar day is tiled by a whole number of rounds and the per-day
// sequence resets exactly at local midnight.
export const WINGO_TZ_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6
export const WINGO_DAY_MS = 24 * 60 * 60 * 1000;
// 2023-12-31T18:00:00Z == 2024-01-01T00:00:00+06:00.
export const WINGO_EPOCH_MS = Date.UTC(2023, 11, 31, 18, 0, 0, 0);

// ---------- Per-player throttle (bet + state polling) ----------
//
// Keeps a runaway client from hammering the wallet path. Matches the
// native-games throttle shape.
export const WINGO_RATE_MAX = 60;
export const WINGO_RATE_WINDOW_MS = 60_000;
