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
import { previewDepositPromotion } from '@/lib/promotions/deposit';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get('amount') ?? '0';
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ ok: true, amount: 0, tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: 0 });
    }
    const promotionId = url.searchParams.get('promotionId');
    const selected = promotionId ? await previewDepositPromotion(promotionId, amount) : null;
    const tierPreview = selected ? null : await pickBestTier(amount);
    const preview = selected ?? tierPreview;
    if (!preview) throw new Error('No preview result');
    return NextResponse.json({
      ok: true,
      amount,
      tier: tierPreview?.tier ?? null,
      bonusPercentage: preview.bonusPercentage,
      bonusAmount: preview.bonusAmount,
      totalCredit: preview.totalCredit,
      promotionId: selected?.rule.id ?? null,
      promotionName: selected?.rule.name ?? null,
    });
  } catch (err) {
    console.error('[content/deposit-preview] preview failed', err);
    return NextResponse.json({ ok: true, amount: 0, tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: 0 });
  }
}
