// Built by Anointed Coder.
//
// Dry-run the commission engine for a (userId, amount) pair. Same
// observability pattern as /api/admin/bonus-grants/diagnose - lets
// ops verify tier setup before approving real money.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { diagnoseAffiliate } from '@/lib/affiliate/engine';

const schema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().min(1).max(10_000_000),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('affiliate.read');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    try {
      const result = await diagnoseAffiliate(parsed.data.userId, parsed.data.amount);
      return jsonOk(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[affiliate-diagnose] failed', err);
      return jsonError(500, 'DIAGNOSE_FAILED', msg);
    }
  });
}

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('affiliate.read');
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId')?.trim();
    const amount = Number(url.searchParams.get('amount') ?? 1000);
    if (!userId) return jsonError(400, 'USER_REQUIRED');
    if (!Number.isFinite(amount) || amount <= 0) return jsonError(400, 'AMOUNT_INVALID');
    try {
      const result = await diagnoseAffiliate(userId, amount);
      return jsonOk(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[affiliate-diagnose] failed', err);
      return jsonError(500, 'DIAGNOSE_FAILED', msg);
    }
  });
}
