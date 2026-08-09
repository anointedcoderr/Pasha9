// Built by Anointed Coder.
//
// THE single place a player's balance is allowed to change.
//
// Why this exists: balance updates were scattered across ~22 call sites, each
// doing its own `wallet.update({ balance: { increment } })`. Most also wrote a
// Transaction row, but nothing enforced it, and the ones that forgot produced
// exactly the complaint that could not be answered - "my balance changed and
// there is nothing in my history". Worse, no record anywhere stored the
// balance BEFORE and AFTER, so a missing entry was undetectable: you could
// not tell a correct history from one with a hole in it.
//
// applyWalletMovement() reads the balance, moves it, and writes the ledger
// row inside ONE database transaction. If the ledger write fails the money
// does not move, so "balance changed with no record" becomes structurally
// impossible rather than a rule people have to remember.
//
// Contract for callers:
//   - Always pass the caller's own `tx`. The movement must commit or roll
//     back together with whatever business action caused it (approving a
//     deposit, settling a bet). Passing the global client would let the money
//     move while the surrounding action fails.
//   - `amount` is SIGNED: positive credits the player, negative debits.
//   - Never edit or delete a ledger row. A mistake is corrected by writing a
//     reversal that points at the original (see reverseWalletMovement).

import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Namespaced movement kinds. Free-form on purpose (the column is a String) so
 * a new money source never needs a migration, but every existing caller
 * should use a constant from here so the admin filters stay meaningful.
 */
export const LEDGER_TYPE = {
  deposit: 'deposit',
  withdrawal: 'withdrawal',
  withdrawalRefund: 'withdrawal.refund',
  providerBet: 'provider.bet',
  providerWin: 'provider.win',
  providerRollback: 'provider.rollback',
  nativeBet: 'native.bet',
  nativeWin: 'native.win',
  bonusGrant: 'bonus.grant',
  bonusRelease: 'bonus.release',
  bonusClawback: 'bonus.clawback',
  cashback: 'cashback',
  spin: 'spin.reward',
  bettingPass: 'betting_pass.reward',
  promoCode: 'promo_code.reward',
  referral: 'referral.reward',
  affiliate: 'affiliate.commission',
  vip: 'vip.reward',
  lotto: 'lotto.prize',
  tournament: 'tournament.prize',
  adminCredit: 'admin.credit',
  adminDebit: 'admin.debit',
  reversal: 'reversal',
  // One-time go-live entries, written by scripts/reset-balances.ts only.
  // openingBalance RECORDS money that already existed before the ledger did,
  // without moving it, so a player's chain starts from a truthful figure
  // rather than from a gap. openingReset is the operator zeroing the account
  // afterwards. Never emitted by normal application code.
  openingBalance: 'opening.balance',
  openingReset: 'opening.reset',
} as const;

export interface WalletMovementInput {
  /** MUST be the caller's transaction client - see the contract note above. */
  tx: Tx;
  userId: string;
  /** Signed. Positive credits the player, negative debits. */
  amount: Prisma.Decimal | number | string;
  type: string;
  description?: string | null;
  status?: string;

  // Evidence. Supply whatever the source knows; all optional.
  transactionId?: string | null;
  providerTransactionId?: string | null;
  providerName?: string | null;
  gameUid?: string | null;
  gameName?: string | null;
  betId?: string | null;
  roundId?: string | null;
  referenceId?: string | null;
  bonusSource?: string | null;

  /** Set for manual operator actions so the responsible person is recorded. */
  actorId?: string | null;
  actorRole?: string | null;

  /** Only for a correction: the ledger row this one reverses. */
  reversesId?: string | null;

  meta?: Prisma.JsonObject | null;

  /**
   * Pocket-to-pocket moves (a bonus unlocking from locked into spendable)
   * change which pocket holds the money without changing the total. Passing
   * the sums here records the movement truthfully while keeping `amount` at 0,
   * so the money is not counted twice in any total. See lib/bonuses/engine.ts.
   */
  bonusDelta?: Prisma.Decimal | number | string | null;
  lockedDelta?: Prisma.Decimal | number | string | null;
}

