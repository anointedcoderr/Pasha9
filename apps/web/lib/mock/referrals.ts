import type { ReferralLink } from '@/types';
import { mockUsers, currentUser } from './users';

const downline = mockUsers.slice(4, 13);

export const mockReferralChain: ReferralLink[] = downline.map((user, i) => ({
  id: `r_${i + 1}`,
  referrerId: currentUser.id,
  referredUserId: user.id,
  referredUsername: user.username,
  level: ((i % 3) + 1) as 1 | 2 | 3,
  earned: 250 + ((i * 173) % 1500),
  status: i % 5 === 0 ? 'pending' : 'active',
  createdAt: new Date(Date.now() - i * 86400_000 * 3).toISOString(),
}));

export const referralStats = {
  totalInvited: mockReferralChain.length,
  totalEarned: mockReferralChain.reduce((sum, r) => sum + r.earned, 0),
  pending: mockReferralChain.filter((r) => r.status === 'pending').reduce((sum, r) => sum + r.earned, 0),
  claimed: mockReferralChain.filter((r) => r.status === 'active').reduce((sum, r) => sum + r.earned, 0),
};

export const referralCode = currentUser.referralCode;
export const referralLink = `https://sanjid14.com/r/${referralCode}`;
