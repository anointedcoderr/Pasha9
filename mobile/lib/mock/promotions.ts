// Built by Anointed Coder.
// Promotions used by the Home teaser and (later) the Promotions screen.

export type PromoTag = 'HOT' | 'NEW' | 'VIP';

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  tag: PromoTag;
  imageUrl: string;
}

export const mockPromotions: Promotion[] = [
  {
    id: 'promo_first',
    title: 'First Deposit 200%',
    subtitle: 'Double your first deposit up to BDT 20,000',
    tag: 'HOT',
    imageUrl: 'https://picsum.photos/seed/pasha-promo1/600/360',
  },
  {
    id: 'promo_cashback',
    title: 'Weekly Cashback 15%',
    subtitle: 'Get a slice back every Monday, win or lose',
    tag: 'VIP',
    imageUrl: 'https://picsum.photos/seed/pasha-promo2/600/360',
  },
  {
    id: 'promo_reload',
    title: 'Daily Reload Bonus',
    subtitle: 'Top up any day and grab an extra 20%',
    tag: 'NEW',
    imageUrl: 'https://picsum.photos/seed/pasha-promo3/600/360',
  },
  {
    id: 'promo_referral',
    title: 'Refer and Earn BDT 500',
    subtitle: 'Paid out for every friend who plays',
    tag: 'NEW',
    imageUrl: 'https://picsum.photos/seed/pasha-promo4/600/360',
  },
];