function dec(v: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(v ?? 0);
}

/**
 * Move a player's money and record it, atomically.
 *
 * Returns the created ledger row (its id is worth storing on the caller's own
 * record so a provider transaction and its ledger entry can be walked in both
 * directions).
 */
export async function applyWalletMovement(input: WalletMovementInput) {
  const { tx, userId } = input;
  const amount = dec(input.amount);
  const bonusDelta = dec(input.bonusDelta);
  const lockedDelta = dec(input.lockedDelta);

  // Read inside the transaction so a concurrent movement cannot make the
  // recorded "before" disagree with what was actually applied.
  const existing = await tx.wallet.findUnique({ where: { userId } });

  const balanceBefore = dec(existing?.balance);
  const bonusBefore = dec(existing?.bonusBalance);
  const lockedBefore = dec(existing?.lockedBalance);

  const balanceAfter = balanceBefore.add(amount);
  const bonusAfter = bonusBefore.add(bonusDelta);
  const lockedAfter = lockedBefore.add(lockedDelta);

  if (existing) {
    await tx.wallet.update({
      where: { userId },
      data: {
        ...(amount.isZero() ? {} : { balance: { increment: amount } }),
        ...(bonusDelta.isZero() ? {} : { bonusBalance: { increment: bonusDelta } }),
        ...(lockedDelta.isZero() ? {} : { lockedBalance: { increment: lockedDelta } }),
      },
    });
  } else {
    await tx.wallet.create({
      data: {
        userId,
        balance: balanceAfter,
        bonusBalance: bonusAfter,
        lockedBalance: lockedAfter,
      },
    });
  }

  return tx.walletLedger.create({
    data: {
      userId,
      type: input.type,
      // A pocket-to-pocket move is neither: label by which pocket gained.
      direction: amount.isNegative() ? 'debit' : 'credit',
      amount,
      balanceBefore,
      balanceAfter,
      bonusBefore,
      bonusAfter,
      lockedBefore,
      lockedAfter,
      status: input.status ?? 'completed',
      transactionId: input.transactionId ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      providerName: input.providerName ?? null,
      gameUid: input.gameUid ?? null,
      gameName: input.gameName ?? null,
      betId: input.betId ?? null,
      roundId: input.roundId ?? null,
      referenceId: input.referenceId ?? null,
      bonusSource: input.bonusSource ?? null,
      description: input.description ?? null,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      reversesId: input.reversesId ?? null,
      meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Correct a previous movement WITHOUT touching it.
 *
 * The original row stays exactly as written - that is the whole point of an
 * audit trail, and the client asked for it explicitly. This writes an opposing
 * movement that points back at the original via reversesId.
 */
export async function reverseWalletMovement(opts: {
  tx: Tx;
  ledgerId: string;
  reason: string;
  actorId?: string | null;
  actorRole?: string | null;
}) {
  const original = await opts.tx.walletLedger.findUnique({ where: { id: opts.ledgerId } });
  if (!original) throw new Error('LEDGER_ENTRY_NOT_FOUND');

  return applyWalletMovement({
    tx: opts.tx,
    userId: original.userId,
    amount: new Prisma.Decimal(original.amount).neg(),
    bonusDelta: new Prisma.Decimal(original.bonusAfter).sub(new Prisma.Decimal(original.bonusBefore)).neg(),
    lockedDelta: new Prisma.Decimal(original.lockedAfter).sub(new Prisma.Decimal(original.lockedBefore)).neg(),
    type: LEDGER_TYPE.reversal,
    description: opts.reason,
    reversesId: original.id,
    referenceId: original.referenceId,
    actorId: opts.actorId ?? null,
    actorRole: opts.actorRole ?? null,
    meta: { reversedType: original.type } as Prisma.JsonObject,
  });
}
