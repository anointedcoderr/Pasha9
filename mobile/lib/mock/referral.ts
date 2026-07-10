// Built by Anointed Coder.
// Referral stats for the (later) Referral / Affiliate screens.

export interface ReferralTier {
  label: string;
  reward: string;
}

export interface ReferralStats {
  code: string;
  link: string;
  referred: number;
  active: number;
  totalEarned: number;
  pending: number;
  tiers: ReferralTier[];
}

export const mockReferralStats: ReferralStats = {
  code: 'SANJID500',
  link: 'https://pasha9.com/r/SANJID500',
  referred: 24,
  active: 11,
  totalEarned: 8600,
  pending: 1500,
  tiers: [
    { label: '1 - 5 friends', reward: 'BDT 300 each' },
    { label: '6 - 20 friends', reward: 'BDT 500 each' },
    { label: '21+ friends', reward: 'BDT 750 each' },
  ],
};
