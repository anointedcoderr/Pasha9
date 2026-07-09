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
import { DEFAULT_WINGO_PAYTABLE, type WingoPaytable } from '@/lib/wingo/paytable';

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

// Headline multiplier shown on each selection button (best-case return),
// derived from the round's frozen paytable so the displayed rate always
// matches what the round actually pays. Falls back to the code default
// (todays numbers) on first render before state loads. Keyed by the
// selection value the bet sheet uses: green / red / violet / big / small
// and the special `number` key for any 0..9 digit bet.
export function headlinesFromPaytable(pt?: WingoPaytable | null): Record<string, number> {
  const p = pt ?? DEFAULT_WINGO_PAYTABLE;
  return {
    green: p.colorGreen,
    red: p.colorRed,
    violet: p.colorViolet,
    big: p.big,
    small: p.small,
    number: p.number,
  };
}

// ---------- Premium colour + material token layer ----------
//
// One source of truth for the WinGo casino palette. Every playable colour
// (green / red / violet) is expressed as a MATERIAL, not a flat fill: a
// bright specular HIGHLIGHT stop, a saturated MID stop and a deep SHADOW
// stop, plus an ambient GLOW and a crisp RIM. Balls, buttons, chips and
// the reveal all draw from these so the whole surface reads as one glossy,
// expensive system on the dark mahogany background.

export interface WingoMaterial {
  highlight: string; // brightest catch-light stop (near white-hot colour)
  mid: string; // the true saturated colour of the object
  shadow: string; // deep terminator / base-of-sphere colour
  glow: string; // soft outer ambient glow (rgba)
  rim: string; // crisp hairline rim (rgba)
}

// Warm, saturated casino tones. Brighter than the old flat fills so they
// pop against near-black, but the deep shadow stop keeps them legible.
export const WINGO_MATERIAL: Record<WingoColorSel, WingoMaterial> = {
  green: {
    highlight: '#5cf3bf',
    mid: '#13c98d',
    shadow: '#054f34',
    glow: 'rgba(20, 201, 141, 0.55)',
    rim: 'rgba(126, 255, 210, 0.65)',
  },
  red: {
    highlight: '#ff8090',
    mid: '#ec394d',
    shadow: '#6f0c1c',
    glow: 'rgba(236, 57, 77, 0.55)',
    rim: 'rgba(255, 146, 162, 0.6)',
  },
  violet: {
    highlight: '#d29bff',
    mid: '#a855f7',
    shadow: '#4f1687',
    glow: 'rgba(168, 85, 247, 0.55)',
    rim: 'rgba(214, 168, 255, 0.65)',
  },
};

// ---------- Ball / chip visual language ----------
//
// Each entry returns the layered CSS background + rim/glow tokens for a
// true 3D glossy sphere of a given digit. Split balls (0, 5) keep their
// diagonal two-colour identity but are rendered glossy via an overlaid
// spherical vignette + specular. Values are CSS strings so the balls stay
// GPU-cheap (background + box-shadow only, animated via transform).

export interface BallSkin {
  // Full layered CSS background (specular + volume over the colour).
  background: string;
  ring: string; // legacy alias of rim, kept for callers
  rim: string; // crisp hairline rim colour
  glow: string; // ambient glow colour
  ink: string; // digit text colour
}

// A convincing sphere: a tiny white-hot specular catch-light near the
// top-left, layered over a radial volume gradient that runs highlight ->
// mid -> deep shadow so the ball has a lit crown and a dark underside.
function sphere(m: WingoMaterial): string {
  return (
    `radial-gradient(circle at 33% 26%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 6%, rgba(255,255,255,0) 22%),` +
    `radial-gradient(circle at 40% 32%, ${m.highlight} 0%, ${m.mid} 44%, ${m.shadow} 100%)`
  );
}

// A glossy split face: the specular catch-light and a spherical vignette
// (light crown, dark underside) sit ON TOP of a crisp diagonal two-tone so
// the dual identity still reads instantly but no longer looks like a flat
// disc cut in half.
function sphereSplit(left: WingoMaterial, right: WingoMaterial): string {
  return (
    `radial-gradient(circle at 33% 26%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.4) 7%, rgba(255,255,255,0) 22%),` +
    `radial-gradient(circle at 38% 30%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,0.42) 100%),` +
    `linear-gradient(135deg, ${left.highlight} 0%, ${left.mid} 30%, ${left.shadow} 49%, ${right.shadow} 51%, ${right.mid} 70%, ${right.highlight} 100%)`
  );
}

export function ballSkin(n: number): BallSkin {
  const id = colorOf(n);
  const g = WINGO_MATERIAL.green;
  const r = WINGO_MATERIAL.red;
  const v = WINGO_MATERIAL.violet;
  switch (id) {
    case 'red':
      return { background: sphere(r), ring: r.rim, rim: r.rim, glow: r.glow, ink: '#fff' };
    case 'green':
      return { background: sphere(g), ring: g.rim, rim: g.rim, glow: g.glow, ink: '#fff' };
    case 'red_violet':
      return { background: sphereSplit(r, v), ring: 'rgba(214,168,255,0.62)', rim: 'rgba(214,168,255,0.62)', glow: 'rgba(180,90,220,0.55)', ink: '#fff' };
    case 'green_violet':
      return { background: sphereSplit(g, v), ring: 'rgba(190,220,255,0.6)', rim: 'rgba(190,220,255,0.6)', glow: 'rgba(130,150,255,0.5)', ink: '#fff' };
  }
}

