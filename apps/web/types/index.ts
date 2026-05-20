export type UserStatus = 'active' | 'blocked' | 'pending';
export type Role = 'user' | 'admin' | 'super_admin';

export interface User {
  id: string;
  username: string;
  email?: string;
  phone: string;
  referralCode: string;
  referredBy?: string;
  role: Role;
  status: UserStatus;
  country: string;
  language: 'bn' | 'en';
  createdAt: string;
  balance: number;
  bonusBalance: number;
  lockedBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
}

export type TxType = 'deposit' | 'withdraw' | 'bonus' | 'referral' | 'bet' | 'win' | 'adjust';
export type TxStatus = 'completed' | 'pending' | 'failed';

export interface Transaction {
  id: string;
  userId: string;
  username?: string;
  type: TxType;
  amount: number;
  status: TxStatus;
  reference?: string;
  description?: string;
  createdAt: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface Deposit {
  id: string;
  userId: string;
  username: string;
  amount: number;
  method: string;
  transactionId: string;
  proofUrl?: string;
  status: RequestStatus;
  adminNote?: string;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  username: string;
  amount: number;
  method: string;
  accountNumber: string;
  accountName: string;
  status: RequestStatus;
  adminNote?: string;
  createdAt: string;
}

export interface ReferralLink {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUsername: string;
  level: 1 | 2 | 3;
  earned: number;
  status: 'active' | 'pending';
  createdAt: string;
}

export interface BonusRule {
  id: string;
  name: string;
  type: 'first_deposit' | 'daily' | 'weekly' | 'referral' | 'vip' | 'invite';
  amount: number;
  percentage: number;
  minDeposit: number;
  maxBonus: number;
  status: 'active' | 'paused';
  description?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  accent: 'gold' | 'neon' | 'mixed';
  position: number;
  status: 'active' | 'hidden';
}

export interface PopupAnnouncement {
  id: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  startAt: string;
  endAt: string;
  status: 'active' | 'hidden';
}

export interface PromoText {
  id: string;
  message: string;
  status: 'active' | 'hidden';
  position: number;
}

export interface GameCategory {
  id: string;
  slug: string;
  nameBn: string;
  nameEn: string;
  iconKey: string;
  status: 'active' | 'hidden';
}

export interface GameProvider {
  id: string;
  name: string;
  status: 'active' | 'maintenance';
}

export interface Game {
  id: string;
  name: string;
  nameBn?: string;
  categoryId: string;
  providerId: string;
  accent: 'gold' | 'neon' | 'royal' | 'red';
  iconKey: string;
  isFeatured: boolean;
  status: 'active' | 'maintenance';
  minBet: number;
  maxBet: number;
  houseEdge: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ActivityLog {
  id: string;
  actor: string;
  actorRole: 'admin' | 'super_admin' | 'system';
  action: string;
  target: string;
  detail?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  user: string;
  subject: string;
  body: string;
  status: 'open' | 'pending' | 'closed';
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalDeposits: number;
  pendingWithdrawals: number;
  totalWithdrawals: number;
  bonusIssued: number;
  referralSignups: number;
  netBalance: number;
  daily: { date: string; deposit: number; withdraw: number; net: number }[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'mobile' | 'bank' | 'crypto';
  status: 'active' | 'hidden';
  number: string;
  instruction: string;
}
