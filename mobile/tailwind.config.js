// Built by Anointed Coder.
// Pasha9 player-app design tokens. Mirrors the light web theme (paper +
// surface + gold accents) and adds a dark premium palette for the hero /
// balance / dark islands. Consumed by NativeWind v4 so classes like
// bg-paper, text-gold-600, bg-darkbg resolve on React Native elements.
//
// This file also ports the web brand-* token family from
// packages/config/tailwind-preset.js 1:1, so web class names like
// bg-brand-yellow-500, text-brand-ink, border-brand-divider and
// text-brand-yellow-700 resolve unchanged on mobile. The legacy flat
// tokens (gold, blue, ink, ...) are kept intact so existing screens keep
// working; the new brand.* group and the deep gold ramp are added alongside.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Light surfaces
        paper: '#FFFFFF',
        surface: '#F6F7F9',
        surfaceAlt: '#EDEFF3',
        divider: '#E7EAEE',

        // brand.* : mirrors the web preset 1:1. Public web components use
        // these directly (bg-brand-paper, text-brand-ink, border-brand-divider,
        // bg-brand-yellow-500, text-brand-yellow-700, ...). The yellow ramp is
        // the BRIGHT brand yellow; keys stay camelCase so classes match web.
        brand: {
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
        },

        // Ink (text) scale. DEFAULT enables `text-ink`; soft/mute enable
        // `text-ink-soft` and `text-ink-mute`.
        ink: {
          DEFAULT: '#0F1115',
          soft: '#3B4252',
          mute: '#6B7280',
        },

        // Gold accent ramp (BRIGHT brand yellow). Numerically equal to
        // brand.yellow.300-700; kept under `gold` because 46 existing screens
        // reference gold-300..gold-700 as bright yellow.
        gold: {
          300: '#FFE066',
          400: '#FFD633',
          500: '#FFCC00',
          600: '#F5B400',
          700: '#D89E00',
        },

        // Deep antique-gold ramp (separate, flat). Distinct from the bright
        // `gold` ramp above; used for dark-island trims and premium gold text.
        deepGold: {
          50: '#fff6dc',
          100: '#f8e6a8',
          300: '#f5d061',
          500: '#e2b13a',
          700: '#c9952b',
          900: '#7a5810',
        },

        // Brand blue
        blue: {
          500: '#1E73E8',
          600: '#1659C2',
          700: '#10449A',
        },

        // Status
        hot: '#FF4E3A',
        newg: '#23C26B',

        // Dark premium palette (hero / balance / dark islands)
        darkbg: '#0b0e14',
        panel: '#0c1f15',
        elev: '#133024',
        goldlite: '#f5d061',
        gold2: '#e2b13a',
        neon: '#36ff9a',
        dink: {
          hi: '#f4fff7',
          mid: '#bcd9c6',
          lo: '#6e8a7a',
        },
      },
      fontFamily: {
        // Web body font resolves to Hind Siliguri (bn) with Sora (en) fallback,
        // so the default sans stack prefers the loaded Bangla face then Latin.
        sans: ['HindSiliguri_400Regular', 'Sora_400Regular', 'System', 'sans-serif'],
        // en -> Sora (Latin / numerals). font-en resolves to the regular
        // weight on native; use the weight-specific families for headings.
        en: [
          'Sora_400Regular',
          'Sora_500Medium',
          'Sora_600SemiBold',
          'Sora_700Bold',
          'Sora_800ExtraBold',
        ],
        // bn -> Hind Siliguri (Bengali).
        bn: [
          'HindSiliguri_400Regular',
          'HindSiliguri_500Medium',
          'HindSiliguri_600SemiBold',
          'HindSiliguri_700Bold',
        ],
        // display -> Sora, bold-forward for hero / section headings.
        display: ['Sora_700Bold', 'Sora_800ExtraBold'],
      },
      borderRadius: {
        card: '18px',
        pill: '9999px',
        chip: '10px',
      },
    },
  },
  plugins: [],
};
