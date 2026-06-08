// Built by Anointed Coder.
//
// GET /api/admin/welcome-popup   read current values
// PUT /api/admin/welcome-popup   bulk upsert
//
// Stores the first-visit welcome popup config as SystemSetting rows
// so the operator can rebrand it (background image, title, body, CTA
// buttons, frequency) without a redeploy.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { KEYS } from '@/app/api/content/welcome-popup/route';

const optionalText = z.string().trim().max(600).optional().nullable();
const FREQS = ['every_visit', 'once_per_session', 'once_per_day', 'once_per_30_days'] as const;

const putSchema = z.object({
  enabled: z.boolean().optional(),
  imageOnly: z.boolean().optional(),
  frequency: z.enum(FREQS).optional(),
  imageUrl: optionalText,
  titleEn: optionalText,
  titleBn: optionalText,
  bodyEn: z.string().trim().max(2000).optional().nullable(),
  bodyBn: z.string().trim().max(2000).optional().nullable(),
  registerTextEn: optionalText,
  registerTextBn: optionalText,
  registerUrl: optionalText,
  loginTextEn: optionalText,
  loginTextBn: optionalText,
  loginUrl: optionalText,
  laterTextEn: optionalText,
  laterTextBn: optionalText,
});

const FIELD_TO_KEY: Record<string, (typeof KEYS)[number]> = {
  enabled: 'welcome_popup_enabled',
  imageOnly: 'welcome_popup_image_only',
  frequency: 'welcome_popup_frequency',
  imageUrl: 'welcome_popup_image_url',
  titleEn: 'welcome_popup_title_en',
  titleBn: 'welcome_popup_title_bn',
  bodyEn: 'welcome_popup_body_en',
  bodyBn: 'welcome_popup_body_bn',
  registerTextEn: 'welcome_popup_register_text_en',
  registerTextBn: 'welcome_popup_register_text_bn',
  registerUrl: 'welcome_popup_register_url',
  loginTextEn: 'welcome_popup_login_text_en',
  loginTextBn: 'welcome_popup_login_text_bn',
  loginUrl: 'welcome_popup_login_url',
  laterTextEn: 'welcome_popup_later_text_en',
  laterTextBn: 'welcome_popup_later_text_bn',
};

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const rows = await db.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;
    return jsonOk({ values: map });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const writes: Array<{ key: (typeof KEYS)[number]; value: string }> = [];
    for (const [field, raw] of Object.entries(parsed.data)) {
      const key = FIELD_TO_KEY[field];
      if (!key) continue;
      let value = '';
      if (typeof raw === 'boolean') value = raw ? '1' : '0';
      else if (typeof raw === 'string') value = raw;
      else if (raw == null) value = '';
      writes.push({ key, value });
    }

    await db.$transaction(
      writes.map((w) =>
        db.systemSetting.upsert({
          where: { key: w.key },
          create: { key: w.key, value: w.value },
          update: { value: w.value },
        }),
      ),
    );

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WELCOME_POPUP_UPDATE',
      target: 'welcome_popup',
      meta: { keys: writes.length },
    });

    return jsonOk({ ok: true });
  });
}
