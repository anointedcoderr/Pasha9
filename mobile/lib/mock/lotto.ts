// Built by Anointed Coder.
// Lotto draws for the (later) Lotto screen.

export type LottoStatus = 'open' | 'closing' | 'drawn';

export interface LottoDraw {
  id: string;
  name: string;
  /** ISO draw time. */
  drawTime: string;
  jackpot: number;
  ticketPrice: number;
  status: LottoStatus;
}

export const mockLottoDraws: LottoDraw[] = [
  { id: 'lt_mega', name: 'Mega Friday', drawTime: '2026-07-11T15:00:00Z', jackpot: 10_000_000, ticketPrice: 50, status: 'open' },
  { id: 'lt_daily', name: 'Daily Dhamaka', drawTime: '2026-07-10T18:00:00Z', jackpot: 500_000, ticketPrice: 20, status: 'closing' },
  { id: 'lt_super', name: 'Super Six', drawTime: '2026-07-12T14:00:00Z', jackpot: 2_500_000, ticketPrice: 30, status: 'open' },
  { id: 'lt_flash', name: 'Flash Hourly', drawTime: '2026-07-10T13:00:00Z', jackpot: 75_000, ticketPrice: 10, status: 'drawn' },
];
