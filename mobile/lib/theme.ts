// Built by Anointed Coder.
// JS-accessible mirror of the Tailwind color tokens in tailwind.config.js.
// Use these when a value cannot be expressed as a className: gradient stop
// colors, icon `color` props on @expo/vector-icons, StatusBar tint, etc.
// Keep this in sync with tailwind.config.js theme.extend.colors.

export const colors = {
  // Light surfaces
  paper: '#FFFFFF',
  surface: '#F6F7F9',
  surfaceAlt: '#EDEFF3',
  divider: '#E7EAEE',

  // Ink (text)
  ink: '#0F1115',
  inkSoft: '#3B4252',
  inkMute: '#6B7280',

  // Gold ramp
  gold300: '#FFE066',
  gold400: '#FFD633',
  gold500: '#FFCC00',
  gold600: '#F5B400',
  gold700: '#D89E00',

  // Brand blue
  blue500: '#1E73E8',
  blue600: '#1659C2',
  blue700: '#10449A',

  // Dark nav strip (web brand.navInk / navInkSoft)
  navInk: '#15171C',
  navInkSoft: '#2A2D34',

  // Deep antique-gold ramp (separate from the bright gold ramp above)
  deepGold50: '#fff6dc',
  deepGold100: '#f8e6a8',
  deepGold300: '#f5d061',
  deepGold500: '#e2b13a',
  deepGold700: '#c9952b',
  deepGold900: '#7a5810',

  // Status
  hot: '#FF4E3A',
  newg: '#23C26B',

  // Dark premium palette
  darkbg: '#0b0e14',
  panel: '#0c1f15',
  elev: '#133024',
  goldlite: '#f5d061',
  gold2: '#e2b13a',
  neon: '#36ff9a',
  dinkHi: '#f4fff7',
  dinkMid: '#bcd9c6',
  dinkLo: '#6e8a7a',
} as const;

// brand.* mirror of the web preset, nested to match the Tailwind token
// shape (colors.brand.yellow[500] === class bg-brand-yellow-500). Use when a
// value must be passed to a JS API (lucide `color` prop, gradient stops,
// StatusBar tint) instead of a className.
export const brand = {
  ink: '#0F1115',
  inkSoft: '#3B4252',
  inkMute: '#6B7280',
  paper: '#FFFFFF',
  surface: '#F6F7F9',
  surfaceAlt: '#EDEFF3',
  divider: '#E7EAEE',
  navInk: '#15171C',
  navInkSoft: '#2A2D34',
  yellow: {
    50: '#FFF9E0',
    200: '#FFEB99',
    300: '#FFE066',
    400: '#FFD633',
    500: '#FFCC00',
    600: '#F5B400',
    700: '#D89E00',
    800: '#B37F00',
  },
  blue: {
    500: '#1E73E8',
    600: '#1659C2',
    700: '#10449A',
  },
  hot: '#FF4E3A',
  new: '#23C26B',
} as const;

// Deep antique-gold ramp as a nested object (colors.deepGold[500] mirrors the
// tailwind deepGold token / class text-deepGold-500). Distinct from the bright
// brand yellow ramp.
export const deepGold = {
  50: '#fff6dc',
  100: '#f8e6a8',
  300: '#f5d061',
  500: '#e2b13a',
  700: '#c9952b',
  900: '#7a5810',
} as const;

// Common gradient presets (arrays of stop colors, left -> right / top ->
// bottom) consumed by the <Gradient> helper and the premium cards.
export const gradients = {
  gold: ['#FFE066', '#FFCC00', '#F5B400'],
  goldDeep: ['#f5d061', '#e2b13a', '#c9952b'],
  hot: ['#FFCC00', '#FF7A1A', '#FF4E3A'],
  blue: ['#1E73E8', '#1659C2'],
  darkCard: ['#0F1115', '#1A1D24', '#0F1115'],
  darkPanel: ['#133024', '#0c1f15', '#06120c'],
} as const;

export type ColorToken = keyof typeof colors;
