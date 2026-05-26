// Built by Anointed Coder.
//
// M2I tracking dispatcher. fireEvent() is the single entry point
// every server-side caller uses. It:
//
//   1. Loads SystemSetting for every tracking key
//   2. Fans out to every enabled platform adapter in parallel
//   3. Records a TrackingEvent row with per-platform results so the
//      admin dashboard can verify what fired (or didn't)
//
// Never throws to the caller. Returns the per-platform breakdown so
// the calling endpoint can surface it in the API response if useful.

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { DispatchResult, PlatformAdapter, TrackingEventInput } from './types';
import { facebookAdapter } from './facebook';
import { tiktokAdapter } from './tiktok';
import { ga4Adapter } from './ga4';
import { googleAdsAdapter } from './google_ads';

const ADAPTERS: PlatformAdapter[] = [facebookAdapter, tiktokAdapter, ga4Adapter, googleAdsAdapter];

const ALL_SETTING_KEYS = Array.from(new Set(ADAPTERS.flatMap((a) => a.settingKeys)));

async function loadSettings(): Promise<Record<string, string>> {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: ALL_SETTING_KEYS } },
    select: { key: true, value: true },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value ?? '';
  return map;
}

export interface FireResult {
  ok: boolean;
  trackingEventId: string;
  results: DispatchResult[];
}

export async function fireEvent(input: TrackingEventInput): Promise<FireResult> {
  let settings: Record<string, string>;
  try {
    settings = await loadSettings();
  } catch (err) {
    console.error('[tracking] settings load failed', err);
    settings = {};
  }

  const results: DispatchResult[] = [];
  for (const adapter of ADAPTERS) {
    try {
      const r = await adapter.dispatch(input, settings);
      results.push(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[tracking] adapter threw', adapter.key, err);
      results.push({ platform: adapter.key, status: `error_THROW`, errorBody: msg.slice(0, 300) });
    }
  }

  let trackingEventId = '';
  try {
    const resultsMap: Record<string, string> = {};
    for (const r of results) {
      resultsMap[r.platform] = r.status + (r.ref ? `:${r.ref}` : '');
    }
    const row = await db.trackingEvent.create({
      data: {
        event: input.event,
        source: input.source ?? 'server',
        userId: input.userId ?? null,
        value: input.value != null ? input.value : null,
        currency: input.currency ?? 'BDT',
        reference: input.reference ?? null,
        payload: (input.payload ?? null) as Prisma.InputJsonValue,
        results: resultsMap as Prisma.InputJsonValue,
      },
    });
    trackingEventId = row.id;
  } catch (err) {
    console.error('[tracking] TrackingEvent log write failed', err);
  }

  const okAny = results.some((r) => r.status === 'ok');
  console.info('[tracking] fired', input.event, results.map((r) => `${r.platform}:${r.status}`).join(' '));
  return { ok: okAny, trackingEventId, results };
}

/**
 * Returns the per-platform live status. Used by the admin page so
 * the operator knows which platforms will actually fire.
 */
export async function platformsStatus(): Promise<Array<{ key: string; label: string; live: boolean; settingKeys: string[] }>> {
  const settings = await loadSettings();
  return ADAPTERS.map((a) => ({
    key: a.key,
    label: a.label,
    live: a.isLive(settings),
    settingKeys: a.settingKeys,
  }));
}
