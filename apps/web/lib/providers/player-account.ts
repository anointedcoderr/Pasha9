// Built by Anointed Coder.
//
// Per-provider numeric member account allocator. iGamingAPIs and
// peer aggregators reject non-numeric user_id values (they return
// `code 1 msg invalid user_id`), so we never expose the internal
// cuid to upstream. Each (providerId, userId) pair gets a stable
// 10-digit numeric memberAccount that we then send as `user_id`
// on the launch payload and resolve back inside the callback
// pipeline.
//
// Generation rules:
//   - first digit 1-9 (no leading zero, no all-numeric ambiguity)
//   - remaining 9 digits 0-9
//   - retry on unique-constraint collision up to MAX_TRIES
//   - once allocated the value never changes

import crypto from 'node:crypto';
import { db } from '@/lib/db/client';

const ACCOUNT_LENGTH = 10;
const MAX_TRIES = 8;

function generateNumericId(): string {
  const buf = crypto.randomBytes(ACCOUNT_LENGTH);
  let s = String(((buf[0] ?? 1) % 9) + 1); // 1-9
  for (let i = 1; i < ACCOUNT_LENGTH; i += 1) {
    s += String((buf[i] ?? 0) % 10);
  }
  return s;
}

export async function getOrCreateMemberAccount(providerId: string, userId: string): Promise<string> {
  const existing = await db.providerPlayerAccount.findUnique({
    where: { providerId_userId: { providerId, userId } },
    select: { memberAccount: true },
  });
  if (existing) return existing.memberAccount;

  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const candidate = generateNumericId();
    try {
      const created = await db.providerPlayerAccount.create({
        data: { providerId, userId, memberAccount: candidate },
        select: { memberAccount: true },
      });
      return created.memberAccount;
    } catch (err) {
      // Either (providerId,userId) raced (someone else just inserted)
      // or (providerId,memberAccount) collided. Both are unique
      // constraints. Re-read first; otherwise retry with a new id.
      const raced = await db.providerPlayerAccount.findUnique({
        where: { providerId_userId: { providerId, userId } },
        select: { memberAccount: true },
      });
      if (raced) return raced.memberAccount;
      // fall through, retry
    }
  }
  throw new Error('Failed to allocate provider member account after retries');
}

export async function lookupUserIdByMemberAccount(providerId: string, memberAccount: string): Promise<string | null> {
  if (!memberAccount) return null;
  const row = await db.providerPlayerAccount.findUnique({
    where: { providerId_memberAccount: { providerId, memberAccount } },
    select: { userId: true },
  });
  return row?.userId ?? null;
}
