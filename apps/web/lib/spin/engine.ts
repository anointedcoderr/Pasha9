// Built by Anointed Coder.
//
// Server-authoritative spin pick. crypto.randomBytes-derived weighted
// selection over the EXCLUDE-FILTERED pool. Pure function over an
// input array of segments so unit tests can call it without a database.
//
// The eligible pool is the subset of input segments where
// excludeFromWins is false. The flag is server-only and is NEVER
// returned by the public /api/content/spin-wheel endpoint, so the
// visual wheel still renders every active wedge and the spin
// animation continues to land normally - the engine just never picks
// the excluded wedges.
//
// When the pool is empty (every wedge has been marked display-only)
// the engine refuses to invent a winner and returns a fallback
// outcome. The api route then honours HARD_FALLBACK_REFUND: refund
// the cost, write a WheelSpin row with fallbackUsed=true, and return
// a soft error to the player.

import { randomBytes } from 'crypto';

export interface SpinEngineSegment {
  id: string;
  label: string;
  weight: number;
  excludeFromWins: boolean;
}

export interface SpinEnginePickWin<S extends SpinEngineSegment> {
  kind: 'win';
  chosen: S;
  chosenIndex: number;        // index into the ORIGINAL input array (for animation)
  eligiblePool: Array<{ segmentId: string; label: string; weight: number }>;
  totalWeight: number;
  pickValue: number;
  serverNonceHex: string;
}

export interface SpinEngineFallback {
  kind: 'fallback';
  reason: 'NO_ELIGIBLE_SEGMENTS';
  eligiblePool: Array<{ segmentId: string; label: string; weight: number }>;
  serverNonceHex: string;
}

export type SpinEngineResult<S extends SpinEngineSegment> =
  | SpinEnginePickWin<S>
  | SpinEngineFallback;

// Cryptographically-strong uniform integer in [0, max). Rejection
// sampling on uint32 so the bias from `randomBytes(4) % max` is
// removed for any max <= 2^32.
function uniformInt(max: number): { value: number; nonceHex: string } {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error('uniformInt(max): max must be a positive integer');
  }
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  for (let i = 0; i < 16; i += 1) {
    const buf = randomBytes(4);
    const u = buf.readUInt32BE(0);
    if (u < limit) {
      return { value: u % max, nonceHex: buf.toString('hex') };
    }
  }
  // Astronomically unlikely (>16 rejections in a row). Fall back to
  // the biased modulo on the last sample so the engine never throws.
  const buf = randomBytes(4);
  return { value: buf.readUInt32BE(0) % max, nonceHex: buf.toString('hex') };
}

export function pickSpinSegment<S extends SpinEngineSegment>(segments: S[]): SpinEngineResult<S> {
  // Snapshot the eligible pool first so the caller can persist it on
  // WheelSpin even if the result is a fallback.
  const eligibleIndices: number[] = [];
  const eligiblePool: Array<{ segmentId: string; label: string; weight: number }> = [];
  let totalWeight = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    if (s.excludeFromWins) continue;
    const w = Math.max(1, Math.floor(s.weight));
    eligibleIndices.push(i);
    eligiblePool.push({ segmentId: s.id, label: s.label, weight: w });
    totalWeight += w;
  }

  if (eligiblePool.length === 0 || totalWeight === 0) {
    // No winnable wedges. The engine refuses to pick and lets the
    // route handler trigger HARD_FALLBACK_REFUND.
    const nonce = randomBytes(4).toString('hex');
    return {
      kind: 'fallback',
      reason: 'NO_ELIGIBLE_SEGMENTS',
      eligiblePool,
      serverNonceHex: nonce,
    };
  }

  const { value: pickValue, nonceHex } = uniformInt(totalWeight);
  let cumulative = 0;
  for (let j = 0; j < eligiblePool.length; j += 1) {
    cumulative += eligiblePool[j].weight;
    if (pickValue < cumulative) {
      const chosenIndex = eligibleIndices[j];
      return {
        kind: 'win',
        chosen: segments[chosenIndex],
        chosenIndex,
        eligiblePool,
        totalWeight,
        pickValue,
        serverNonceHex: nonceHex,
      };
    }
  }

  // Defensive fallback. Should be unreachable because pickValue < totalWeight.
  const lastIdx = eligibleIndices[eligibleIndices.length - 1];
  return {
    kind: 'win',
    chosen: segments[lastIdx],
    chosenIndex: lastIdx,
    eligiblePool,
    totalWeight,
    pickValue,
    serverNonceHex: nonceHex,
  };
}
