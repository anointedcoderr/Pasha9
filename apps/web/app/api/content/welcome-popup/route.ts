// Built by Anointed Coder.
//
// GET /api/content/welcome-popup
// Public read of the first-visit popup config (SystemSetting-backed).
// Empty values are normalised to null so the public component renders
// only what the operator actually configured. When the popup is
// disabled or unset, FirstVisitAuthPopup falls back to its bundled
// default copy so a fresh database still shows a useful welcome.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const KEYS = [
  'welcome_popup_enabled',
  'welcome_popup_image_url',
  'welcome_popup_image_only',
  'welcome_popup_title_en',
  'welcome_popup_title_bn',
  'welcome_popup_body_en',
  'welcome_popup_body_bn',
  'welcome_popup_register_text_en',
  'welcome_popup_register_text_bn',
  'welcome_popup_register_url',
  'welcome_popup_login_text_en',
  'welcome_popup_login_text_bn',
  'welcome_popup_login_url',
  'welcome_popup_later_text_en',
  'welcome_popup_later_text_bn',
  'welcome_popup_frequency',
] as const;

function get(map: Record<string, string>, key: string): string | null {
  const v = map[key];
  return v && v.trim() ? v.trim() : null;
}

export async function GET() {
  const rows = await db.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value) map[r.key] = r.value;

  const enabledRaw = map.welcome_popup_enabled?.trim().toLowerCase();
  const enabled = enabledRaw == null ? true : enabledRaw === '1' || enabledRaw === 'true' || enabledRaw === 'on';
  const imageOnlyRaw = map.welcome_popup_image_only?.trim().toLowerCase();
  const imageOnly = imageOnlyRaw === '1' || imageOnlyRaw === 'true' || imageOnlyRaw === 'on';
  const frequency = (() => {
    const v = map.welcome_popup_frequency?.trim().toLowerCase();
    if (v === 'every_visit' || v === 'once_per_session' || v === 'once_per_day' || v === 'once_per_30_days') return v;
    return 'once_per_30_days';
  })();

  return jsonOk({
    enabled,
    imageOnly,
    frequency,
    imageUrl: get(map, 'welcome_popup_image_url'),
    titleEn: get(map, 'welcome_popup_title_en'),
    titleBn: get(map, 'welcome_popup_title_bn'),
    bodyEn: get(map, 'welcome_popup_body_en'),
    bodyBn: get(map, 'welcome_popup_body_bn'),
    registerTextEn: get(map, 'welcome_popup_register_text_en'),
    registerTextBn: get(map, 'welcome_popup_register_text_bn'),
    registerUrl: get(map, 'welcome_popup_register_url'),
    loginTextEn: get(map, 'welcome_popup_login_text_en'),
    loginTextBn: get(map, 'welcome_popup_login_text_bn'),
    loginUrl: get(map, 'welcome_popup_login_url'),
    laterTextEn: get(map, 'welcome_popup_later_text_en'),
    laterTextBn: get(map, 'welcome_popup_later_text_bn'),
  });
}
