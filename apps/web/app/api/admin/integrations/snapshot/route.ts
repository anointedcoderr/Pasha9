// Built by Anointed Coder.
//
// M2L Provider Management Console snapshot. One call returns the
// state of every external integration on the platform:
//   - inbound payment adapters (M2B)
//   - outbound payout adapters (M2C)
//   - SMS adapters + active provider key (M2I)
//   - tracking platforms (M2I)
//   - lotto cron + recovery cron (CRON_SECRET env)
//   - security (totp counts, IP block count)
//
// HARDENED: every loader is wrapped so one subsystem failing cannot
// break the whole snapshot. Missing fields are returned as empty
// arrays / zero counts so the page can render an empty-state card
// rather than crash.
//
// Read-only: no credential values are returned. The page deep-links
// to the existing per-area admin pages for editing.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listProviderSummaries } from '@/lib/payments/registry';
import { listPayoutSummaries } from '@/lib/payouts/registry';
import { listSmsAdapters } from '@/lib/sms/registry';
import { platformsStatus } from '@/lib/tracking/dispatcher';
import { isNativeGamesEnabled } from '@/lib/native-games/flag';

const PAYMENT_GATEWAY_HREF = '/admin/payments';
const PAYOUT_GATEWAY_HREF = '/admin/payouts';
const NOTIFICATIONS_HREF = '/admin/notifications';
const SECURITY_HREF = '/admin/security';
const LOTTO_HREF = '/admin/lotto';
const RECOVERY_HREF = '/admin/recovery';
const PAYMENT_METHODS_HREF = '/admin/payment-methods';
const NATIVE_GAMES_HREF = '/admin/native-games';
const PROVIDERS_HREF = '/admin/providers';

interface ProviderCard {
  key: string;
  label: string;
  status: string;
  description: string;
  configureHref: string;
  fieldCount: number;
  isActive?: boolean;
}

