// Built by Anointed Coder.
//
// M2F: lotto-balance withdrawal pipeline.
//
// The lotto wallet is a separate ledger (Wallet.lottoBalance). Two
// ways for the user to convert it into spendable funds:
//
//   1. Instant transfer to main wallet (this module)
//      - User picks an amount from /dashboard/wallet
//      - Engine decrements lottoBalance, increments balance,
//        writes a Transaction (type=adjust) and one for type=win
//        (the rebrand "win" makes the ledger easy to grep for)
//      - No admin review. Min 100 BDT, max = current lottoBalance.
//
//   2. Withdraw from main wallet via /withdraw (M2C pipeline)
//      - Once funds are transferred to main, the existing M2C
//        withdrawal flow handles the actual payout to bKash/Nagad/
//        Rocket / bank account.
//
// This split keeps the M2C admin queue simple: every payout request
// is identical regardless of where the funds came from. Lotto
// settlements and the lotto wallet remain a tidy reporting ledger.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';

export const MIN_LOTTO_TRANSFER = 100;

export interface TransferResult {
  amount: number;
  newLottoBalance: number;
  newMainBalance: number;
  transactionId: string;
}

export async function transferLottoToMain(userId: string, amount: number): Promise<TransferResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('AMOUNT_INVALID');
  }
  if (amount < MIN_LOTTO_TRANSFER) {
    throw new Error('BELOW_MIN');
  }

  return await db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error('WALLET_NOT_FOUND');

    const have = new Prisma.Decimal(wallet.lottoBalance);
    const ask = new Prisma.Decimal(amount);
    if (ask.gt(have)) throw new Error('INSUFFICIENT_LOTTO_BALANCE');

    const txRow = await tx.transaction.create({
      data: {
        userId,
        type: 'win',
        status: 'completed',
        amount: ask,
        description: 'Lotto wallet transfer to main balance',
        meta: { source: 'lotto_transfer' } as Prisma.JsonObject,
      },
    });

    // lottoBalance is a fourth pocket the ledger does not snapshot, so the
    // decrement stays here; the service records the spendable-balance side,
    // which is the part a player sees change.
    await tx.wallet.update({ where: { userId }, data: { lottoBalance: { decrement: ask } } });
    await applyWalletMovement({
      tx,
      userId,
      amount: ask,
      type: LEDGER_TYPE.lotto,
      description: 'Lotto wallet transfer to main balance',
      transactionId: txRow.id,
      meta: { source: 'lotto_transfer', lottoDebited: ask.toString() } as Prisma.JsonObject,
    });

    const updated = await tx.wallet.findUnique({ where: { userId }, select: { balance: true, lottoBalance: true } });
    return {
      amount: Number(ask),
      newLottoBalance: Number(updated?.lottoBalance ?? 0),
      newMainBalance: Number(updated?.balance ?? 0),
      transactionId: txRow.id,
    };
  });
}
