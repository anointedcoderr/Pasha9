// Built by Anointed Coder.
// VIP tiers for the (later) VIP screen.

export interface VipTier {
  key: string;
  name: string;
  minPoints: number;
  cashback: string;
  perks: string[];
  /** Accent hex for the tier badge. */
  color: string;
}

export const mockVipTiers: VipTier[] = [
  { key: 'bronze', name: 'Bronze', minPoints: 0, cashback: '3%', perks: ['Weekly cashback', 'Standard support'], color: '#CD7F32' },
  { key: 'silver', name: 'Silver', minPoints: 5000, cashback: '5%', perks: ['Faster withdrawals', 'Birthday bonus'], color: '#B8C0CC' },
  { key: 'gold', name: 'Gold', minPoints: 25000, cashback: '8%', perks: ['Dedicated host', 'Reload boosts'], color: '#F5B400' },
  { key: 'platinum', name: 'Platinum', minPoints: 100000, cashback: '12%', perks: ['VIP events', 'Custom limits'], color: '#8E9BB3' },
  { key: 'diamond', name: 'Diamond', minPoints: 500000, cashback: '18%', perks: ['Private cashback', 'Luxury gifts'], color: '#36ff9a' },
];