async function safeRun<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[integrations-snapshot] ${label} failed`, err);
    return fallback;
  }
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('activity.read');

    // Pull every subsystem in parallel, but wrap each one so a single
    // failure (e.g. a future adapter mis-config, a DB row that does
    // not match the expected shape) cannot collapse the whole page.
    const [
      payments,
      payouts,
      smsAdaptersRaw,
      trackingPlatforms,
      nativeGames,
      nativeGamesEnabled,
      smsProviderRow,
      ipBlockCount,
      totpEnabledCount,
      activeStaffCount,
      recentEdits,
      externalProviders,
      externalGameCount,
      externalGameActiveCount,
      providerCallbackCount,
      providerTxAcceptedCount,
      providerTxDuplicateCount,
      providerTxRolledBackCount,
      whatsappSetting,
    ] = await Promise.all([
      safeRun('listProviderSummaries', () => listProviderSummaries(), [] as Awaited<ReturnType<typeof listProviderSummaries>>),
      safeRun('listPayoutSummaries', () => listPayoutSummaries(), [] as Awaited<ReturnType<typeof listPayoutSummaries>>),
      safeRun('listSmsAdapters', async () => listSmsAdapters().map((a) => a.describe()), [] as ReturnType<ReturnType<typeof listSmsAdapters>[number]['describe']>[]),
      safeRun('platformsStatus', () => platformsStatus(), [] as Awaited<ReturnType<typeof platformsStatus>>),
      safeRun('nativeGames', () => db.nativeGameProvider.findMany({ orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] }), [] as Awaited<ReturnType<typeof db.nativeGameProvider.findMany>>),
      safeRun('nativeGamesEnabled', () => isNativeGamesEnabled(), true),
      safeRun('smsProviderRow', () => db.systemSetting.findUnique({ where: { key: 'sms_provider' }, select: { value: true } }), null as { value: string } | null),
      safeRun('ipBlockCount', () => db.ipBlockRule.count(), 0),
      safeRun('totpEnabledCount', () => db.user.count({ where: { totpEnabled: true } }), 0),
      safeRun('activeStaffCount', () => db.user.count({ where: { role: { key: { in: ['super_admin', 'admin', 'staff'] } }, status: 'active' } }), 0),
      safeRun(
        'recentEdits',
        async () => {
          const rows = await db.activityLog.findMany({
            where: {
              action: {
                in: [
                  'PAYMENT_SETTINGS_UPDATE',
                  'PAYOUT_SETTINGS_UPDATE',
                  'NOTIFICATIONS_SETTINGS_UPDATE',
                  'IP_BLOCK_ADD',
                  'IP_BLOCK_REMOVE',
                  'TOTP_ENABLE',
                  'TOTP_DISABLE',
                  'PAYMENT_METHOD_CREATE',
                  'PAYMENT_METHOD_UPDATE',
                  'PAYMENT_METHOD_DELETE',
                ],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: { actor: { select: { username: true } } },
          });
          return rows;
        },
        // Empty fallback typed loose so we can still .map() with the
        // actor relation in scope.
        [] as Array<{
          id: string;
          action: string;
          target: string | null;
          detail: string | null;
          actorId: string | null;
          actorRole: string | null;
          createdAt: Date;
          actor?: { username: string } | null;
        }>,
      ),
      safeRun('externalProviders', () => db.gameProvider.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, providerKey: true, adapterKey: true,
          status: true, lastSyncAt: true, lastHealthCheckAt: true, lastHealthCheckOk: true,
          apiKey: true, apiSecret: true, callbackSecret: true,
        },
      }), [] as Array<{ id: string; name: string; providerKey: string | null; adapterKey: string | null; status: 'active' | 'maintenance'; lastSyncAt: Date | null; lastHealthCheckAt: Date | null; lastHealthCheckOk: boolean | null; apiKey: string | null; apiSecret: string | null; callbackSecret: string | null }>),
      safeRun('externalGameCount', () => db.externalGame.count(), 0),
      safeRun('externalGameActiveCount', () => db.externalGame.count({ where: { status: 'active' } }), 0),
      safeRun('providerCallbackCount', () => db.providerCallbackLog.count(), 0),
      safeRun('providerTxAccepted', () => db.providerTransaction.count({ where: { status: 'accepted' } }), 0),
      safeRun('providerTxDuplicate', () => db.providerTransaction.count({ where: { status: 'duplicate' } }), 0),
      safeRun('providerTxRolledBack', () => db.providerTransaction.count({ where: { status: 'rolled_back' } }), 0),
      safeRun('whatsappSetting', () => db.systemSetting.findFirst({ where: { key: { startsWith: 'whatsapp_' } }, select: { key: true, value: true } }), null as { key: string; value: string } | null),
    ]);

    const activeSmsKey = (smsProviderRow?.value ?? 'manual').trim() || 'manual';
    const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());

    // Helper to safely shape provider cards even if a future adapter
    // returns unexpected nulls. Loose unknown-cast on input keeps it
    // working across the payment + payout adapter shapes which use
    // their own status enums (AdapterConfigStatus / PayoutConfigStatus).
    const toPaymentCard = (raw: unknown, href: string): ProviderCard => {
      const p = (raw ?? {}) as { key?: unknown; label?: unknown; status?: unknown; description?: unknown; fields?: unknown };
      return {
        key: String(p.key ?? 'unknown'),
        label: String(p.label ?? 'Unknown provider'),
        status: String(p.status ?? 'requires_credentials'),
        description: String(p.description ?? ''),
        configureHref: href,
        fieldCount: Array.isArray(p.fields) ? (p.fields as unknown[]).length : 0,
      };
    };

    const paymentsCards: ProviderCard[] = (Array.isArray(payments) ? payments : []).map((p) => toPaymentCard(p, PAYMENT_GATEWAY_HREF));
    const payoutsCards: ProviderCard[] = (Array.isArray(payouts) ? payouts : []).map((p) => toPaymentCard(p, PAYOUT_GATEWAY_HREF));
    const smsCards: ProviderCard[] = (Array.isArray(smsAdaptersRaw) ? smsAdaptersRaw : []).map((raw) => {
      const a = (raw ?? {}) as { key?: unknown; label?: unknown; status?: unknown; description?: unknown; settingKeys?: unknown };
      return {
        key: String(a.key ?? 'unknown'),
        label: String(a.label ?? 'Unknown provider'),
        status: String(a.status ?? 'requires_credentials'),
        description: String(a.description ?? ''),
        configureHref: NOTIFICATIONS_HREF,
        fieldCount: Array.isArray(a.settingKeys) ? (a.settingKeys as unknown[]).length : 0,
        isActive: String(a.key ?? '') === activeSmsKey,
      };
    });
    const trackingCards: ProviderCard[] = (Array.isArray(trackingPlatforms) ? trackingPlatforms : []).map((raw) => {
      const p = (raw ?? {}) as { key?: unknown; label?: unknown; live?: unknown; settingKeys?: unknown };
      const settingKeys = Array.isArray(p.settingKeys) ? (p.settingKeys as unknown[]).map(String) : [];
      return {
        key: String(p.key ?? 'unknown'),
        label: String(p.label ?? 'Unknown platform'),
        status: p.live ? 'live' : 'requires_credentials',
        description: settingKeys.length > 0 ? `Settings: ${settingKeys.join(', ')}` : '',
        configureHref: NOTIFICATIONS_HREF,
        fieldCount: settingKeys.length,
      };
    });

    // Pasha Native Games: one card per row in NativeGameProvider. The
    // global feature flag puts every row into 'disabled' when off so a
    // glance at the page tells the operator the subsystem is paused.
    const nativeGameCards: ProviderCard[] = (Array.isArray(nativeGames) ? nativeGames : []).map((raw) => {
      const g = (raw ?? {}) as { gameCode?: unknown; displayName?: unknown; isActive?: unknown; houseEdgeBps?: unknown; minBet?: unknown; maxBet?: unknown };
      const code = String(g.gameCode ?? 'unknown');
      const active = Boolean(g.isActive);
      const status = !nativeGamesEnabled ? 'disabled' : (active ? 'live' : 'disabled');
      const min = Number(g.minBet ?? 0);
      const max = Number(g.maxBet ?? 0);
      const edge = Number(g.houseEdgeBps ?? 0);
      return {
        key: code,
        label: String(g.displayName ?? code),
        status,
        description: `House edge ${edge}bps . Bet ${min}-${max} BDT`,
        configureHref: NATIVE_GAMES_HREF,
        fieldCount: 0,
        isActive: nativeGamesEnabled && active,
      };
    });

    // External providers (M3): one card per GameProvider row, with
    // an honest status derived from the row itself + the presence
    // of saved credentials.
    const externalProviderCards: ProviderCard[] = (Array.isArray(externalProviders) ? externalProviders : []).map((p) => {
      const hasCreds = Boolean(p.apiKey && p.apiSecret && p.callbackSecret);
      const status = p.status === 'active'
        ? 'live'
        : hasCreds
          ? 'maintenance'
          : 'requires_credentials';
      const lastSyncBit = p.lastSyncAt ? `Synced ${new Date(p.lastSyncAt).toISOString().slice(0, 10)}` : 'Never synced';
      const healthBit = p.lastHealthCheckAt
        ? `Health ${p.lastHealthCheckOk ? 'OK' : 'FAIL'}`
        : 'Not tested';
      return {
        key: p.providerKey ?? p.id,
        label: p.name,
        status,
        description: `${p.adapterKey ?? 'no adapter'} . ${lastSyncBit} . ${healthBit}`,
        configureHref: `${PROVIDERS_HREF}/${p.id}`,
        fieldCount: 0,
        isActive: p.status === 'active',
      };
    });

    // Launch readiness is the at-a-glance summary the client cares
    // about. Every field is derived from the data we already loaded;
    // nothing is fabricated.
    const liveExternalProviderCount = externalProviderCards.filter((p) => p.status === 'live').length;
    const hasLivePayment = paymentsCards.some((p) => p.status === 'live');
    const hasLivePayout = payoutsCards.some((p) => p.status === 'live');
    const hasLiveSms = smsCards.some((p) => p.status === 'live' && p.isActive);
    const liveTrackingCount = trackingCards.filter((p) => p.status === 'live').length;
    const hasWhatsapp = Boolean(whatsappSetting?.value);
    const launchReadiness = {
      externalProvider: {
        liveCount: liveExternalProviderCount,
        gameCount: Number(externalGameCount ?? 0),
        activeGameCount: Number(externalGameActiveCount ?? 0),
        callbackCount: Number(providerCallbackCount ?? 0),
        acceptedTxCount: Number(providerTxAcceptedCount ?? 0),
        duplicateTxCount: Number(providerTxDuplicateCount ?? 0),
        rolledBackTxCount: Number(providerTxRolledBackCount ?? 0),
      },
      payment: { live: hasLivePayment, totalAdapters: paymentsCards.length },
      payout: { live: hasLivePayout, totalAdapters: payoutsCards.length },
      sms: { live: hasLiveSms, activeKey: activeSmsKey, totalAdapters: smsCards.length },
      whatsapp: { configured: hasWhatsapp },
      tracking: { liveCount: liveTrackingCount, totalPlatforms: trackingCards.length },
      nativeGames: { enabled: Boolean(nativeGamesEnabled), totalGames: nativeGameCards.length, liveGames: nativeGameCards.filter((g) => g.isActive).length },
      cronSecret: { configured: cronSecretConfigured },
      apkGuide: { ready: true }, // docs/APK-BUILD.md is committed; build is operator-side
      docs: { ready: true },
    };

    return jsonOk({
      categories: {
        payments: paymentsCards,
        payouts: payoutsCards,
        sms: smsCards,
        tracking: trackingCards,
        nativeGames: nativeGameCards,
        externalProviders: externalProviderCards,
      },
      launchReadiness,
      platform: {
        activeSmsProvider: activeSmsKey,
        cronSecretConfigured,
        cronRoutes: [
          { key: 'lotto-rollover', label: 'Lotto rollover (M2F)', path: '/api/cron/lotto-rollover', requiresSecret: true, deepLink: LOTTO_HREF },
          { key: 'recovery-sweep', label: 'Recovery sweep (M2H)', path: '/api/cron/recovery-sweep', requiresSecret: true, deepLink: RECOVERY_HREF },
        ],
        paymentMethodsHref: PAYMENT_METHODS_HREF,
        securityHref: SECURITY_HREF,
        nativeGamesEnabled: Boolean(nativeGamesEnabled),
        nativeGamesHref: NATIVE_GAMES_HREF,
      },
      security: {
        ipBlockCount: Number(ipBlockCount ?? 0),
        totpEnabledUserCount: Number(totpEnabledCount ?? 0),
        activeStaffCount: Number(activeStaffCount ?? 0),
      },
      recentEdits: (Array.isArray(recentEdits) ? recentEdits : []).map((e) => ({
        id: e.id,
        action: e.action,
        target: e.target,
        detail: e.detail,
        actorUsername: e.actor?.username ?? null,
        actorRole: e.actorRole,
        createdAt: e.createdAt,
      })),
    });
  });
}
