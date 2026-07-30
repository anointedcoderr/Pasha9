// Built by Anointed Coder.
//
// Free-spin allowance helpers, shared by the spin engine, the admin
// config surfaces, and the player-facing display. A daily allowance of
// -1 is the "unlimited" sentinel: the operator can turn free spins off
// (0), pin a fixed number, or allow unlimited (-1) per wheel tier or on
// the global fallback config. Kept dependency-free so both server routes
// and client components can import it.

export const UNLIMITED_FREE_SPINS = -1;

/** True when a daily free-spin allowance means "no daily cap". */
export function isUnlimitedFreeSpins(value: number | null | undefined): boolean {
  return typeof value === 'number' && value < 0;
}

/** Bilingual label for an allowance / remaining count in player-facing UI. */
export function formatFreeSpins(value: number | null | undefined, bn: boolean): string {
  if (isUnlimitedFreeSpins(value)) return bn ? 'সীমাহীন' : 'Unlimited';
  return String(Math.max(0, Math.floor(Number(value) || 0)));
}

/** UI editor mode for a free-spin allowance control. */
export type FreeSpinMode = 'off' | 'fixed' | 'unlimited';

export function freeSpinMode(value: number | null | undefined): FreeSpinMode {
  if (isUnlimitedFreeSpins(value)) return 'unlimited';
  if (!value || value <= 0) return 'off';
  return 'fixed';
}

/** Resolve a mode + optional fixed count back to the stored allowance value. */
export function freeSpinValue(mode: FreeSpinMode, fixed: number): number {
  if (mode === 'unlimited') return UNLIMITED_FREE_SPINS;
  if (mode === 'off') return 0;
  return Math.max(1, Math.floor(Number(fixed) || 1));
}
