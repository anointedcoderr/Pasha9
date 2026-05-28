// Built by Anointed Coder.
//
// Pasha Dice engine. One bet, one settle. Provably fair via
// HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:0`) - the first 4
// bytes of the HMAC map to a uniform float in [0, 1) which is then
// scaled to a result in [0, 100) with two decimals of precision.
//
// Probability + payout math:
//   direction = 'over'  ->  win when result > target
//   direction = 'under' ->  win when result < target  (target ∈ [2, 98])
//   exact match always loses
//
//   winChancePct = (direction === 'over')
//                    ? (100 - target)
//                    : (target)
//   fairMultiplier = 100 / winChancePct
//   multiplier     = fairMultiplier * (1 - houseEdge)
//   payout         = bet * multiplier   (rounded to 2dp)
//
// House edge is passed in basis points (bps). 200 bps = 2.00%.

import { Prisma } from '@prisma/client';
import { bytesToFloat, hmacBytes } from '../provably-fair';

export type DiceDirection = 'over' | 'under';

export interface DiceInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  target: number;
  direction: DiceDirection;
  betAmount: Prisma.Decimal;
  houseEdgeBps: number;
}

export interface DiceResult {
  result: number;              // 0.00 .. 99.99
  win: boolean;
  winChancePct: number;        // theoretical, used by UI
  multiplier: Prisma.Decimal;  // applied to the bet on a win
  payout: Prisma.Decimal;      // bet * multiplier on win, 0 on loss
}

export function rollDice(input: DiceInput): DiceResult {
  const { serverSeed, clientSeed, nonce, target, direction, betAmount, houseEdgeBps } = input;

  if (!Number.isFinite(target) || target < 2 || target > 98) {
    throw new Error('DICE_TARGET_OUT_OF_RANGE');
  }
  if (direction !== 'over' && direction !== 'under') {
    throw new Error('DICE_DIRECTION_INVALID');
  }

  const bytes = hmacBytes(serverSeed, clientSeed, nonce, 0);
  const f = bytesToFloat(bytes);
  // Scale to [0, 100) with two decimals of precision. Math.floor on
  // the scaled value keeps the distribution uniform across the 0.00
  // .. 99.99 buckets.
  const result = Math.floor(f * 10_000) / 100;

  const win = direction === 'over' ? result > target : result < target;
  const winChancePct = direction === 'over' ? 100 - target : target;

  const houseRetention = new Prisma.Decimal(10_000 - houseEdgeBps).div(10_000);
  const fairMultiplier = new Prisma.Decimal(100).div(winChancePct);
  const multiplier = fairMultiplier.mul(houseRetention);

  const payout = win
    ? new Prisma.Decimal(betAmount).mul(multiplier).toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  return {
    result,
    win,
    winChancePct,
    multiplier: multiplier.toDecimalPlaces(4),
    payout,
  };
}

// Re-derives a settled Dice round from its seed triple + bet inputs.
// Used by GET /api/native-games/sessions/[id]/verify so a player can
// re-prove any round outcome.
export function verifyDice(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  target: number,
  direction: DiceDirection,
  betAmount: number | string,
  houseEdgeBps: number,
): DiceResult {
  return rollDice({
    serverSeed,
    clientSeed,
    nonce,
    target,
    direction,
    betAmount: new Prisma.Decimal(betAmount),
    houseEdgeBps,
  });
}
