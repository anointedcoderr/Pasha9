// Built by Anointed Coder.
//
// GET /api/admin/m4/health
//
// Read-only health check for the M4 launch-readiness models. Returns
// row counts per new table so the operator can confirm Phase A landed
// cleanly on the VPS. Phases B-G will replace this with full CRUD
// endpoints per surface.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');

    const [
      sections,
      featured,
      notices,
      tiers,
      uploadConstraints,
      ambassadors,
      sponsors,
      publicPaymentMethods,
      referralBalances,
      referralClaims,
      promotionClaims,
    ] = await Promise.all([
      db.publicSection.count(),
      db.homepageFeaturedGame.count(),
      db.depositNotice.count(),
      db.depositBonusTier.count(),
      db.uploadConstraint.count(),
      db.brandAmbassador.count(),
      db.sponsor.count(),
      db.publicPaymentMethod.count(),
      db.referralBalance.count(),
      db.referralClaim.count(),
      db.promotionClaim.count(),
    ]);

    return jsonOk({
      tables: {
        PublicSection: sections,
        HomepageFeaturedGame: featured,
        DepositNotice: notices,
        DepositBonusTier: tiers,
        UploadConstraint: uploadConstraints,
        BrandAmbassador: ambassadors,
        Sponsor: sponsors,
        PublicPaymentMethod: publicPaymentMethods,
        ReferralBalance: referralBalances,
        ReferralClaim: referralClaims,
        PromotionClaim: promotionClaims,
      },
      phaseAComplete: sections > 0 && uploadConstraints > 0 && publicPaymentMethods > 0,
    });
  });
}
