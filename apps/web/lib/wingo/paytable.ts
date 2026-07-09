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

// The admin-editable payout table. Every winning bet reads its total-return
// multiplier from one of these fields. Frozen onto each WingoRound at open
// so an edit can never change what an already-placed bet pays.
//   colorGreen  pure-green result (1,3,7,9) on a Green bet
//   colorRed    pure-red result (2,4,6,8) on a Red bet
//   colorViolet result 0 or 5 on a Violet bet
//   colorHalf   the 1.5x half case: Green on result 5, Red on result 0
//   number      exact digit match on a Number bet
//   big         result 5..9 on a Big bet
//   small       result 0..4 on a Small bet
export interface WingoPaytable {
  colorGreen: number;
  colorRed: number;
  colorViolet: number;
  colorHalf: number;
  number: number;
  big: number;
  small: number;
}

// The current live numbers. Any round with a null paytable (pre-feature
// rounds) settles against exactly these, so the feature is a zero
// settlement-regression change on historical rounds.
export const DEFAULT_WINGO_PAYTABLE: WingoPaytable = {
  colorGreen: 2,
  colorRed: 2,
  colorViolet: 4.5,
  colorHalf: 1.5,
  number: 9,
  big: 2,
  small: 2,
};

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

// Hard ceiling on any multiplier read at settlement. Mirrors the write-side
// clamp (flag.ts WINGO_PAYOUT_MAX) so the settlement reader never trusts that
// the stored value was already bounded: a corrupt or hand-edited DB row can
// never pay out an uncapped multiplier.
export const WINGO_PAYOUT_CEILING = 100;

// Coerce any stored / untrusted value into a complete WingoPaytable,
// falling back to DEFAULT per field. Pure so it is safe to call at
// settlement on a round's frozen paytable JSON and in the client state
// route. A field that is not a finite number is floored at >= 1, capped at
// WINGO_PAYOUT_CEILING, and falls back to the DEFAULT when absent, so a
// null, partial, or corrupt blob never breaks or over-pays settlement.
export function coerceWingoPaytable(raw: unknown): WingoPaytable {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const field = (key: keyof WingoPaytable): number => {
    const v = Number(o[key]);
    if (!Number.isFinite(v) || v < 1) return DEFAULT_WINGO_PAYTABLE[key];
    return Math.round(Math.min(v, WINGO_PAYOUT_CEILING) * 100) / 100;
  };
  return {
    colorGreen: field('colorGreen'),
    colorRed: field('colorRed'),
    colorViolet: field('colorViolet'),
    colorHalf: field('colorHalf'),
    number: field('number'),
    big: field('big'),
    small: field('small'),
  };
}

// THE paytable. Returns the total-return multiplier for a winning bet,
// or 0 for a loss. Every multiplier is read from the supplied paytable
// so the admin editor and the per-round freeze both flow through here.
// The default argument keeps existing callers working and is the null
// fallback for pre-feature rounds (it equals the historical literals).
export function payoutMultiplier(
  betType: string,
  selection: string,
  result: number,
  paytable: WingoPaytable = DEFAULT_WINGO_PAYTABLE,
): number {
  switch (betType) {
    case 'color': {
      if (selection === 'green') {
        if (GREEN_FULL.has(result)) return paytable.colorGreen;
        if (result === 5) return paytable.colorHalf; // green + violet half
        return 0;
      }
      if (selection === 'red') {
        if (RED_FULL.has(result)) return paytable.colorRed;
        if (result === 0) return paytable.colorHalf; // red + violet half
        return 0;
      }
      if (selection === 'violet') {
        return result === 0 || result === 5 ? paytable.colorViolet : 0;
      }
      return 0;
    }
    case 'number': {
      if (!/^[0-9]$/.test(selection)) return 0;
      return Number(selection) === result ? paytable.number : 0;
    }
    case 'size': {
      if (selection === 'big') return BIG_SET.has(result) ? paytable.big : 0;
      if (selection === 'small') return SMALL_SET.has(result) ? paytable.small : 0;
      return 0;
    }
    default:
      return 0;
  }
}
