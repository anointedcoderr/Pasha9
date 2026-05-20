import type { AdminStats } from '@/types';

function dailySeries() {
  const out: AdminStats['daily'] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dep = 18000 + Math.round(Math.sin(i / 3) * 4000) + (i % 5) * 1200;
    const wd = 12000 + Math.round(Math.cos(i / 4) * 3000) + (i % 4) * 800;
    out.push({
      date: d.toISOString().slice(0, 10),
      deposit: dep,
      withdraw: wd,
      net: dep - wd,
    });
  }
  return out;
}

export const mockAdminStats: AdminStats = {
  totalUsers: 4_287,
  activeUsers: 1_362,
  totalDeposits: 4_215_000,
  pendingWithdrawals: 78_500,
  totalWithdrawals: 2_815_000,
  bonusIssued: 412_000,
  referralSignups: 612,
  netBalance: 1_587_500,
  daily: dailySeries(),
};
