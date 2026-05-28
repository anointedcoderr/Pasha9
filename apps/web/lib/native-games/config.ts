// Built by Anointed Coder.
//
// Pasha Native Games catalog of in-house games. Keep this list small
// and explicit - every gameCode appearing in URLs, API responses and
// the admin console is sourced from here.

export const GAME_CODES = {
  dice: 'dice',
  mines: 'mines',
  keno: 'keno',
  roulette: 'roulette',
  slots: 'slots',
  crash: 'crash',
} as const;

export type GameCode = (typeof GAME_CODES)[keyof typeof GAME_CODES];

export const SUPPORTED_GAME_CODES: GameCode[] = [
  GAME_CODES.dice,
  GAME_CODES.mines,
  GAME_CODES.keno,
  GAME_CODES.roulette,
  GAME_CODES.slots,
  GAME_CODES.crash,
];

export function isSupportedGameCode(value: string): value is GameCode {
  return SUPPORTED_GAME_CODES.includes(value as GameCode);
}

// Per-game play page paths. Public lobby + homepage card render
// uses this map so a future game only needs an entry here.
export const PLAY_PAGES: Record<GameCode, string> = {
  dice: '/games/dice',
  mines: '/games/mines',
  keno: '/games/keno',
  roulette: '/games/roulette',
  slots: '/games/slots',
  crash: '/games/crash',
};

// ---------- Per-game configuration shapes ----------

export interface DiceConfig {
  minTarget: number;
  maxTarget: number;
}
export interface MinesConfig {
  gridSize: number;     // total tiles, must be a perfect square
  minMines: number;
  maxMines: number;
}
export interface KenoConfig {
  poolSize: number;     // numbers in the draw pool, 1..N
  drawCount: number;    // count of numbers the server draws
  minPicks: number;     // minimum picks per round
  maxPicks: number;     // maximum picks per round
}
export interface RouletteConfig {
  wheelSize: number;    // 37 = European (0..36)
}
export interface SlotsConfig {
  reels: number;
  symbols: string[];    // ordered, index = stop
  // Paytable: keyed by symbol -> { count: multiplier }. A "3" entry
  // means three-of-a-kind on the single payline (middle row of three
  // reels) pays N * bet.
  paytable: Record<string, Record<string, number>>;
}
export interface CrashConfig {
  minTargetMultiplier: number;   // 1.01
  maxTargetMultiplier: number;   // 100
  // Maximum crash multiplier the engine will produce. Caps payout
  // exposure even before the player's autoCashout is hit.
  maxCrashMultiplier: number;
}

export const DEFAULT_DICE_CONFIG: DiceConfig = { minTarget: 2, maxTarget: 98 };
export const DEFAULT_MINES_CONFIG: MinesConfig = { gridSize: 25, minMines: 1, maxMines: 24 };
export const DEFAULT_KENO_CONFIG: KenoConfig = { poolSize: 80, drawCount: 20, minPicks: 1, maxPicks: 10 };
export const DEFAULT_ROULETTE_CONFIG: RouletteConfig = { wheelSize: 37 };
export const DEFAULT_SLOTS_CONFIG: SlotsConfig = {
  reels: 3,
  // Eight original symbols. Higher index = rarer (sort of). Kept
  // alphabetical so the order is stable across versions.
  symbols: ['CHERRY', 'CLOVER', 'CROWN', 'DIAMOND', 'LEMON', 'NINE', 'SEVEN', 'STAR'],
  // 3-of-a-kind payouts in bet-multipliers. Anything not listed pays
  // zero. House edge is baked into these numbers (they sum below the
  // fair value for the symbol probability).
  paytable: {
    CHERRY:  { '3': 5 },
    LEMON:   { '3': 5 },
    CLOVER:  { '3': 8 },
    NINE:    { '3': 10 },
    STAR:    { '3': 20 },
    DIAMOND: { '3': 40 },
    CROWN:   { '3': 80 },
    SEVEN:   { '3': 150 },
  },
};
export const DEFAULT_CRASH_CONFIG: CrashConfig = {
  minTargetMultiplier: 1.01,
  maxTargetMultiplier: 100,
  maxCrashMultiplier: 1000,
};

export interface DefaultGameSeed {
  gameCode: GameCode;
  displayName: string;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  config: DiceConfig | MinesConfig | KenoConfig | RouletteConfig | SlotsConfig | CrashConfig;
}

// Dice + Mines stay active and featured; the rest seed in inactive
// "Coming Soon" state until QA flips them on from /admin/native-games.
// Operators MUST not enable an untested game in production.
export const DEFAULT_GAMES: DefaultGameSeed[] = [
  {
    gameCode: GAME_CODES.dice,
    displayName: 'Pasha Dice',
    houseEdgeBps: 200,
    minBet: 10,
    maxBet: 10_000,
    isActive: true,
    isFeatured: true,
    sortOrder: 10,
    config: DEFAULT_DICE_CONFIG,
  },
  {
    gameCode: GAME_CODES.mines,
    displayName: 'Pasha Mines',
    houseEdgeBps: 200,
    minBet: 10,
    maxBet: 10_000,
    isActive: true,
    isFeatured: true,
    sortOrder: 20,
    config: DEFAULT_MINES_CONFIG,
  },
  {
    gameCode: GAME_CODES.keno,
    displayName: 'Pasha Keno',
    houseEdgeBps: 500,
    minBet: 10,
    maxBet: 5_000,
    isActive: false,
    isFeatured: false,
    sortOrder: 30,
    config: DEFAULT_KENO_CONFIG,
  },
  {
    gameCode: GAME_CODES.roulette,
    displayName: 'Pasha Roulette',
    houseEdgeBps: 270,  // matches European 1/37 single-zero edge
    minBet: 10,
    maxBet: 10_000,
    isActive: false,
    isFeatured: false,
    sortOrder: 40,
    config: DEFAULT_ROULETTE_CONFIG,
  },
  {
    gameCode: GAME_CODES.slots,
    displayName: 'Pasha Slots',
    houseEdgeBps: 400,
    minBet: 10,
    maxBet: 1_000,
    isActive: false,
    isFeatured: false,
    sortOrder: 50,
    config: DEFAULT_SLOTS_CONFIG,
  },
  {
    gameCode: GAME_CODES.crash,
    displayName: 'Pasha Crash',
    houseEdgeBps: 200,
    minBet: 10,
    maxBet: 5_000,
    isActive: false,
    isFeatured: false,
    sortOrder: 60,
    config: DEFAULT_CRASH_CONFIG,
  },
];

// SystemSetting key + default for the global on/off switch.
export const NATIVE_GAMES_ENABLED_KEY = 'native_games_enabled';
export const NATIVE_GAMES_ENABLED_DEFAULT = 'true';

// Per-player throttle for any bet or game action. Keeps a runaway
// client from hammering the wallet path.
export const NATIVE_GAMES_RATE_MAX = 30;
export const NATIVE_GAMES_RATE_WINDOW_MS = 60_000;
