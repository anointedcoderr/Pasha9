// Built by Anointed Coder.
//
// StarPay async deposit callback (notify). StarPay requires a PLAIN-TEXT
// "SUCCESS" acknowledgement (not the JSON envelope the generic
// /api/payments/webhook/[provider] route returns), and it retries at
// ~30/60/90/120/150/180s until it gets one. So StarPay has its own
// callback route.
//
// Auth: the MD5 signature (verified in starpayAdapter.verifyWebhook using
// the merchant secret) is the authoritative gate - ingestProviderEvent
// only credits when signatureValid is true. The source IP is captured for
// audit but NOT hard-blocked: a signed callback is already authenticated,
// and hard IP filtering behind Cloudflare caused real callback outages on
// the game side. We return SUCCESS once the event is durably logged so
// StarPay stops retrying; a processing exception returns non-SUCCESS so it
// retries.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { starpayAdapter } from '@/lib/payments/starpay';
import { ingestProviderEvent } from '@/lib/payments/service';
import { recordActivity } from '@/lib/auth/guard';

function sourceIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    ''
  );
}

const OK = () => new Response('SUCCESS', { status: 200, headers: { 'content-type': 'text/plain' } });

export async function POST(req: NextRequest) {
  const ip = sourceIp(req);
  const rawBody = await req.text();

  let event = null;
  try {
    event = await starpayAdapter.verifyWebhook(req.headers, rawBody);
  } catch (err) {
    console.error('[starpay/callback] verifier threw', err);
  }

  try {
    if (!event) {
      // Unparseable / not our merchant. Log for support and still ack so
      // StarPay stops retrying a payload we cannot act on.
      let parsed: Prisma.InputJsonValue | undefined;
      try { parsed = JSON.parse(rawBody) as Prisma.InputJsonValue; } catch { parsed = rawBody as Prisma.InputJsonValue; }
      await db.paymentGatewayTx.create({
        data: {
          provider: 'starpay',
          status: 'signature_invalid',
          signatureValid: false,
          raw: parsed,
          note: `StarPay callback not verified (bad signature, foreign merchant, or malformed). ip=${ip}`,
          processedAt: new Date(),
        },
        select: { id: true },
      }).catch(() => undefined);
      return OK();
    }

    const eventWithIp = { ...event, meta: { ...(event.meta ?? {}), sourceIp: ip } };
    const result = await ingestProviderEvent('starpay', eventWithIp);

    if (result.status === 'credited' && result.depositId) {
      await recordActivity({
        actorId: 'system',
        actorRole: 'system',
        action: 'DEPOSIT_AUTO_CREDIT',
        target: result.depositId,
        detail: 'starpay',
        meta: { gatewayTxId: result.gatewayTxId, ticketsGenerated: result.ticketsGenerated, ip },
      }).catch(() => undefined);
    }

    // Durably logged/processed -> acknowledge so retries stop.
    return OK();
  } catch (err) {
    // Processing failed (DB down, etc). Return non-SUCCESS so StarPay
    // retries later rather than dropping a real payment.
    console.error('[starpay/callback] processing failed', err);
    return new Response('FAIL', { status: 500, headers: { 'content-type': 'text/plain' } });
  }
}
