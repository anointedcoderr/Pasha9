// Built by Anointed Coder.
//
// POST /api/admin/payments/chaopaopay/recheck/[depositId]
//
// Admin-triggered status pull. Calls ChaopaoPay's transaction/status.php
// for the deposit (by providerRef if we have it, otherwise by trx_id =
// Deposit.transactionId) and:
//
//   - If status is 'completed' AND the row is still pending, runs the
//     same ingestProviderEvent path the webhook uses so the wallet
//     gets credited and the ticket / bonus / commission engines fire.
//     This handles the case where ChaopaoPay's webhook delivery
//     failed but the player did pay.
//   - If status is 'failed' or 'cancelled', writes the reason to
//     adminNote so the operator can decide whether to reject or
//     manually approve.
//   - Otherwise just reports the current status without mutating
//     anything.
//
// Idempotent. Re-clicking the button after a successful credit hits
// the duplicate path in ingestProviderEvent and does not double-credit.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { checkChaopaoPayStatus, mapChaopaoPayStatus } from '@/lib/payments/chaopaopay-client';
import { ingestProviderEvent } from '@/lib/payments/service';

export async function POST(_req: NextRequest, { params }: { params: { depositId: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('deposits.review');

    const deposit = await db.deposit.findUnique({ where: { id: params.depositId } });
    if (!deposit) return jsonError(404, 'NOT_FOUND', 'Deposit not found.');
    if (deposit.providerKey !== 'chaopaopay') {
      return jsonError(409, 'WRONG_PROVIDER', 'This deposit was not initiated through ChaopaoPay.');
    }

    let result;
    try {
      result = await checkChaopaoPayStatus({
        transactionId: deposit.providerRef ?? undefined,
        trxId: deposit.providerRef ? undefined : deposit.transactionId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[chaopaopay/recheck] gateway error', err);
      return jsonError(502, 'GATEWAY_ERROR', msg);
    }

    const mappedStatus = mapChaopaoPayStatus(result.status);

    // If the gateway says completed and our deposit is still pending,
    // synthesise a ProviderEvent with signatureValid=true (we just
    // verified the source by calling the gateway directly with our
    // own credentials, which is a stronger guarantee than the webhook
    // signature) and run it through the same service layer.
    if (mappedStatus === 'success' && deposit.status === 'pending') {
      const ingest = await ingestProviderEvent('chaopaopay', {
        providerTxId: result.transactionId || deposit.providerRef || deposit.transactionId,
        amount: result.amount || Number(deposit.amount),
        currency: result.currency || 'BDT',
        status: 'success',
        reference: result.trxId || deposit.transactionId,
        signatureValid: true,
        rawPayload: result.raw,
        meta: {
          source: 'admin_recheck',
          rawStatus: result.status,
          completedAt: result.completedAt,
        },
      });
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'DEPOSIT_CHAOPAOPAY_RECHECK_CREDITED',
        target: deposit.id,
        meta: { ingest, gatewayStatus: result.status, providerTxId: result.transactionId },
      });
      return jsonOk({
        ok: true,
        gatewayStatus: result.status,
        mappedStatus,
        ingest,
        message: 'Deposit auto-credited from gateway status check.',
      });
    }

    // Just record the current status without mutating money state.
    const note = `ChaopaoPay status re-check: ${result.status}. amount=${result.amount} BDT. trx=${result.transactionId} ${result.completedAt ? `completedAt=${result.completedAt}` : ''}`.trim();
    await db.deposit.update({
      where: { id: deposit.id },
      data: {
        adminNote: note.slice(0, 1000),
        // If the gateway pinned a transaction_id we missed at create
        // time (e.g. payIn response was lost), backfill it here so
        // the next webhook can match.
        ...(deposit.providerRef ? {} : (result.transactionId ? { providerRef: result.transactionId } : {})),
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_CHAOPAOPAY_RECHECK',
      target: deposit.id,
      meta: {
        gatewayStatus: result.status,
        mappedStatus,
        providerTxId: result.transactionId,
      },
    });

    return jsonOk({
      ok: true,
      gatewayStatus: result.status,
      mappedStatus,
      providerTxId: result.transactionId,
      amount: result.amount,
      message: `Deposit status from gateway: ${result.status}.`,
    });
  });
}
