// Built by Anointed Coder.
// Mock wallet. Balances are in BDT. formatBDT (lib/format.ts) renders them.

export interface MockWallet {
  currency: 'BDT';
  balance: number;
  bonusBalance: number;
  lockedBonus: number;
  jackpotPool: number;
}

export const mockWallet: MockWallet = {
  currency: 'BDT',
  balance: 5900,
  bonusBalance: 250,
  lockedBonus: 0,
  jackpotPool: 12_854_320,
};
