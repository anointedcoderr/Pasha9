import { Hind_Siliguri, Sora, Manrope, Cinzel } from 'next/font/google';

export const fontBn = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bn',
  display: 'swap',
});

export const fontEn = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-en',
  display: 'swap',
});

export const fontAdmin = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-admin',
  display: 'swap',
});

// Display serif reserved for the premium Spin and Lotto modules.
// SIL OFL licensed; loaded with display: swap so it never blocks
// first paint. Weight 700 + 900 only because we only use it for
// large display type (jackpot, tier crest names, win headlines).
export const fontDisplay = Cinzel({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-display',
  display: 'swap',
});
