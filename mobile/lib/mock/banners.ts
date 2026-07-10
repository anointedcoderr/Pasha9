// Built by Anointed Coder.
// Five hero banners for the HeroCarousel. `accent` selects the gradient
// wash drawn behind the artwork so the slider stays on-brand.

export type BannerAccent = 'gold' | 'blue' | 'hot' | 'neon' | 'royal';

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  accent: BannerAccent;
  imageUrl: string;
}

export const mockBanners: HeroBanner[] = [
  {
    id: 'bn_welcome',
    title: 'Welcome Bonus 200%',
    subtitle: 'Claim up to BDT 20,000 on your first deposit',
    ctaLabel: 'Claim now',
    accent: 'gold',
    imageUrl: 'https://picsum.photos/seed/pasha-hero1/900/500',
  },
  {
    id: 'bn_livecasino',
    title: 'Live Casino Royale',
    subtitle: 'Real dealers, real tables, 24/7 action',
    ctaLabel: 'Play live',
    accent: 'royal',
    imageUrl: 'https://picsum.photos/seed/pasha-hero2/900/500',
  },
  {
    id: 'bn_crash',
    title: 'Crash Fever',
    subtitle: 'Cash out before the rocket blows',
    ctaLabel: 'Launch',
    accent: 'hot',
    imageUrl: 'https://picsum.photos/seed/pasha-hero3/900/500',
  },
  {
    id: 'bn_lotto',
    title: 'Mega Lotto Draw',
    subtitle: 'BDT 1 crore jackpot every Friday',
    ctaLabel: 'Buy ticket',
    accent: 'neon',
    imageUrl: 'https://picsum.photos/seed/pasha-hero4/900/500',
  },
  {
    id: 'bn_referral',
    title: 'Refer and Earn',
    subtitle: 'Get BDT 500 for every active friend',
    ctaLabel: 'Invite',
    accent: 'blue',
    imageUrl: 'https://picsum.photos/seed/pasha-hero5/900/500',
  },
];
