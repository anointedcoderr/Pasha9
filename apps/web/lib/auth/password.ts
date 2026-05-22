// Built by Anointed Coder.
// Thin wrapper around bcrypt. Centralised so the cost factor can change in one place.

import bcrypt from 'bcrypt';

const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
