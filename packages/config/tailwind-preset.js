/**
 * Royal Bangla Casino Glow design tokens.
 * Shared Tailwind preset used by every app in the workspace.
 * Built by Anointed Coder.
 */

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#06120c',
          deep: '#040b07',
          panel: '#0c1f15',
          elev: '#133024',
          line: '#1c3a2b',
        },
        gold: {
          50: '#fff6dc',
          100: '#f8e6a8',
          300: '#f5d061',
          500: '#e2b13a',
          700: '#c9952b',
          900: '#7a5810',
        },
        neon: {
          DEFAULT: '#36ff9a',
          soft: 'rgba(54,255,154,0.20)',
          dim: '#1bbf6f',
        },
        ink: {
          hi: '#f4fff7',
          mid: '#bcd9c6',
          lo: '#6e8a7a',
          mute: '#3a5246',
        },
        signal: {
          danger: '#ff6b6b',
          warn: '#ffc857',
          info: '#4cc3ff',
          ok: '#36ff9a',
        },
        // Brand light palette (Phase 1 redesign). Lives alongside the legacy
        // dark tokens above so admin pages can migrate page by page.
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
            300: '#FFE066',
            400: '#FFD633',
            500: '#FFCC00',
            600: '#F5B400',
            700: '#D89E00',
          },
          blue: {
            500: '#1E73E8',
            600: '#1659C2',
            700: '#10449A',
          },
          hot: '#FF4E3A',
          new: '#23C26B',
        },
      },
      fontFamily: {
        bn: ['var(--font-bn)', 'Hind Siliguri', 'system-ui', 'sans-serif'],
        en: ['var(--font-en)', 'Sora', 'system-ui', 'sans-serif'],
        admin: ['var(--font-admin)', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['var(--font-en)', 'Sora', 'serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.4rem, 5vw, 3.6rem)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-2': ['clamp(1.8rem, 3.5vw, 2.6rem)', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '700' }],
      },
      borderRadius: {
        card: '18px',
        pill: '999px',
        chip: '10px',
      },
      boxShadow: {
        glow: '0 0 28px rgba(54,255,154,0.18), 0 0 80px rgba(201,149,43,0.10)',
        'glow-gold': '0 0 30px rgba(245,208,97,0.28), 0 0 70px rgba(201,149,43,0.20)',
        'glow-neon': '0 0 22px rgba(54,255,154,0.45)',
        elev: '0 12px 32px -16px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset',
        ring: '0 0 0 1px rgba(245,208,97,0.35)',
      },
      backgroundImage: {
        'grad-gold': 'linear-gradient(135deg, #f5d061 0%, #c9952b 60%, #7a5810 100%)',
        'grad-panel': 'linear-gradient(180deg, rgba(19,48,36,0.95) 0%, rgba(6,18,12,0.95) 100%)',
        'grad-radial-glow': 'radial-gradient(circle at 50% 0%, rgba(54,255,154,0.18), transparent 60%)',
        'grad-card': 'linear-gradient(160deg, rgba(245,208,97,0.10) 0%, rgba(54,255,154,0.04) 60%, transparent 100%)',
        // Brand light gradients
        'grad-yellow': 'linear-gradient(135deg, #FFE066 0%, #FFCC00 55%, #F5B400 100%)',
        'grad-hot': 'linear-gradient(135deg, #FFCC00 0%, #FF7A1A 60%, #FF4E3A 100%)',
        'grad-brand-blue': 'linear-gradient(135deg, #1E73E8 0%, #1659C2 100%)',
      },
      keyframes: {
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(54,255,154,0.30)' },
          '50%': { boxShadow: '0 0 24px rgba(54,255,154,0.55)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        sheen: 'sheen 2.6s ease-in-out infinite',
        floaty: 'floaty 3.4s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
        marquee: 'marquee 28s linear infinite',
        shimmer: 'shimmer 2.2s linear infinite',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        sidebar: '256px',
        rail: '72px',
      },
      maxWidth: {
        page: '1400px',
        narrow: '880px',
      },
    },
  },
  plugins: [],
};

module.exports = preset;
