import { Hind_Siliguri, Sora, Manrope } from 'next/font/google';

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
