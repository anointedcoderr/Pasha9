// Built by Anointed Coder.
// Recent winners for the LiveWinnersTicker marquee. Handles are pre-masked.

export interface Winner {
  id: string;
  handle: string;
  game: string;
  amount: number;
  timeAgo: string;
}

export const mockWinners: Winner[] = [
  { id: 'w_1', handle: 'raf***21', game: 'Aviator', amount: 48200, timeAgo: '2m' },
  { id: 'w_2', handle: 'sha***09', game: 'Crazy Time', amount: 91500, timeAgo: '4m' },
  { id: 'w_3', handle: 'nas***77', game: 'Gates of Olympus', amount: 12750, timeAgo: '6m' },
  { id: 'w_4', handle: 'tan***13', game: 'WinGo 1m', amount: 8600, timeAgo: '7m' },
  { id: 'w_5', handle: 'mim***45', game: 'Sweet Bonanza', amount: 33400, timeAgo: '9m' },
  { id: 'w_6', handle: 'jub***82', game: 'Fortune Tiger', amount: 156000, timeAgo: '11m' },
  { id: 'w_7', handle: 'kar***38', game: 'Mines', amount: 5400, timeAgo: '13m' },
  { id: 'w_8', handle: 'sab***56', game: 'Lightning Roulette', amount: 27200, timeAgo: '15m' },
];
