// Built by Anointed Coder.
//
// Admin GET + PATCH for the DepositRequiredModal content. Guarded
// by settings.write (super_admin bypass). Writes are upserts into
// SystemSetting so there is no schema change.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadDepositPromptSettings, saveDepositPromptSettings } from '@/lib/deposit-prompt/settings';

const patchSchema = z.object({
  titleEn: z.string().trim().min(1).max(80).optional(),
  titleBn: z.string().trim().min(1).max(80).optional(),
  messageEn: z.string().trim().min(1).max(400).optional(),
  messageBn: z.string().trim().min(1).max(400).optional(),
  ctaEn: z.string().trim().min(1).max(40).optional(),
  ctaBn: z.string().trim().min(1).max(40).optional(),
  bgType: z.enum(['gradient', 'image']).optional(),
  bgImageUrl: z.string().trim().max(500).optional().or(z.literal('')),
  bgImageEnabled: z.boolean().optional(),
  accent: z.enum(['gold', 'royal', 'red', 'emerald', 'sapphire']).optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const settings = await loadDepositPromptSettings();
    return jsonOk(settings);
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    await saveDepositPromptSettings(parsed.data);
    const after = await loadDepositPromptSettings();
    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_PROMPT_UPDATE',
      meta: { keys: Object.keys(parsed.data) },
    });
    return jsonOk(after);
  });
}
