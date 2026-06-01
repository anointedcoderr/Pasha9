// Built by Anointed Coder.
//
// GET  /api/admin/whatsapp/settings  ->  masked field map + status hint
// PATCH /api/admin/whatsapp/settings -> upsert SystemSetting rows;
//                                       access token + verify token
//                                       are AEAD-encrypted at rest.
//
// We do NOT ship a WhatsApp adapter today; this endpoint only persists
// the structured fields so the integrations tile can flip to
// "Configured" and so a future Cloud-API / gateway adapter has the
// values to load.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { encryptString, decryptString } from '@/lib/crypto/aead';
import { maskSecret } from '@/lib/providers/credentials';

const PUBLIC_KEYS = [
  'whatsapp_enabled',
  'whatsapp_provider_type',  // meta_cloud | gateway | manual
  'whatsapp_phone_number_id',
  'whatsapp_waba_id',
  'whatsapp_default_support_number',
] as const;

const SECRET_KEYS = [
  'whatsapp_access_token',
  'whatsapp_verify_token',
] as const;

const ALL_KEYS = [...PUBLIC_KEYS, ...SECRET_KEYS] as const;

const patchSchema = z.object({
  updates: z.array(z.object({
    key: z.enum(ALL_KEYS),
    value: z.string().max(4000),
  })).min(1).max(20),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');

    const rows = await db.systemSetting.findMany({
      where: { key: { in: [...ALL_KEYS] } },
      select: { key: true, value: true },
    });
    const out: Record<string, { value: string; masked?: { set: boolean; preview: string } }> = {};
    for (const k of ALL_KEYS) out[k] = { value: '' };
    for (const r of rows) {
      const isSecret = (SECRET_KEYS as readonly string[]).includes(r.key);
      if (isSecret) {
        // Stored encrypted; decrypt server-side, then mask for the wire.
        let plain = '';
        try { plain = r.value ? decryptString(r.value) : ''; } catch { plain = ''; }
        out[r.key] = { value: '', masked: maskSecret(plain) };
      } else {
        out[r.key] = { value: r.value ?? '' };
      }
    }
    return jsonOk({ settings: out });
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

    const changedKeys: string[] = [];
    for (const u of parsed.data.updates) {
      const value = u.value;
      const isSecret = (SECRET_KEYS as readonly string[]).includes(u.key);
      // Empty value on a secret means "keep current" - never overwrite a
      // stored credential with the empty string by mistake.
      if (isSecret && !value.trim()) continue;
      const persisted = isSecret ? encryptString(value) : value;
      await db.systemSetting.upsert({
        where: { key: u.key },
        create: { key: u.key, value: persisted, category: 'general' },
        update: { value: persisted },
      });
      changedKeys.push(u.key);
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'WHATSAPP_SETTINGS_UPDATE',
      meta: { keys: changedKeys.map((k) => ((SECRET_KEYS as readonly string[]).includes(k) ? `${k}:••••` : k)) },
    });

    return jsonOk({ updated: changedKeys.length });
  });
}
