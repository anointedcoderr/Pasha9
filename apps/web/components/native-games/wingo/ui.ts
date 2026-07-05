// Built by Anointed Coder.
//
// Client-safe presentation helpers for the Pasha WinGo play surface.
// Pure functions and constants only (no database, no server imports) so
// every WinGo component can share one source of truth for the colour
// identity, ball styling, bilingual labels and the paytable multipliers.
//
// The number-to-colour identity mirrors lib/wingo/paytable.ts exactly:
//   0 = red + violet   5 = green + violet
//   1,3,7,9 = green     2,4,6,8 = red

import type { Lang } from '@/lib/i18n/context';

export type WingoColorId = 'red' | 'green' | 'red_violet' | 'green_violet';
export type WingoSizeId = 'big' | 'small';
export type WingoBetType = 'color' | 'number' | 'size';
export type WingoColorSel = 'green' | 'red' | 'violet';

// Colour identity of a drawn digit. Kept in lockstep with the server
// paytable so the reveal never disagrees with settlement.
export function colorOf(n: number): WingoColorId {
  if (n === 0) return 'red_violet';
  if (n === 5) return 'green_violet';
  return n % 2 === 0 ? 'red' : 'green';
}

export function sizeOf(n: number): WingoSizeId {
  return n >= 5 ? 'big' : 'small';
}

// Whether a drawn digit carries the violet identity (0 or 5). Used to
// light the violet chip and the ball's inner spark.
export function hasViolet(n: number): boolean {
  return n === 0 || n === 5;
}

// Headline multiplier shown on each selection button (best-case return).
export const SELECTION_HEADLINE: Record<string, number> = {
  green: 2,
  red: 2,
  violet: 4.5,
  big: 2,
  small: 2,
  number: 9,
};

// ---------- Ball / chip visual language ----------
//
// Each entry returns the inline gradient + ring colours for a glossy 3D
// ball of a given digit. Split balls (0, 5) use a two-stop diagonal so
// the dual identity reads instantly. Values are CSS strings so the balls
// stay GPU-cheap (background + box-shadow only, animated via transform).

export interface BallSkin {
  // Full CSS background (radial gloss over the base colour).
  background: string;
  ring: string; // box-shadow ring colour
  glow: string; // ambient glow colour
  ink: string; // digit text colour
}

const RED_BASE = '#e0364a';
const RED_DEEP = '#8f0f22';
const GREEN_BASE = '#12b981';
const GREEN_DEEP = '#0a6b4a';
const VIOLET_BASE = '#a855f7';
const VIOLET_DEEP = '#6b21a8';

function gloss(base: string, deep: string): string {
  return `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.35) 12%, ${base} 42%, ${deep} 100%)`;
}

function split(leftBase: string, leftDeep: string, rightBase: string, rightDeep: string): string {
  return (
    `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.18) 14%, rgba(255,255,255,0) 22%),` +
    `linear-gradient(135deg, ${leftBase} 0%, ${leftDeep} 48%, ${rightBase} 52%, ${rightDeep} 100%)`
  );
}

export function ballSkin(n: number): BallSkin {
  const id = colorOf(n);
  switch (id) {
    case 'red':
      return { background: gloss(RED_BASE, RED_DEEP), ring: 'rgba(255,120,140,0.55)', glow: 'rgba(224,54,74,0.55)', ink: '#fff' };
    case 'green':
      return { background: gloss(GREEN_BASE, GREEN_DEEP), ring: 'rgba(90,240,190,0.55)', glow: 'rgba(18,185,129,0.55)', ink: '#fff' };
    case 'red_violet':
      return { background: split(RED_BASE, RED_DEEP, VIOLET_BASE, VIOLET_DEEP), ring: 'rgba(200,120,220,0.6)', glow: 'rgba(168,85,247,0.5)', ink: '#fff' };
    case 'green_violet':
      return { background: split(GREEN_BASE, GREEN_DEEP, VIOLET_BASE, VIOLET_DEEP), ring: 'rgba(160,220,200,0.6)', glow: 'rgba(168,85,247,0.5)', ink: '#fff' };
  }
}

// Solid brand colours for the Green / Violet / Red action buttons and
// the colour chips in the history strip.
export const COLOR_BUTTON: Record<WingoColorSel, { grad: string; ring: string; label: { en: string; bn: string } }> = {
  green: { grad: 'linear-gradient(180deg,#16c98d 0%,#0a6b4a 100%)', ring: 'rgba(18,185,129,0.6)', label: { en: 'Green', bn: 'সবুজ' } },
  violet: { grad: 'linear-gradient(180deg,#b06bff 0%,#6b21a8 100%)', ring: 'rgba(168,85,247,0.6)', label: { en: 'Violet', bn: 'বেগুনি' } },
  red: { grad: 'linear-gradient(180deg,#ef4459 0%,#8f0f22 100%)', ring: 'rgba(224,54,74,0.6)', label: { en: 'Red', bn: 'লাল' } },
};

export function colorDotClass(id: WingoColorId): string {
  switch (id) {
    case 'red':
      return 'bg-rose-500';
    case 'green':
      return 'bg-emerald-500';
    case 'red_violet':
      return 'bg-gradient-to-br from-rose-500 to-violet-500';
    case 'green_violet':
      return 'bg-gradient-to-br from-emerald-500 to-violet-500';
  }
}

// ---------- Bilingual labels ----------

export function sizeLabel(id: WingoSizeId, lang: Lang): string {
  if (id === 'big') return lang === 'bn' ? 'বড়' : 'Big';
  return lang === 'bn' ? 'ছোট' : 'Small';
}

export function colorLabel(id: WingoColorId, lang: Lang): string {
  const bn = lang === 'bn';
  switch (id) {
    case 'red':
      return bn ? 'লাল' : 'Red';
    case 'green':
      return bn ? 'সবুজ' : 'Green';
    case 'red_violet':
      return bn ? 'লাল বেগুনি' : 'Red Violet';
    case 'green_violet':
      return bn ? 'সবুজ বেগুনি' : 'Green Violet';
  }
}

// A short human label for any (betType, selection) pair, for the bet
// sheet header and My history rows.
export function selectionLabel(betType: string, selection: string, lang: Lang): string {
  const bn = lang === 'bn';
  if (betType === 'color') {
    if (selection === 'green') return bn ? 'সবুজ' : 'Green';
    if (selection === 'red') return bn ? 'লাল' : 'Red';
    if (selection === 'violet') return bn ? 'বেগুনি' : 'Violet';
  }
  if (betType === 'size') return sizeLabel(selection as WingoSizeId, lang);
  if (betType === 'number') return (bn ? 'নম্বর ' : 'Number ') + selection;
  return selection;
}

// Quick-amount presets for the bet sheet (unit stake before the X chip).
export const QUICK_AMOUNTS = [1, 10, 100, 1000] as const;

// Quantity / multiplier chips (X1..X100).
export const QUANTITY_CHIPS = [1, 5, 10, 20, 50, 100] as const;
