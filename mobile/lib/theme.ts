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
