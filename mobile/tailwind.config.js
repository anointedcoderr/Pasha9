// Built by Anointed Coder.
// Pasha9 player-app design tokens. Mirrors the light web theme (paper +
// surface + gold accents) and adds a dark premium palette for the hero /
// balance / dark islands. Consumed by NativeWind v4 so classes like
// bg-paper, text-gold-600, bg-darkbg resolve on React Native elements.

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

        // Ink (text) scale. DEFAULT enables `text-ink`; soft/mute enable
        // `text-ink-soft` and `text-ink-mute`.
        ink: {
          DEFAULT: '#0F1115',
          soft: '#3B4252',
          mute: '#6B7280',
        },

        // Gold accent ramp
        gold: {
          300: '#FFE066',
          400: '#FFD633',
          500: '#FFCC00',
          600: '#F5B400',
          700: '#D89E00',
        },

        // Brand blue
        blue: {
          500: '#1E73E8',
          600: '#1659C2',
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
        // System stack: no custom font files needed this phase.
        sans: ['System', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
