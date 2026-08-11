// Built by Anointed Coder.
//
// Staff Point Wallet. Mirrors lib/wallet/ledger.ts on purpose: same shape,
// same guarantee. A staff/admin account (never super_admin, who is
// unrestricted) is allocated a fixed pool of points by a super_admin. Every
// player-balance credit that staff member makes spends 1:1 from that pool,
// atomically, in the same transaction as the credit itself. When the pool
// reaches zero they cannot credit another player until topped up.
//
// This is the money-side half of the client's security requirement: a
// staff member with Balance Management access must have a hard ceiling on
// how much they can ever move into player wallets, not unlimited reach.

import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export const STAFF_POINT_TYPE = {
  grant: 'grant',
  spend: 'spend',
  adjust: 'adjust',
} as const;

function dec(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

/** Read a staff member's current point balance. 0 if they have no wallet yet. */
export async function loadStaffPointBalance(db: Tx, staffId: string): Promise<Prisma.Decimal> {
  const w = await db.staffPointWallet.findUnique({ where: { staffId }, select: { balance: true } });
  return dec(w?.balance ?? 0);
}

export interface StaffPointMovementInput {
  tx: Tx;
  staffId: string;
  /** Signed. Positive grants points, negative spends them. */
  amount: Prisma.Decimal | number | string;
  type: string;
  actorId?: string | null;
  actorRole?: string | null;
  /** The player credited, for a 'spend' entry. */
  targetUserId?: string | null;
  reason?: string | null;
  meta?: Prisma.JsonObject | null;
}

/**
 * Move a staff member's points and record it, atomically. Creates the wallet
 * row on first use (lazy, so granting points to a brand-new staff account
 * needs no separate provisioning step).
 *
 * Throws INSUFFICIENT_STAFF_POINTS if a spend would take the balance below
 * zero - the caller (the balance route) is expected to check this BEFORE
 * doing any player-facing work, so a rejected credit never partially lands.
 * This check is still enforced here too, inside the transaction, so two
 * concurrent credits from the same staff member cannot both pass a
 * pre-check and jointly overspend the pool.
 */
export async function applyStaffPointMovement(input: StaffPointMovementInput) {
  const { tx, staffId } = input;
  const amount = dec(input.amount);

  const wallet = await tx.staffPointWallet.upsert({
    where: { staffId },
    update: {},
    create: { staffId, balance: 0 },
    select: { balance: true },
  });
  const before = dec(wallet.balance);
  const after = before.add(amount);

  if (after.isNegative()) {
    const err = new Error('Staff point balance cannot go below zero.');
    (err as Error & { code: string }).code = 'INSUFFICIENT_STAFF_POINTS';
    throw err;
  }

  await tx.staffPointWallet.update({ where: { staffId }, data: { balance: after } });

  const entry = await tx.staffPointLedger.create({
    data: {
      staffId,
      type: input.type,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetUserId: input.targetUserId ?? null,
      reason: input.reason ?? null,
      meta: (input.meta ?? undefined) as Prisma.InputJsonValue,
    },
  });

  return { id: entry.id, before, after };
}
