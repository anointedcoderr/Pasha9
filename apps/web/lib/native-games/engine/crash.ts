// Built by Anointed Coder.
//
// Pasha Crash engine. Phase 1 ships an INSTANT-SETTLE, turn-based
// variant rather than the open real-time race so wallet safety stays
// trivial to reason about:
//
//   - Player declares the cashout target up-front (e.g. 2.00x).
//   - Server picks a crashPoint from the HMAC stream.
//   - If crashPoint >= target the round wins, paying bet * target
//     (this is the cashout that would have triggered before the
//     crash). Otherwise the round loses for the bet amount.
//
// The crashPoint distribution is the standard cumulative-instant-
// bust formula used by open-source crash games, capped at
// maxCrashMultiplier:
//
//   r       = HMAC uint32 in [0, 2^32)
//   if r mod (2^32 / houseEdgeFraction) === 0 -> crashPoint = 1.00 (instant bust)
//   else crashPoint = floor(100 * (2^32 / (2^32 - r))) / 100
//
// where houseEdgeFraction is 10_000 / houseEdgeBps. e.g. with
// houseEdgeBps = 200 (2%) the instant-bust window is 1 / 50 of the
// stream which gives a 2% house edge over a long sample.
//
// A real-time animated front-end can be added later without touching
// this engine: the page just animates the curve from 1.00x up to
// the crashPoint and pauses at the target when win, or stops at the
// crashPoint when loss.

import { Prisma } from '@prisma/client';
import { hmacBytes } from '../provably-fair';

export interface CrashInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  targetMultiplier: number;       // player's chosen autoCashout, e.g. 2.0
  betAmount: Prisma.Decimal;
  houseEdgeBps: number;
  maxCrashMultiplier: number;     // engine cap, e.g. 1000
  minTargetMultiplier: number;    // typically 1.01
  maxTargetMultiplier: number;    // typically 100
}

export interface CrashResult {
  crashPoint: number;             // 1.00 .. maxCrashMultiplier
  targetMultiplier: number;
  win: boolean;
  multiplier: Prisma.Decimal;     // applied to bet on win, else 0
  payout: Prisma.Decimal;
}

export function rollCrash(input: CrashInput): CrashResult {
  const {
    serverSeed,
    clientSeed,
    nonce,
    targetMultiplier,
    betAmount,
    houseEdgeBps,
    maxCrashMultiplier,
    minTargetMultiplier,
    maxTargetMultiplier,
  } = input;

  if (!Number.isFinite(targetMultiplier)) throw new Error('CRASH_TARGET_INVALID');
  if (targetMultiplier < minTargetMultiplier) throw new Error('CRASH_TARGET_BELOW_MIN');
  if (targetMultiplier > maxTargetMultiplier) throw new Error('CRASH_TARGET_ABOVE_MAX');
  if (houseEdgeBps < 0 || houseEdgeBps >= 10_000) throw new Error('CRASH_EDGE_INVALID');

  const bytes = hmacBytes(serverSeed, clientSeed, nonce, 0);
  const r = bytes.readUInt32BE(0);
  const limit = 0x1_0000_0000; // 2^32

  // House edge window: r mod E === 0 forces an instant bust. The
  // probability of that is (10_000 / houseEdgeBps)^-1 = the configured
  // edge.
  const E = Math.max(2, Math.floor(10_000 / Math.max(1, houseEdgeBps)));
  let crashPoint = 1.0;
  if (r % E !== 0) {
    // Avoid division by zero when r is exactly the max value.
    const denom = Math.max(1, limit - r);
    crashPoint = Math.floor((100 * limit) / denom) / 100;
    if (!Number.isFinite(crashPoint) || crashPoint < 1) crashPoint = 1.0;
  }
  if (crashPoint > maxCrashMultiplier) crashPoint = maxCrashMultiplier;
  crashPoint = Math.round(crashPoint * 100) / 100; // tidy to 2dp

  const win = crashPoint >= targetMultiplier;
  const multiplier = win ? new Prisma.Decimal(targetMultiplier) : new Prisma.Decimal(0);
  const payout = win
    ? new Prisma.Decimal(betAmount).mul(multiplier).toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  return {
    crashPoint,
    targetMultiplier,
    win,
    multiplier: multiplier.toDecimalPlaces(4),
    payout,
  };
}
