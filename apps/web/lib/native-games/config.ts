// Built by Anointed Coder.
//
// Pasha Native Games catalog of in-house games. Keep this list small
// and explicit - every gameCode appearing in URLs, API responses and
// the admin console is sourced from here.

export const GAME_CODES = {
  dice: 'dice',
  mines: 'mines',
} as const;

export type GameCode = (typeof GAME_CODES)[keyof typeof GAME_CODES];

export const SUPPORTED_GAME_CODES: GameCode[] = [GAME_CODES.dice, GAME_CODES.mines];

export function isSupportedGameCode(value: string): value is GameCode {
  return SUPPORTED_GAME_CODES.includes(value as GameCode);
}

// Defaults the seeder uses on first upsert. Admins edit live values
// from /admin/native-games after that.
export interface DiceConfig {
  minTarget: number;
  maxTarget: number;
}
export interface MinesConfig {
  gridSize: number;     // total tiles, must be a perfect square
  minMines: number;
  maxMines: number;
}

export const DEFAULT_DICE_CONFIG: DiceConfig = {
  minTarget: 2,
  maxTarget: 98,
};
export const DEFAULT_MINES_CONFIG: MinesConfig = {
  gridSize: 25,         // 5x5
  minMines: 1,
  maxMines: 24,
};

export interface DefaultGameSeed {
  gameCode: GameCode;
  displayName: string;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  config: DiceConfig | MinesConfig;
}

export const DEFAULT_GAMES: DefaultGameSeed[] = [
  {
    gameCode: GAME_CODES.dice,
    displayName: 'Pasha Dice',
    houseEdgeBps: 200,    // 2.00% house edge
    minBet: 10,
    maxBet: 10_000,
    config: DEFAULT_DICE_CONFIG,
  },
  {
    gameCode: GAME_CODES.mines,
    displayName: 'Pasha Mines',
    houseEdgeBps: 200,
    minBet: 10,
    maxBet: 10_000,
    config: DEFAULT_MINES_CONFIG,
  },
];

// SystemSetting key + default for the global on/off switch.
export const NATIVE_GAMES_ENABLED_KEY = 'native_games_enabled';
export const NATIVE_GAMES_ENABLED_DEFAULT = 'true';

// Per-player throttle for any bet or game action. Keeps a runaway
// client from hammering the wallet path.
export const NATIVE_GAMES_RATE_MAX = 30;
export const NATIVE_GAMES_RATE_WINDOW_MS = 60_000;
