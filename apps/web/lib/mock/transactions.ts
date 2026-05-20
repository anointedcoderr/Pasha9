import type { Transaction, TxStatus, TxType } from '@/types';
import { mockUsers } from './users';

const types: TxType[] = ['deposit', 'withdraw', 'bonus', 'referral', 'bet', 'win', 'adjust'];
const statuses: TxStatus[] = ['completed', 'pending', 'failed'];

export const mockTransactions: Transaction[] = Array.from({ length: 120 }).map((_, i) => {
  const user = mockUsers[i % mockUsers.length];
  const type = types[i % types.length];
  const baseAmount = ((i + 1) * 137) % 12500 + 100;
  const sign = type === 'withdraw' || type === 'bet' ? -1 : 1;
  const status = statuses[(i + (type === 'deposit' ? 0 : 1)) % statuses.length];
  return {
    id: `t_${String(i + 1).padStart(5, '0')}`,
    userId: user.id,
    username: user.username,
    type,
    amount: baseAmount * sign,
    status,
    reference: `REF${(100000 + i * 73).toString(16).toUpperCase()}`,
    description: descriptionFor(type),
    createdAt: new Date(Date.now() - i * 3600_000 * (1 + (i % 7))).toISOString(),
  };
});

function descriptionFor(type: TxType) {
  switch (type) {
    case 'deposit':
      return 'Wallet top up';
    case 'withdraw':
      return 'Withdrawal request';
    case 'bonus':
      return 'Bonus credited';
    case 'referral':
      return 'Referral commission';
    case 'bet':
      return 'Game bet';
    case 'win':
      return 'Game win';
    case 'adjust':
      return 'Admin balance adjustment';
  }
}

export function userTransactions(userId: string) {
  return mockTransactions.filter((t) => t.userId === userId);
}
