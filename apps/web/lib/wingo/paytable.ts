// Built by Anointed Coder.
//
// Pasha WinGo paytable. This module is the single source of truth for
// the number-to-colour identity and the exact total-return multipliers.
// A winning bet returns stake * multiplier; a losing bet returns 0. The
// house edge lives entirely in these numbers, never in the draw.
//
// Number-to-colour map:
//   0 = red + violet     5 = green + violet
//   1 = green            6 = red
//   2 = red              7 = green
//   3 = green            8 = red
//   4 = red              9 = green
//
// Paytable (total-return multipliers):
//   colour GREEN  -> results 1,3,7,9 pay 2.0x; result 5 pays 1.5x.
//   colour RED    -> results 2,4,6,8 pay 2.0x; result 0 pays 1.5x.
//   colour VIOLET -> results 0 or 5 pay 4.5x.
//   NUMBER 0..9   -> exact match pays 9.0x.
//   BIG (5..9)    -> pays 2.0x.  SMALL (0..4) -> pays 2.0x.

export type WingoBetType = 'color' | 'number' | 'size';
export type WingoColor = 'green' | 'red' | 'violet';
export type WingoSize = 'big' | 'small';

// Digits whose colour is pure green / pure red (the halves that pay the
// full 2.0x on a colour bet).
const GREEN_FULL = new Set([1, 3, 7, 9]);
const RED_FULL = new Set([2, 4, 6, 8]);
const BIG_SET = new Set([5, 6, 7, 8, 9]);
const SMALL_SET = new Set([0, 1, 2, 3, 4]);

// Colour identity of a drawn digit, using the schema's five-value
// vocabulary (red | green | violet-mixed variants). Persisted on the
// round for audit and rendering.
export function resultColorIdentity(result: number): 'red' | 'green' | 'red_violet' | 'green_violet' {
  if (result === 0) return 'red_violet';
  if (result === 5) return 'green_violet';
  return result % 2 === 0 ? 'red' : 'green';
}

// Size identity of a drawn digit. BIG = 5..9, SMALL = 0..4.
export function resultSize(result: number): WingoSize {
  return BIG_SET.has(result) ? 'big' : 'small';
}

// Validates a (betType, selection) pair before any wallet movement.
export function isValidSelection(betType: string, selection: string): boolean {
  switch (betType) {
    case 'color':
      return selection === 'green' || selection === 'red' || selection === 'violet';
    case 'size':
      return selection === 'big' || selection === 'small';
    case 'number':
      return /^[0-9]$/.test(selection);
    default:
      return false;
  }
}

// THE paytable. Returns the total-return multiplier for a winning bet,
// or 0 for a loss. Kept as an exact decimal-friendly JS number (1.5,
// 2.0, 4.5, 9.0 are all binary-exact) so a Prisma.Decimal multiply is
// lossless.
export function payoutMultiplier(betType: string, selection: string, result: number): number {
  switch (betType) {
    case 'color': {
      if (selection === 'green') {
        if (GREEN_FULL.has(result)) return 2.0;
        if (result === 5) return 1.5; // green + violet half
        return 0;
      }
      if (selection === 'red') {
        if (RED_FULL.has(result)) return 2.0;
        if (result === 0) return 1.5; // red + violet half
        return 0;
      }
      if (selection === 'violet') {
        return result === 0 || result === 5 ? 4.5 : 0;
      }
      return 0;
    }
    case 'number': {
      if (!/^[0-9]$/.test(selection)) return 0;
      return Number(selection) === result ? 9.0 : 0;
    }
    case 'size': {
      if (selection === 'big') return BIG_SET.has(result) ? 2.0 : 0;
      if (selection === 'small') return SMALL_SET.has(result) ? 2.0 : 0;
      return 0;
    }
    default:
      return 0;
  }
}
