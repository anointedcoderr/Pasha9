// Built by Anointed Coder.
// Leaderboard rows for the (later) Leaderboard screen and Home teasers.

export interface LeaderRow {
  rank: number;
  handle: string;
  winnings: number;
  avatarUrl: string;
}

export const mockLeaderboard: LeaderRow[] = [
  { rank: 1, handle: 'jub***82', winnings: 842000, avatarUrl: 'https://picsum.photos/seed/pasha-lb1/96/96' },
  { rank: 2, handle: 'sha***09', winnings: 615400, avatarUrl: 'https://picsum.photos/seed/pasha-lb2/96/96' },
  { rank: 3, handle: 'raf***21', winnings: 588100, avatarUrl: 'https://picsum.photos/seed/pasha-lb3/96/96' },
  { rank: 4, handle: 'mim***45', winnings: 421900, avatarUrl: 'https://picsum.photos/seed/pasha-lb4/96/96' },
  { rank: 5, handle: 'nas***77', winnings: 366500, avatarUrl: 'https://picsum.photos/seed/pasha-lb5/96/96' },
  { rank: 6, handle: 'sab***56', winnings: 302300, avatarUrl: 'https://picsum.photos/seed/pasha-lb6/96/96' },
  { rank: 7, handle: 'tan***13', winnings: 271800, avatarUrl: 'https://picsum.photos/seed/pasha-lb7/96/96' },
  { rank: 8, handle: 'kar***38', winnings: 244000, avatarUrl: 'https://picsum.photos/seed/pasha-lb8/96/96' },
];
