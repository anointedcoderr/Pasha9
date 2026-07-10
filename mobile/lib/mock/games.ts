// Built by Anointed Coder.
// Hot / trending games used by the Home grid and the GameTile component.
// Images use seeded picsum URLs so no local asset files are required.

export interface Game {
  id: string;
  name: string;
  provider: string;
  imageUrl: string;
  isHot?: boolean;
  isNew?: boolean;
}

function tile(seed: string): string {
  return `https://picsum.photos/seed/${seed}/300/300`;
}

export const mockHotGames: Game[] = [
  { id: 'g_aviator', name: 'Aviator', provider: 'Spribe', imageUrl: tile('pasha-aviator'), isHot: true },
  { id: 'g_crazytime', name: 'Crazy Time', provider: 'Evolution', imageUrl: tile('pasha-crazytime'), isHot: true },
  { id: 'g_sweetbonanza', name: 'Sweet Bonanza', provider: 'Pragmatic', imageUrl: tile('pasha-sweet'), isNew: true },
  { id: 'g_gatesolympus', name: 'Gates of Olympus', provider: 'Pragmatic', imageUrl: tile('pasha-gates'), isHot: true },
  { id: 'g_lightning', name: 'Lightning Roulette', provider: 'Evolution', imageUrl: tile('pasha-lightning') },
  { id: 'g_mines', name: 'Mines', provider: 'Spribe', imageUrl: tile('pasha-mines'), isNew: true },
  { id: 'g_wingo', name: 'WinGo 1m', provider: 'Pasha Originals', imageUrl: tile('pasha-wingo'), isHot: true },
  { id: 'g_plinko', name: 'Plinko', provider: 'Spribe', imageUrl: tile('pasha-plinko') },
  { id: 'g_dragontiger', name: 'Dragon Tiger', provider: 'Evolution', imageUrl: tile('pasha-dragon') },
  { id: 'g_bigbass', name: 'Big Bass Bonanza', provider: 'Pragmatic', imageUrl: tile('pasha-bass'), isNew: true },
  { id: 'g_baccarat', name: 'Speed Baccarat', provider: 'Evolution', imageUrl: tile('pasha-baccarat') },
  { id: 'g_fortunetiger', name: 'Fortune Tiger', provider: 'PG Soft', imageUrl: tile('pasha-tiger'), isHot: true },
];
