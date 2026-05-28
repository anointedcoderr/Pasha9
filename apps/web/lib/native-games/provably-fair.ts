// Built by Anointed Coder.
//
// Pasha Native Games provably-fair primitives.
//
// All round outcomes are derived from HMAC-SHA256(serverSeed,
// `${clientSeed}:${nonce}:${cursor}`). The same (serverSeed,
// clientSeed, nonce) triple always replays identical bytes, so a
// settled session can be verified by anyone once the serverSeed is
// revealed.
//
// No Math.random anywhere - that would defeat the entire scheme.
// Node `crypto` only.

import { createHash, createHmac, randomBytes } from 'node:crypto';

const HASH_BYTES = 32; // SHA-256 output

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function generateClientSeed(): string {
  // 16 random hex bytes is plenty for a player-side seed default. The
  // UI can let the player overwrite this if they want to bring their
  // own entropy.
  return randomBytes(16).toString('hex');
}

export function hashServerSeed(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

// Concatenates HMAC output across one or more cursors so callers that
// need more than 32 random bytes (Mines shuffle) can keep pulling
// fresh, deterministic bytes from the same (serverSeed, clientSeed,
// nonce) triple.
export function hmacBytes(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor = 0,
): Buffer {
  return createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest();
}

// Maps the first 4 HMAC bytes to a uniform float in [0, 1). Used by
// dice (scale to 0..100) and any future game that needs a uniform
// float draw.
export function bytesToFloat(bytes: Buffer): number {
  if (bytes.length < 4) throw new Error('NATIVE_GAMES_BYTES_TOO_SHORT');
  // 32-bit unsigned int / (2^32) keeps the result strictly < 1.
  const u32 = bytes.readUInt32BE(0);
  return u32 / 0x1_0000_0000;
}

// Maps the first 4 HMAC bytes to an integer in [0, max). Used by the
// Mines Fisher-Yates shuffle. Rejects the upper-most bucket of values
// when (2^32 % max) != 0 would otherwise bias the result; if we hit a
// biased value we walk forward through the same buffer until we find
// a clean draw.
export function bytesToInt(bytes: Buffer, max: number, offset = 0): { value: number; consumed: number } {
  if (max <= 0) throw new Error('NATIVE_GAMES_MAX_INVALID');
  const limit = 0x1_0000_0000;
  const cleanCeiling = limit - (limit % max);
  let cursor = offset;
  while (cursor + 4 <= bytes.length) {
    const u32 = bytes.readUInt32BE(cursor);
    cursor += 4;
    if (u32 < cleanCeiling) {
      return { value: u32 % max, consumed: cursor - offset };
    }
  }
  // Caller is responsible for supplying enough bytes. We do not
  // silently fall back to a biased draw - it would be a footgun for
  // any future game that needs strict uniformity.
  throw new Error('NATIVE_GAMES_BYTES_EXHAUSTED');
}

// Deterministic Fisher-Yates shuffle of [0, length) using the HMAC
// stream as the entropy source. We pull as many 32-byte HMAC blocks as
// the rejection sampler needs and concatenate them, so the result is
// fully reproducible from (serverSeed, clientSeed, nonce, length).
export function generateShuffledArray(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  length: number,
): number[] {
  if (length <= 0) return [];
  const out = Array.from({ length }, (_, i) => i);

  // Pre-allocate a generous buffer. 32 bytes per cursor block is the
  // SHA-256 width; one block usually covers a 25-slot Mines grid even
  // with rejection sampling.
  const buf: Buffer[] = [hmacBytes(serverSeed, clientSeed, nonce, 0)];
  let cursor = 0;
  let cursorBlock = 1;
  const ensureBytes = (need: number) => {
    while (Buffer.concat(buf).length - cursor < need) {
      buf.push(hmacBytes(serverSeed, clientSeed, nonce, cursorBlock));
      cursorBlock += 1;
    }
  };

  for (let i = length - 1; i > 0; i -= 1) {
    ensureBytes(HASH_BYTES);
    let stream = Buffer.concat(buf);
    let pick: { value: number; consumed: number };
    try {
      pick = bytesToInt(stream, i + 1, cursor);
    } catch {
      // Refill once and try again. In practice this branch never
      // triggers for length <= 256 with a 64-byte buffer.
      ensureBytes(HASH_BYTES * 2);
      stream = Buffer.concat(buf);
      pick = bytesToInt(stream, i + 1, cursor);
    }
    cursor += pick.consumed;
    const j = pick.value;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
