import type { ActivityLog, SupportTicket } from '@/types';

export const mockActivity: ActivityLog[] = [
  { id: 'a_001', actor: 'admin.rafiq', actorRole: 'super_admin', action: 'BALANCE_ADJUST', target: 'u_0007', detail: '+ 500 BDT, reason: bonus refund', createdAt: new Date(Date.now() - 1800_000).toISOString() },
  { id: 'a_002', actor: 'admin.tanvir', actorRole: 'admin', action: 'WITHDRAWAL_APPROVE', target: 'w_0003', detail: 'Approved 8,500 BDT bKash', createdAt: new Date(Date.now() - 3600_000).toISOString() },
  { id: 'a_003', actor: 'system', actorRole: 'system', action: 'BONUS_ISSUE', target: 'u_0014', detail: 'First deposit bonus 1,250 BDT', createdAt: new Date(Date.now() - 5400_000).toISOString() },
  { id: 'a_004', actor: 'admin.rafiq', actorRole: 'super_admin', action: 'DEPOSIT_REJECT', target: 'd_0011', detail: 'TX ID mismatch', createdAt: new Date(Date.now() - 7200_000).toISOString() },
  { id: 'a_005', actor: 'admin.tanvir', actorRole: 'admin', action: 'USER_BLOCK', target: 'u_0021', detail: 'Multi account suspicion', createdAt: new Date(Date.now() - 9000_000).toISOString() },
  { id: 'a_006', actor: 'admin.rafiq', actorRole: 'super_admin', action: 'BANNER_UPDATE', target: 'b_02', detail: 'Subtitle updated', createdAt: new Date(Date.now() - 10800_000).toISOString() },
  { id: 'a_007', actor: 'admin.rafiq', actorRole: 'super_admin', action: 'BONUS_RULE_PAUSE', target: 'br_invite', detail: 'Paused invite friend bonus', createdAt: new Date(Date.now() - 12600_000).toISOString() },
  { id: 'a_008', actor: 'system', actorRole: 'system', action: 'AUTO_BACKUP', target: 'database', detail: 'Daily backup complete', createdAt: new Date(Date.now() - 14400_000).toISOString() },
];

export const mockTickets: SupportTicket[] = [
  { id: 's_01', user: 'rafiq.ahmed', subject: 'Deposit not credited', body: 'I sent 1500 via bKash but balance not updated. TX ID is TRX-3845921.', status: 'open', createdAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { id: 's_02', user: 'mahmuda.akter', subject: 'KYC document', body: 'Where should I send NID copy for KYC verification?', status: 'pending', createdAt: new Date(Date.now() - 6 * 3600_000).toISOString() },
  { id: 's_03', user: 'shanto.99', subject: 'Withdraw delay', body: 'Pending withdraw since 2 days, please check.', status: 'open', createdAt: new Date(Date.now() - 22 * 3600_000).toISOString() },
  { id: 's_04', user: 'ishrat.j', subject: 'Bonus question', body: 'How does the weekly cashback bonus get calculated?', status: 'closed', createdAt: new Date(Date.now() - 36 * 3600_000).toISOString() },
];
