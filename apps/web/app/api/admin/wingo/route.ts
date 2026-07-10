// Built by Anointed Coder.
//
// Admin config + overview for Pasha WinGo. Mirrors the native-games admin
// contract: GET returns the current settings plus a per-mode audit
// summary; PATCH edits the settings (global on/off, per-mode on/off,
// min/max stake). Gating and permissions match the native-games admin:
//   - GET  requires users.read (anyone who can view the back office)
//   - PATCH requires settings.write (the same perm native-games PATCH uses)
//
// The game ships DISABLED by default (the wingo_enabled SystemSetting
// defaults to 'false' in flag.ts), so this surface is the only way to
// turn it on. No money logic lives here; settlement is the engine's job.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { getWingoAdminOverview } from '@/lib/wingo/admin';
import {
  loadWingoSettings,
  setWingoEnabled,
  setWingoModeEnabled,
  setWingoStakeLimits,
  setWingoPaytable,
  setWingoHomepageImage,
  WINGO_PAYOUT_MAX,
} from '@/lib/wingo/flag';
import { isWingoMode, type WingoMode } from '@/lib/wingo/config';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const overview = await getWingoAdminOverview();
    return jsonOk(overview);
  });
}

const modeFlagsSchema = z.record(z.string(), z.boolean());

// Every payout field: finite, >= 0, <= the payout ceiling. Values below 1
// are allowed so the operator can set house-favorable rates (a total-return
// multiplier under 1 pays a winner less than their stake; 0 pays nothing).
// The setter clamps again on write so a value that slips through lands safe.
const payoutField = z.number().finite().min(0).max(WINGO_PAYOUT_MAX);
const paytableSchema = z.object({
  colorGreen: payoutField,
  colorRed: payoutField,
  colorViolet: payoutField,
  colorHalf: payoutField,
  number: payoutField,
  big: payoutField,
  small: payoutField,
});

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  // Map of wingo mode -> enabled. Only known modes are applied.
  modes: modeFlagsSchema.optional(),
  minStake: z.coerce.number().positive().max(100_000).optional(),
  maxStake: z.coerce.number().positive().max(100_000).optional(),
  // Admin-editable payout multipliers (all fields required together).
  paytable: paytableSchema.optional(),
  // Homepage card image URL (an /uploads path or absolute URL), or null to
  // clear it and fall back to generated art.
  homepageImageUrl: z.string().trim().max(2048).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const before = await loadWingoSettings();

    // Validate stake bounds together before writing either. clampMin /
    // clampMax in flag.ts keep them inside the engine's hard limits, but
    // reject an inverted pair up front so the operator gets a clear error.
    if (parsed.data.minStake !== undefined || parsed.data.maxStake !== undefined) {
      const nextMin = parsed.data.minStake ?? before.minStake;
      const nextMax = parsed.data.maxStake ?? before.maxStake;
      if (nextMax < nextMin) {
        return jsonError(400, 'MAX_LESS_THAN_MIN', 'Maximum stake must be greater than or equal to the minimum.');
      }
      await setWingoStakeLimits(nextMin, nextMax);
    }

    if (parsed.data.enabled !== undefined) {
      await setWingoEnabled(parsed.data.enabled);
    }

    if (parsed.data.modes) {
      for (const [mode, on] of Object.entries(parsed.data.modes)) {
        if (isWingoMode(mode)) {
          await setWingoModeEnabled(mode as WingoMode, on);
        }
      }
    }

    if (parsed.data.paytable) {
      await setWingoPaytable(parsed.data.paytable);
    }

    if (parsed.data.homepageImageUrl !== undefined) {
      await setWingoHomepageImage(parsed.data.homepageImageUrl);
    }

    const after = await loadWingoSettings();

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'WINGO_CONFIG_UPDATE',
      target: 'wingo',
      meta: {
        before: {
          enabled: before.enabled,
          modes: before.modes,
          minStake: before.minStake,
          maxStake: before.maxStake,
          paytable: before.paytable,
          homepageImageUrl: before.homepageImageUrl,
        },
        after: {
          enabled: after.enabled,
          modes: after.modes,
          minStake: after.minStake,
          maxStake: after.maxStake,
          paytable: after.paytable,
          homepageImageUrl: after.homepageImageUrl,
        },
      },
    });

    const overview = await getWingoAdminOverview();
    return jsonOk(overview);
  });
}
