// Built by Anointed Coder.
//
// Pasha Roulette engine. European single-zero wheel (0..36).
// Outcome is uniform over [0, 37) via rejection-sampled HMAC bytes
// so there is no modulo bias.
//
// Supported bet types in Phase 1:
//   red          -> wins on a RED number, pays 1:1
//   black        -> wins on a BLACK number, pays 1:1
//   even         -> wins on an even non-zero number, pays 1:1
//   odd          -> wins on an odd number, pays 1:1
//   low          -> wins on 1..18, pays 1:1
//   high         -> wins on 19..36, pays 1:1
//   straight:N   -> wins on the exact number N (0..36), pays 35:1
//
// House edge applies as the European single-zero edge (1/37 = 2.70%)
// baked in by the zero loss on even-money bets and by the 35:1
// payout on a straight (fair would be 36:1). The houseEdgeBps stored
// on NativeGameProvider is informational here; we do NOT trim payouts
// again on top, otherwise the player would lose twice.

import { Prisma } from '@prisma/client';
import { bytesToInt, hmacBytes } from '../provably-fair';

export type RouletteBetType = 'red' | 'black' | 'odd' | 'even' | 'high' | 'low' | 'straight';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function isRed(n: number): boolean { return RED_NUMBERS.has(n); }
export function isBlack(n: number): boolean { return n !== 0 && !RED_NUMBERS.has(n); }

export interface RouletteInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  wheelSize: number;             // 37 for European
  betType: RouletteBetType;
  straightNumber?: number;       // required when betType === 'straight'
  betAmount: Prisma.Decimal;
}

export interface RouletteResult {
  result: number;                // 0..36
  resultColor: 'red' | 'black' | 'green';
  win: boolean;
  multiplier: Prisma.Decimal;    // 0 on loss; bet multiplier on win (inclusive of stake return)
  payout: Prisma.Decimal;
}

function payoutForBet(betType: RouletteBetType, result: number, straight?: number): number {
  // Multiplier here is "credit returned per 1 bet on win", inclusive
  // of the stake. e.g. red pays 2 (1 bet back + 1 winnings) ; straight
  // pays 36 (1 back + 35 winnings).
  if (result === 0) return betType === 'straight' && straight === 0 ? 36 : 0;
  switch (betType) {
    case 'red':   return isRed(result) ? 2 : 0;
    case 'black': return isBlack(result) ? 2 : 0;
    case 'even':  return result % 2 === 0 ? 2 : 0;
    case 'odd':   return result % 2 === 1 ? 2 : 0;
    case 'low':   return result >= 1 && result <= 18 ? 2 : 0;
    case 'high':  return result >= 19 && result <= 36 ? 2 : 0;
    case 'straight':
      return typeof straight === 'number' && straight === result ? 36 : 0;
    default:
      return 0;
  }
}

export function rollRoulette(input: RouletteInput): RouletteResult {
  const { serverSeed, clientSeed, nonce, wheelSize, betType, straightNumber, betAmount } = input;

  if (wheelSize !== 37) throw new Error('ROULETTE_WHEEL_UNSUPPORTED');
  if (betType === 'straight') {
    if (typeof straightNumber !== 'number' || !Number.isInteger(straightNumber) || straightNumber < 0 || straightNumber > 36) {
      throw new Error('ROULETTE_STRAIGHT_NUMBER_INVALID');
    }
  }

  // Pull 32 HMAC bytes; bytesToInt rejection-samples cleanly for
  // 37, so the result is uniform in [0, 37).
  const stream = hmacBytes(serverSeed, clientSeed, nonce, 0);
  const { value: result } = bytesToInt(stream, wheelSize, 0);

  const credit = payoutForBet(betType, result, straightNumber);
  const win = credit > 0;
  const multiplier = new Prisma.Decimal(credit);
  const payout = win ? new Prisma.Decimal(betAmount).mul(multiplier).toDecimalPlaces(2) : new Prisma.Decimal(0);

  return {
    result,
    resultColor: result === 0 ? 'green' : isRed(result) ? 'red' : 'black',
    win,
    multiplier: multiplier.toDecimalPlaces(4),
    payout,
  };
}
