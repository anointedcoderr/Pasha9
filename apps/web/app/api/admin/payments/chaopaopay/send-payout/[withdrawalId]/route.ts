// Built by Anointed Coder.
//
// POST /api/admin/payments/chaopaopay/send-payout/[withdrawalId]
//
// Admin clicks this to send an approved withdrawal out through
// ChaopaoPay. The endpoint:
//
//   1. Validates the withdrawal is approved AND not already in a
//      terminal payout state (paid / payout_initiated).
//   2. Maps the saved method ('bkash'/'nagad' or 'chaopaopay_bkash'
//      etc.) to the gateway's method_code 101 / 102.
//   3. Calls /payout/create.php with a fresh trx_id (WIT-<8 hex>),
//      account number/name, and the operator's withdraw password
//      (read from SystemSetting by the client function).
//   4. On success: marks Withdrawal.processingState='payout_initiated'
//      + stores providerKey='chaopaopay' + providerRef=<their txid>.
//      The actual flip to 'paid' happens when the payout webhook
//      arrives at /api/payouts/webhook/chaopaopay and ingestPayoutEvent
//      matches the row by providerRef.
//   5. Writes a WithdrawalEvent (kind='payout_initiated') for audit.
//
// Idempotent guard: re-clicking on a withdrawal already in
// payout_initiated / paid returns a no-op.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { createChaopaoPayOut, type ChaopaoPayMethod } from '@/lib/payments/chaopaopay-client';

function generatePayoutTrx(): string {
  return `WIT-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function resolveMethod(withdrawalMethod: string): ChaopaoPayMethod | null {
  const m = withdrawalMethod.toLowerCase();
  if (m === 'bkash' || m === 'chaopaopay_bkash') return 'bkash';
  if (m === 'nagad' || m === 'chaopaopay_nagad') return 'nagad';
  return null;
}

function originFromRequest(req: NextRequest): string {
  const cfg = process.env.PUBLIC_BASE_URL?.trim();
  if (cfg) return cfg.replace(/\/+$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? '';
  return host ? `${proto}://${host}` : '';
}

export async function POST(req: NextRequest, { params }: { params: { withdrawalId: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('withdrawals.review');

    const w = await db.withdrawal.findUnique({ where: { id: params.withdrawalId } });
    if (!w) return jsonError(404, 'NOT_FOUND');
    if (w.status !== 'approved') {
      return jsonError(409, 'NOT_APPROVED', 'Send Payout only applies to approved withdrawals.');
    }
    if (w.processingState === 'paid') {
      return jsonOk({ ok: true, alreadyPaid: true, withdrawal: w });
    }
    if (w.processingState === 'payout_initiated') {
      return jsonOk({
        ok: true,
        alreadyInitiated: true,
        message: 'Payout already initiated. Waiting for ChaopaoPay to confirm via webhook.',
        withdrawal: w,
      });
    }

    const method = resolveMethod(w.method);
    if (!method) {
      return jsonError(409, 'UNSUPPORTED_METHOD', `ChaopaoPay only supports bKash + Nagad. This withdrawal uses '${w.method}'.`);
    }

    const trxId = generatePayoutTrx();
    const origin = originFromRequest(req);
    const notifyUrl = `${origin}/api/payouts/webhook/chaopaopay`;

    let result;
    try {
      result = await createChaopaoPayOut({
        trxId,
        amount: Number(w.amount),
        method,
        accountNumber: w.accountNumber,
        accountName: w.accountName,
        notifyUrl,
        description: `Pasha 9 withdrawal ${w.id}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[chaopaopay/send-payout] gateway error', err);
      const code = msg.startsWith('CHAOPAOPAY_') ? msg.split(':')[0] : 'GATEWAY_ERROR';
      // Friendly mapping for the most common error
      const userMessage = msg.includes('INVALID_WITHDRAW_PASS')
        ? 'ChaopaoPay rejected the withdraw password. Confirm payment_chaopaopay_withdraw_password in /admin/payments matches the value ChaopaoPay shared.'
        : msg;
      // Audit the failed attempt so the operator can see what happened
      // even though no state moved.
      try {
        await db.withdrawalEvent.create({
          data: {
            withdrawalId: w.id,
            kind: 'payout_attempt_failed',
            actorId: session.sub,
            actorRole: session.role,
            note: userMessage.slice(0, 480),
            meta: { trxId, code },
          },
        });
      } catch { /* swallow audit failure */ }
      return jsonError(502, code, userMessage);
    }

    // Race-safe state transition - only flip from non-paid states.
    let updated;
    try {
      updated = await db.$transaction(async (tx) => {
        const r = await tx.withdrawal.updateMany({
          where: {
            id: w.id,
            status: 'approved',
            processingState: { notIn: ['paid', 'payout_initiated'] },
          },
          data: {
            processingState: 'payout_initiated',
            providerKey: 'chaopaopay',
            providerRef: result.transactionId,
          },
        });
        if (r.count === 0) throw new Error('STATE_RACE');
        const updatedRow = await tx.withdrawal.findUniqueOrThrow({ where: { id: w.id } });
        await tx.withdrawalEvent.create({
          data: {
            withdrawalId: w.id,
            kind: 'payout_initiated',
            actorId: session.sub,
            actorRole: session.role,
            note: `ChaopaoPay payout initiated. trx_id=${trxId}, providerTxId=${result.transactionId}, fee=${result.fee}, net=${result.netAmount}.`,
            meta: {
              providerKey: 'chaopaopay',
              providerRef: result.transactionId,
              trxId,
              fee: result.fee,
              netAmount: result.netAmount,
              method,
              gatewayStatus: result.status,
            },
          },
        });
        return updatedRow;
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'STATE_RACE') {
        const latest = await db.withdrawal.findUnique({ where: { id: w.id } });
        return jsonOk({ ok: true, alreadyInitiated: true, withdrawal: latest });
      }
      throw e;
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WITHDRAWAL_CHAOPAOPAY_INITIATED',
      target: w.id,
      meta: {
        trxId,
        providerTxId: result.transactionId,
        amount: Number(w.amount),
        method,
        fee: result.fee,
        netAmount: result.netAmount,
        gatewayStatus: result.status,
      },
    });

    return jsonOk({
      ok: true,
      withdrawal: updated,
      gateway: {
        trxId: result.trxId,
        providerTxId: result.transactionId,
        amount: result.amount,
        fee: result.fee,
        netAmount: result.netAmount,
        status: result.status,
        accountNumber: result.accountNumber,
      },
    });
  });
}
