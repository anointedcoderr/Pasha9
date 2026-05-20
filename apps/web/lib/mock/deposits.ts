import type { Deposit, RequestStatus, Withdrawal } from '@/types';
import { mockUsers } from './users';

const methods = ['bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'USDT TRC20'];
const statuses: RequestStatus[] = ['pending', 'approved', 'rejected'];

export const mockDeposits: Deposit[] = Array.from({ length: 28 }).map((_, i) => {
  const user = mockUsers[i % mockUsers.length];
  const status = statuses[i % statuses.length];
  return {
    id: `d_${String(i + 1).padStart(4, '0')}`,
    userId: user.id,
    username: user.username,
    amount: 500 + ((i * 311) % 28000),
    method: methods[i % methods.length],
    transactionId: 'TRX' + (1000000 + i * 7393).toString(),
    proofUrl: i % 4 === 0 ? '/placeholders/proof.png' : undefined,
    status,
    adminNote: status === 'rejected' ? 'TX ID mismatch with sender record' : status === 'approved' ? 'Verified by admin' : undefined,
    createdAt: new Date(Date.now() - i * 86400_000 * 0.4).toISOString(),
  };
});

export const mockWithdrawals: Withdrawal[] = Array.from({ length: 22 }).map((_, i) => {
  const user = mockUsers[(i + 3) % mockUsers.length];
  const status = statuses[(i + 1) % statuses.length];
  return {
    id: `w_${String(i + 1).padStart(4, '0')}`,
    userId: user.id,
    username: user.username,
    amount: 500 + ((i * 511) % 18000),
    method: methods[(i + 1) % methods.length],
    accountNumber: '01' + (700000000 + i * 8901).toString().slice(0, 9),
    accountName: user.username.replace(/\W/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    status,
    adminNote: status === 'rejected' ? 'KYC pending' : status === 'approved' ? 'Paid out via bank channel' : undefined,
    createdAt: new Date(Date.now() - i * 86400_000 * 0.5).toISOString(),
  };
});