// The glossy box-shadow stack for a ball, scaled to its diameter so a 26px
// history badge and a 112px reveal ball carry the same material language:
//   drop shadow (lift) + top inner catch-light + base inner shadow + rim.
// When selected it adds a gold focus ring and a wider ambient glow.
export function ballShadow(skin: BallSkin, size: number, selected: boolean): string {
  const s = size / 56; // reference diameter
  const lift = `0 ${(6 * s).toFixed(1)}px ${(14 * s).toFixed(1)}px -${(5 * s).toFixed(1)}px rgba(0,0,0,0.7), 0 ${(2 * s).toFixed(1)}px ${(5 * s).toFixed(1)}px -${(2 * s).toFixed(1)}px rgba(0,0,0,0.5)`;
  const topLight = `inset 0 ${(3 * s).toFixed(1)}px ${(6 * s).toFixed(1)}px -${(2 * s).toFixed(1)}px rgba(255,255,255,0.55)`;
  const baseShade = `inset 0 -${(7 * s).toFixed(1)}px ${(12 * s).toFixed(1)}px -${(4 * s).toFixed(1)}px rgba(0,0,0,0.55)`;
  const rim = `inset 0 0 0 1px ${skin.rim}`;
  if (selected) {
    return `0 0 0 2px rgba(255,213,84,0.95), 0 0 22px 3px ${skin.glow}, ${lift}, ${topLight}, ${baseShade}, ${rim}`;
  }
  return `${lift}, ${topLight}, ${baseShade}, ${rim}`;
}

// ---------- Colour action buttons ----------
//
// Glossy pill buttons for Green / Violet / Red. A vertical highlight ->
// mid -> shadow gradient reads as a lit lozenge; the component adds a top
// inner catch-light, a depth drop-shadow and a pressed state on top.
function pill(m: WingoMaterial): string {
  return `linear-gradient(180deg, ${m.highlight} 0%, ${m.mid} 46%, ${m.shadow} 100%)`;
}

export const COLOR_BUTTON: Record<WingoColorSel, { grad: string; ring: string; glow: string; rim: string; label: { en: string; bn: string } }> = {
  green: { grad: pill(WINGO_MATERIAL.green), ring: 'rgba(18,185,129,0.6)', glow: WINGO_MATERIAL.green.glow, rim: WINGO_MATERIAL.green.rim, label: { en: 'Green', bn: 'সবুজ' } },
  violet: { grad: pill(WINGO_MATERIAL.violet), ring: 'rgba(168,85,247,0.6)', glow: WINGO_MATERIAL.violet.glow, rim: WINGO_MATERIAL.violet.rim, label: { en: 'Violet', bn: 'বেগুনি' } },
  red: { grad: pill(WINGO_MATERIAL.red), ring: 'rgba(224,54,74,0.6)', glow: WINGO_MATERIAL.red.glow, rim: WINGO_MATERIAL.red.rim, label: { en: 'Red', bn: 'লাল' } },
};

// The glossy box-shadow stack shared by the colour pills and the
// Big / Small bar: a top inner catch-light, a soft depth shadow and a
// coloured ambient glow so the buttons sit proud of the dark board.
export function pillShadow(glow: string): string {
  return `inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -3px 8px -2px rgba(0,0,0,0.45), 0 10px 22px -12px rgba(0,0,0,0.7), 0 4px 16px -8px ${glow}`;
}

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

// ---------- Glossy identity chips (size + colour) ----------
//
// Small lit lozenges that state the winning size and colour identity. They
// share one token shape so the trend ladder and the result reveal render
// the same premium material everywhere. Presentation only (CSS strings, so
// callers stay GPU-cheap: background + box-shadow, no filters).

export interface WingoChipSkin {
  grad: string; // glossy highlight -> mid -> shadow lozenge
  rim: string; // crisp hairline rim colour
  ink: string; // label ink colour
}

// Big wears the house gold, Small a cool sky tone. Matches the trend
// ladder's Big / Small pill exactly so the reveal never drifts from it.
export function sizePillSkin(id: WingoSizeId): WingoChipSkin {
  if (id === 'big') {
    return {
      grad: 'linear-gradient(180deg, #ffe9ad 0%, #f5b400 52%, #8a5e00 100%)',
      rim: 'rgba(255,224,138,0.7)',
      ink: '#3a2800',
    };
  }
  return {
    grad: 'linear-gradient(180deg, #cdebff 0%, #38a8e0 52%, #0d4a6b 100%)',
    rim: 'rgba(150,214,255,0.7)',
    ink: '#052436',
  };
}

// A colour-identity chip tinted straight from WINGO_MATERIAL so it reads as
// the same green / red / violet as the balls and colour buttons. Split
// identities (0, 5) carry a two-tone diagonal so the violet still shows.
export function colorChipSkin(id: WingoColorId): WingoChipSkin {
  const g = WINGO_MATERIAL.green;
  const r = WINGO_MATERIAL.red;
  const v = WINGO_MATERIAL.violet;
  switch (id) {
    case 'red':
      return { grad: `linear-gradient(180deg, ${r.highlight} 0%, ${r.mid} 50%, ${r.shadow} 100%)`, rim: r.rim, ink: '#fff' };
    case 'green':
      return { grad: `linear-gradient(180deg, ${g.highlight} 0%, ${g.mid} 50%, ${g.shadow} 100%)`, rim: g.rim, ink: '#fff' };
    case 'red_violet':
      return { grad: `linear-gradient(135deg, ${r.mid} 0%, ${r.shadow} 46%, ${v.shadow} 54%, ${v.mid} 100%)`, rim: v.rim, ink: '#fff' };
    case 'green_violet':
      return { grad: `linear-gradient(135deg, ${g.mid} 0%, ${g.shadow} 46%, ${v.shadow} 54%, ${v.mid} 100%)`, rim: v.rim, ink: '#fff' };
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
