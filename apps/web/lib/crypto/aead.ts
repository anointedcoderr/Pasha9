// Built by Anointed Coder.
//
// AES-256-GCM authenticated encryption for at-rest secrets.
// First use: TOTP secrets (M2K) - we never want a stolen DB dump to
// expose plaintext TOTP seeds. Same helper can wrap future secrets.
//
// Key source: process.env.SECRETS_KEY (64 hex chars = 32 bytes). If
// the env is unset we fall back to JWT_SECRET so an existing deploy
// keeps working; the wrapper still encrypts, just with a key that
// happens to equal the JWT secret. Operators are encouraged to set
// SECRETS_KEY explicitly via a one-line .env update.
//
// Output format: base64(iv || ciphertext || authTag). Designed to be
// stored as a single string column.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;          // GCM standard
const TAG_LEN = 16;

// resolveKey is called lazily on the first encrypt/decrypt call so
// that simply importing this module during `next build` page
// collection (which sets NODE_ENV=production with placeholder envs
// that may not include a strong JWT_SECRET) does not crash the
// build. The strict prod check still fires the very first time
// real crypto is requested at runtime, so a misconfigured server
// fails fast on its first AEAD call.
function resolveKey(): Buffer {
  const explicit = process.env.SECRETS_KEY?.trim();
  if (explicit && explicit.length >= 64) {
    // Accept both hex (64 chars) and raw 32-byte utf-8 (unlikely but valid).
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) return Buffer.from(explicit, 'hex');
    return createHash('sha256').update(explicit).digest();
  }
  // Fallback path: derive a 32-byte key from JWT_SECRET so an
  // existing deploy that has not rotated to a dedicated SECRETS_KEY
  // keeps working. We refuse to fall back to the bundled
  // development placeholder when NODE_ENV says production: that
  // would silently encrypt at-rest secrets with a publicly known
  // key. The check looks at both the missing-env case and the
  // explicitly-weak case (< 16 chars).
  const jwt = process.env.JWT_SECRET ?? '';
  const isProd = process.env.NODE_ENV === 'production';
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (isProd && !isBuild && jwt.length < 16) {
    throw new Error(
      'AEAD_KEY_UNSET: set SECRETS_KEY (64 hex chars) or a strong JWT_SECRET (>=16 chars) before starting the production server.',
    );
  }
  const material = jwt.length >= 16 ? jwt : 'pasha9-dev-secret-do-not-use';
  return createHash('sha256').update(material).digest();
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) cachedKey = resolveKey();
  return cachedKey;
}

export function encryptString(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

export function decryptString(blob: string): string {
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('AEAD_INVALID_BLOB');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const enc = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return out.toString('utf8');
}
