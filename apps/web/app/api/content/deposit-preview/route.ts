// Built by Anointed Coder.
//
// GET /api/content/deposit-preview?amount=10000
//
// Public deposit-bonus preview. The deposit form calls this when the
// player edits the amount so the form can show the matching tier
// percentage, bonus amount and total credit. Returns zeros when no
// active tier matches.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pickBestTier } from '@/lib/bonuses/deposit-tiers';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get('amount') ?? '0';
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ ok: true, amount: 0, tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: 0 });
    }
    const preview = await pickBestTier(amount);
    return NextResponse.json({
      ok: true,
      amount,
      tier: preview.tier,
      bonusPercentage: preview.bonusPercentage,
      bonusAmount: preview.bonusAmount,
      totalCredit: preview.totalCredit,
    });
  } catch (err) {
    console.error('[content/deposit-preview] preview failed', err);
    return NextResponse.json({ ok: true, amount: 0, tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: 0 });
  }
}
