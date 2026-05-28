// Built by Anointed Coder.
//
// Pasha Slots engine. Server picks a reel stop per reel from a
// uniform draw over the symbol list using rejection-sampled HMAC
// bytes. A single payline (middle row across all reels) settles the
// round: three of a kind on the payline pays from the paytable.
//
// The paytable lives on the NativeGameProvider.config blob so admins
// can adjust it without code changes - in practice we keep the
// defaults sourced from lib/native-games/config.ts.
//
// House edge applies as a final multiplicative trim on the win
// amount so the operator can keep the paytable readable.

import { Prisma } from '@prisma/client';
import { bytesToInt, hmacBytes } from '../provably-fair';

export interface SlotsInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  reels: number;
  symbols: string[];
  paytable: Record<string, Record<string, number>>;
  betAmount: Prisma.Decimal;
  houseEdgeBps: number;
}

export interface SlotsResult {
  reelStops: number[];           // index into symbols[] per reel
  reelSymbols: string[];         // symbols[reelStops[i]]
  matchedSymbol: string | null;
  matchedCount: number;          // 0 or reels (single payline, all-equal)
  fairMultiplier: number;        // before house edge
  multiplier: Prisma.Decimal;
  payout: Prisma.Decimal;
  win: boolean;
}

export function rollSlots(input: SlotsInput): SlotsResult {
  const { serverSeed, clientSeed, nonce, reels, symbols, paytable, betAmount, houseEdgeBps } = input;

  if (!Array.isArray(symbols) || symbols.length < 2) throw new Error('SLOTS_SYMBOLS_INVALID');
  if (!Number.isInteger(reels) || reels < 1 || reels > 7) throw new Error('SLOTS_REELS_INVALID');

  // Pull a fresh HMAC block per reel so the result is fully
  // deterministic across replays.
  const reelStops: number[] = [];
  for (let i = 0; i < reels; i += 1) {
    const stream = hmacBytes(serverSeed, clientSeed, nonce, i);
    const { value } = bytesToInt(stream, symbols.length, 0);
    reelStops.push(value);
  }
  const reelSymbols = reelStops.map((s) => symbols[s]);

  // Single payline: all reels must show the same symbol.
  const first = reelSymbols[0];
  const allEqual = reelSymbols.every((s) => s === first);
  const matchedSymbol = allEqual ? first : null;
  const matchedCount = allEqual ? reels : 0;

  let fairMultiplier = 0;
  if (matchedSymbol) {
    const entry = paytable[matchedSymbol];
    if (entry) {
      const key = String(matchedCount);
      const v = entry[key];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) fairMultiplier = v;
    }
  }

  const retention = new Prisma.Decimal(10_000 - houseEdgeBps).div(10_000);
  const multiplier = new Prisma.Decimal(fairMultiplier).mul(retention);
  const payout = fairMultiplier > 0
    ? new Prisma.Decimal(betAmount).mul(multiplier).toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  return {
    reelStops,
    reelSymbols,
    matchedSymbol,
    matchedCount,
    fairMultiplier,
    multiplier: multiplier.toDecimalPlaces(4),
    payout,
    win: payout.gt(0),
  };
}
