// Built by Anointed Coder.
//
// Pasha Mines engine. 5x5 grid by default. Player picks safe tiles
// one at a time; each safe pick raises the cashout multiplier. Hit a
// mine and the round is over for a loss. Cashout any time after at
// least one safe pick.
//
// Multiplier formula (textbook combinatorial):
//   For safeRevealed = k picks against a grid with `totalTiles`
//   tiles and `mineCount` mines:
//
//     fairMultiplier(k) = product over i in [0, k) of
//                           totalTiles - i
//                           ---------------
//                           totalTiles - mineCount - i
//
//   Then we apply the house edge:
//
//     multiplier = fairMultiplier(k) * (1 - houseEdgeBps / 10_000)
//
// Mine positions are generated up-front via Fisher-Yates on the HMAC
// stream so the entire layout is deterministic from
// (serverSeed, clientSeed, nonce, mineCount). Stored in
// gameRound.gameData.minePositions and ONLY returned to the client
// once the round is settled (LOSS / CASHOUT).

import { Prisma } from '@prisma/client';
import { generateShuffledArray } from '../provably-fair';

export interface MineGridInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  totalTiles: number;
  mineCount: number;
}

// Returns sorted mine indices in [0, totalTiles).
export function generateMineGrid(input: MineGridInput): number[] {
  const { serverSeed, clientSeed, nonce, totalTiles, mineCount } = input;
  if (!Number.isInteger(totalTiles) || totalTiles <= 1) {
    throw new Error('MINES_TOTAL_INVALID');
  }
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount >= totalTiles) {
    throw new Error('MINES_COUNT_OUT_OF_RANGE');
  }
  const shuffled = generateShuffledArray(serverSeed, clientSeed, nonce, totalTiles);
  return shuffled.slice(0, mineCount).sort((a, b) => a - b);
}

export interface MultiplierInput {
  totalTiles: number;
  mineCount: number;
  safeRevealed: number;
  houseEdgeBps: number;
}

export function computeMultiplier(input: MultiplierInput): Prisma.Decimal {
  const { totalTiles, mineCount, safeRevealed, houseEdgeBps } = input;
  if (safeRevealed <= 0) return new Prisma.Decimal(1).toDecimalPlaces(4);
  const safeTotal = totalTiles - mineCount;
  if (safeRevealed > safeTotal) throw new Error('MINES_REVEAL_OVERFLOW');

  let fair = new Prisma.Decimal(1);
  for (let i = 0; i < safeRevealed; i += 1) {
    fair = fair
      .mul(new Prisma.Decimal(totalTiles - i))
      .div(new Prisma.Decimal(totalTiles - mineCount - i));
  }
  const retention = new Prisma.Decimal(10_000 - houseEdgeBps).div(10_000);
  return fair.mul(retention).toDecimalPlaces(4);
}

export interface RevealInput {
  grid: number[];                  // sorted mine indices
  revealedTiles: number[];         // existing safe picks
  pick: number;                    // new tile index in [0, totalTiles)
  totalTiles: number;
  mineCount: number;
  houseEdgeBps: number;
}

export interface RevealResult {
  hitMine: boolean;
  alreadyRevealed: boolean;
  safeCount: number;
  nextMultiplier: Prisma.Decimal;  // 1.0000 when no safe picks yet
}

export function revealTile(input: RevealInput): RevealResult {
  const { grid, revealedTiles, pick, totalTiles, mineCount, houseEdgeBps } = input;
  if (!Number.isInteger(pick) || pick < 0 || pick >= totalTiles) {
    throw new Error('MINES_PICK_OUT_OF_RANGE');
  }
  if (revealedTiles.includes(pick)) {
    return {
      hitMine: false,
      alreadyRevealed: true,
      safeCount: revealedTiles.length,
      nextMultiplier: computeMultiplier({
        totalTiles,
        mineCount,
        safeRevealed: revealedTiles.length,
        houseEdgeBps,
      }),
    };
  }
  const hitMine = grid.includes(pick);
  const safeCount = hitMine ? revealedTiles.length : revealedTiles.length + 1;
  const nextMultiplier = hitMine
    ? new Prisma.Decimal(0)
    : computeMultiplier({
        totalTiles,
        mineCount,
        safeRevealed: safeCount,
        houseEdgeBps,
      });
  return { hitMine, alreadyRevealed: false, safeCount, nextMultiplier };
}

// Re-derives a settled Mines round for the verify endpoint. Mirrors
// generateMineGrid so a player can re-prove the layout matched the
// seeded outcome.
export function verifyMineGrid(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  totalTiles: number,
  mineCount: number,
): number[] {
  return generateMineGrid({ serverSeed, clientSeed, nonce, totalTiles, mineCount });
}
