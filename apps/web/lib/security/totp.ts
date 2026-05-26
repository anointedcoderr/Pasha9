// Built by Anointed Coder.
//
// M2K TOTP helpers built on otplib v13 (functional API). Each
// function is intentionally thin so the login + admin routes stay
// easy to read.
//
// Enrollment flow:
//   1. /api/auth/2fa/setup    creates a pending secret (encrypted),
//                              returns otpauth URL + QR data URL.
//                              totpEnabled stays false.
//   2. /api/auth/2fa/verify   user submits a code; on first valid
//                              code we flip totpEnabled=true, mint
//                              recovery codes, return them ONCE.
//
// Login flow:
//   - Password OK + totpEnabled=true -> the route returns
//     { challenge: true } instead of cookies.
//   - Client POSTs /api/auth/2fa/challenge with the code (or a
//     recovery code).
//   - On success we mint cookies + record LoginAttempt.

import { generateSecret, generateURI, verifySync } from 'otplib';
import { createHash, randomBytes } from 'node:crypto';
import { encryptString, decryptString } from '@/lib/crypto/aead';

const STEP_SECONDS = 30;
const TOLERANCE_STEPS: [number, number] = [1, 1]; // past + future window

const ISSUER = 'Pasha 9';
const RECOVERY_COUNT = 10;
const RECOVERY_LENGTH = 10;

export interface PendingEnrollment {
  encryptedSecret: string;
  otpauthUrl: string;
}

export function generatePendingEnrollment(label: string): PendingEnrollment {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    strategy: 'totp',
    issuer: ISSUER,
    label,
    secret,
    digits: 6,
    period: STEP_SECONDS,
  });
  return {
    encryptedSecret: encryptString(secret),
    otpauthUrl,
  };
}

export function verifyTotp(code: string, encryptedSecret: string): boolean {
  if (!/^\d{6}$/.test(code.trim())) return false;
  try {
    const secret = decryptString(encryptedSecret);
    const epochTolerance: [number, number] = [TOLERANCE_STEPS[0] * STEP_SECONDS, TOLERANCE_STEPS[1] * STEP_SECONDS];
    const result = verifySync({
      strategy: 'totp',
      token: code.trim(),
      secret,
      digits: 6,
      period: STEP_SECONDS,
      epochTolerance,
    });
    return Boolean(result && (result as { valid?: boolean }).valid);
  } catch {
    return false;
  }
}

export function generateRecoveryCodes(): { codes: string[]; hashedJson: string } {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_COUNT; i += 1) {
    const buf = randomBytes(RECOVERY_LENGTH);
    // 10-char chunks, easy to type, no ambiguous characters.
    const code = buf
      .toString('base64')
      .replace(/[+/=0OIl1]/g, 'x')
      .slice(0, RECOVERY_LENGTH)
      .toUpperCase();
    codes.push(code);
  }
  const hashed = codes.map(hashRecovery);
  return {
    codes,
    hashedJson: JSON.stringify(hashed),
  };
}

function hashRecovery(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/**
 * Returns the updated JSON array (with the matched code removed) if
 * the input matches one of the stored hashes, else null. Caller is
 * expected to persist the new JSON on the User row.
 */
export function consumeRecoveryCode(code: string, hashedJson: string | null): string | null {
  if (!hashedJson) return null;
  let arr: string[];
  try {
    arr = JSON.parse(hashedJson);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const want = hashRecovery(code);
  const idx = arr.indexOf(want);
  if (idx === -1) return null;
  arr.splice(idx, 1);
  return JSON.stringify(arr);
}
