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
import { previewBestEligibleBonus } from '@/lib/bonuses/engine';
import { previewDepositPromotion } from '@/lib/promotions/deposit';
import { getOrRefreshSessionClaims } from '@/lib/auth/session';

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

    // When the player is logged in (and no explicit promotion is
    // selected) preview the bonus the engine would actually grant THIS
    // user: previewBestEligibleBonus runs the same first-deposit,
    // claim-limit and rolling-window checks, so a user who already
    // claimed their welcome / weekly reload sees the real (possibly
    // zero) bonus instead of the optimistic public tier figure. Guests
    // keep the public pickBestTier preview. Best-effort: any failure
    // reading the session falls back to the public preview.
    let claims = null;
    if (!selected) {
      try {
        claims = await getOrRefreshSessionClaims();
      } catch {
        claims = null;
      }
    }

    if (claims?.sub && !selected) {
      const userPreview = await previewBestEligibleBonus(claims.sub, amount);
      return NextResponse.json({
        ok: true,
        amount,
        tier: null,
        bonusPercentage: userPreview.bonusPercentage,
        bonusAmount: userPreview.bonusAmount,
        totalCredit: userPreview.totalCredit,
        promotionId: null,
        promotionName: null,
      });
    }

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
