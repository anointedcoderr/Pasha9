// Built by Anointed Coder.
// Referral code helpers.

import { customAlphabet } from 'nanoid';
import { db } from '@/lib/db/client';

const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // unambiguous, URL-safe
const generate = customAlphabet(alphabet, 8);

export async function generateUniqueReferralCode(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generate();
    const exists = await db.user.findUnique({ where: { referralCode: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new Error('Could not allocate a unique referral code after several attempts.');
}

export function buildReferralLink(code: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pasha9.com';
  return `${base.replace(/\/$/, '')}/?r=${code}`;
}
