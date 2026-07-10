// Built by Anointed Coder.
// Recent wallet transactions for the Home/History surfaces.

export type TxnType = 'deposit' | 'withdraw' | 'bonus' | 'bet' | 'win';
export type TxnStatus = 'completed' | 'pending' | 'failed';

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  status: TxnStatus;
  method: string;
  /** ISO timestamp. */
  at: string;
}

export const mockTransactions: Transaction[] = [
  { id: 'tx_1', type: 'deposit', amount: 2000, status: 'completed', method: 'bKash', at: '2026-07-10T08:12:00Z' },
  { id: 'tx_2', type: 'win', amount: 3400, status: 'completed', method: 'Aviator', at: '2026-07-10T07:41:00Z' },
  { id: 'tx_3', type: 'withdraw', amount: 1500, status: 'pending', method: 'Nagad', at: '2026-07-09T20:05:00Z' },
  { id: 'tx_4', type: 'bonus', amount: 250, status: 'completed', method: 'Welcome bonus', at: '2026-07-09T18:30:00Z' },
  { id: 'tx_5', type: 'bet', amount: 500, status: 'completed', method: 'Crazy Time', at: '2026-07-09T17:58:00Z' },
  { id: 'tx_6', type: 'deposit', amount: 1000, status: 'failed', method: 'Rocket', at: '2026-07-08T11:22:00Z' },
];
