// Built by Anointed Coder.
//
// M2L Provider Management Console. Single overview hub showing
// every external integration on the platform with a status chip,
// a Configure deep-link to the canonical admin page for that
// subsystem, and a one-click "handover CSV" export for client
// lock-down audits.
//
// HARDENED: every shape from the snapshot endpoint is defaulted to
// an empty array / zero / safe object before render. Missing
// categories surface an empty-state card instead of crashing the
// page. The snapshot endpoint itself wraps each subsystem in a
// safeRun so one provider misconfiguration cannot break the page.
//
// Categories (each is a card grid):
//   Inbound payments    (M2B)  -> /admin/payments
//   Outbound payouts    (M2C)  -> /admin/payouts
//   SMS                 (M2I)  -> /admin/notifications
//   Tracking            (M2I)  -> /admin/notifications
//   Cron                (M2F + M2H)
//   Security            (M2K)  -> /admin/security

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Plug, RefreshCw, Download, ArrowRight, Wallet, Send, Wifi, ShieldCheck, Clock, Copy, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ProviderCard {
  key: string;
  label: string;
  status: string;
  description: string;
  configureHref: string;
  fieldCount: number;
  isActive?: boolean;
}

interface CronRoute {
  key: string;
  label: string;
  path: string;
  requiresSecret: boolean;
  deepLink: string;
}

interface EditRow {
  id: string;
  action: string;
  target: string | null;
  detail: string | null;
  actorUsername: string | null;
  actorRole: string | null;
  createdAt: string;
}

interface Snapshot {
  categories?: {
    payments?: ProviderCard[];
    payouts?: ProviderCard[];
    sms?: ProviderCard[];
    tracking?: ProviderCard[];
    nativeGames?: ProviderCard[];
    externalProviders?: ProviderCard[];
  };
  platform?: {
    activeSmsProvider?: string;
    cronSecretConfigured?: boolean;
    cronRoutes?: CronRoute[];
    paymentMethodsHref?: string;
    securityHref?: string;
    nativeGamesEnabled?: boolean;
    nativeGamesHref?: string;
  };
  security?: {
    ipBlockCount?: number;
    totpEnabledUserCount?: number;
    activeStaffCount?: number;
  };
  launchReadiness?: {
    externalProvider?: { liveCount?: number; gameCount?: number; activeGameCount?: number; callbackCount?: number; acceptedTxCount?: number; duplicateTxCount?: number; rolledBackTxCount?: number };
    payment?: { live?: boolean; totalAdapters?: number };
    payout?: { live?: boolean; totalAdapters?: number };
    sms?: { live?: boolean; activeKey?: string; totalAdapters?: number };
    whatsapp?: { configured?: boolean };
    tracking?: { liveCount?: number; totalPlatforms?: number };
    nativeGames?: { enabled?: boolean; totalGames?: number; liveGames?: number };
    cronSecret?: { configured?: boolean };
    apkGuide?: { ready?: boolean };
    docs?: { ready?: boolean };
  };
  recentEdits?: EditRow[];
}

const EMPTY_SNAP = {
  categories: { payments: [] as ProviderCard[], payouts: [] as ProviderCard[], sms: [] as ProviderCard[], tracking: [] as ProviderCard[], nativeGames: [] as ProviderCard[], externalProviders: [] as ProviderCard[] },
  platform: {
    activeSmsProvider: 'manual',
    cronSecretConfigured: false,
    cronRoutes: [] as CronRoute[],
    paymentMethodsHref: '/admin/payment-methods',
    securityHref: '/admin/security',
    nativeGamesEnabled: true,
    nativeGamesHref: '/admin/native-games',
  },
  security: { ipBlockCount: 0, totpEnabledUserCount: 0, activeStaffCount: 0 },
  recentEdits: [] as EditRow[],
};

function statusTone(s: string): 'ok' | 'warn' | 'neutral' | 'danger' | 'info' {
  if (s === 'live') return 'ok';
  if (s === 'manual') return 'neutral';
  if (s === 'requires_credentials') return 'warn';
  if (s === 'maintenance') return 'warn';
  if (s === 'disabled') return 'danger';
  if (s === 'error') return 'danger';
  if (s === 'ready') return 'info';
  return 'neutral';
}

function statusLabel(s: string): string {
  if (s === 'live') return 'Live';
  if (s === 'manual') return 'Manual';
  if (s === 'requires_credentials') return 'Awaiting credentials';
  if (s === 'maintenance') return 'Maintenance';
  if (s === 'disabled') return 'Disabled';
  if (s === 'error') return 'Error';
  if (s === 'ready') return 'Provider-ready';
  return s || 'Unknown';
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function AdminIntegrationsPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/integrations/snapshot', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && (data.message || data.code)) || `HTTP ${res.status}`);
      setSnap((data && typeof data === 'object') ? (data as Snapshot) : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setSnap({});
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flashToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const copyCronCmd = async (path: string) => {
    const cmd = `curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your-host>${path}`;
    try {
      await navigator.clipboard.writeText(cmd);
      flashToast('Curl command copied. Replace <your-host> + paste into your crontab.');
    } catch {
      flashToast('Could not copy. Select the line manually.');
    }
  };

  // Defensive defaults: every shape access goes through these so a
  // partial response from the API cannot crash the render tree.
  const categories = snap?.categories ?? EMPTY_SNAP.categories;
  const platform = snap?.platform ?? EMPTY_SNAP.platform;
  const security = snap?.security ?? EMPTY_SNAP.security;
  const recentEdits = safeArray<EditRow>(snap?.recentEdits);
  const paymentsCards = safeArray<ProviderCard>(categories.payments);
  const payoutsCards = safeArray<ProviderCard>(categories.payouts);
  const smsCards = safeArray<ProviderCard>(categories.sms);
  const trackingCards = safeArray<ProviderCard>(categories.tracking);
  const nativeGameCards = safeArray<ProviderCard>(categories.nativeGames);
  const externalProviderCards = safeArray<ProviderCard>(categories.externalProviders);
  const cronRoutes = safeArray<CronRoute>(platform.cronRoutes);
  const nativeGamesEnabled = platform.nativeGamesEnabled !== false;
  const nativeGamesHref = platform.nativeGamesHref || '/admin/native-games';
  const readiness = snap?.launchReadiness ?? {};

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Every external provider in one place. Configure links lead to the per-area admin pages."
        icon={<Plug className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => { window.location.href = '/api/admin/integrations/export'; }}>
              Export CSV
            </Button>
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
              Reload
            </Button>
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <p className="text-sm text-ink-mid">Loading...</p>
      ) : (
        <>
          <LaunchReadinessPanel readiness={readiness} />

          <CategorySection
            title="External game providers"
            subtitle="Aggregator integrations like iGamingAPIs / JILI. Live status comes from GameProvider.status; Awaiting credentials means the row exists but token/secret/callback-secret are not all saved yet."
            icon={<Plug className="h-4 w-4 text-gold-300" />}
            providers={externalProviderCards}
            emptyHref="/admin/providers"
            emptyLabel="No external providers registered yet. Open External Providers to add iGamingAPIs / JILI or any future aggregator."
          />

          <CategorySection
            title="Inbound payments"
            subtitle="Deposit gateways. Active credentials are stored in SystemSetting and never returned by this snapshot."
            icon={<Wallet className="h-4 w-4 text-gold-300" />}
            providers={paymentsCards}
            emptyHref="/admin/payments"
            emptyLabel="No payment adapters loaded yet. Open Payment Providers to configure."
          />

          <CategorySection
            title="Outbound payouts"
            subtitle="Withdrawal gateways. Many providers reuse the deposit-side merchant credentials."
            icon={<Send className="h-4 w-4 text-gold-300" />}
            providers={payoutsCards}
            emptyHref="/admin/payouts"
            emptyLabel="No payout adapters loaded yet. Open Payout Providers to configure."
          />

          <CategorySection
            title="SMS"
            subtitle={`Active provider: ${platform.activeSmsProvider || 'manual'}. OTP, deposit + withdrawal notifications all route here.`}
            icon={<Wifi className="h-4 w-4 text-gold-300" />}
            providers={smsCards}
            emptyHref="/admin/notifications"
            emptyLabel="No SMS adapters loaded yet. Open Notifications to configure."
          />

          <CategorySection
            title="Tracking pixels"
            subtitle="Conversion events fan out to every platform with a configured id (browser pixel) + token (server-side CAPI / Events API)."
            icon={<Wifi className="h-4 w-4 text-gold-300" />}
            providers={trackingCards}
            emptyHref="/admin/notifications"
            emptyLabel="No tracking platforms loaded yet. Open Notifications to configure."
          />

          <CategorySection
            title="Native games"
            subtitle={`Pasha Native Games - in-house provably-fair titles. Global switch is ${nativeGamesEnabled ? 'ON' : 'OFF'}. Toggle individual games from the Native Games admin.`}
            icon={<Sparkles className="h-4 w-4 text-gold-300" />}
            providers={nativeGameCards}
            emptyHref={nativeGamesHref}
            emptyLabel="No native games loaded yet. Open Native Games admin to add one."
          />

          <Card padding="lg" className="mb-6">
            <CardHeader
              title="Scheduled jobs (cron)"
              subtitle={`CRON_SECRET environment variable is ${platform.cronSecretConfigured ? 'set' : 'NOT set'}. Without it, cron POSTs are rejected and the equivalent admin buttons must be clicked manually.`}
            />
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip tone={platform.cronSecretConfigured ? 'ok' : 'warn'}>
                CRON_SECRET {platform.cronSecretConfigured ? 'configured' : 'missing'}
              </Chip>
            </div>
            {cronRoutes.length === 0 ? (
              <p className="text-sm text-ink-mid">No scheduled jobs declared.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {cronRoutes.map((r) => (
                  <div key={r.key} className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                    <p className="text-sm font-semibold text-ink-hi">{r.label}</p>
                    <code className="mt-1 block break-all font-mono text-[11px] text-ink-mid">POST {r.path}</code>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" leftIcon={<Copy className="h-3.5 w-3.5" />} onClick={() => copyCronCmd(r.path)}>
                        Copy curl
                      </Button>
                      {r.deepLink ? (
                        <Link href={r.deepLink}>
                          <Button size="sm" variant="neon" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>Configure</Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!platform.cronSecretConfigured ? (
              <p className="mt-3 inline-flex items-start gap-2 text-xs text-signal-warn">
                <AlertCircle className="mt-0.5 h-3 w-3" />
                Set CRON_SECRET in your VPS .env to a long random value, then add the curl commands above to crontab.
              </p>
            ) : null}
          </Card>

          <Card padding="lg" className="mb-6">
            <CardHeader title="Security posture" subtitle="Read-only KPIs from M2K. Edit at /admin/security and /dashboard/security." />
            <div className="grid gap-3 md:grid-cols-3">
              <Kpi icon={<ShieldCheck className="h-4 w-4 text-signal-ok" />} label="2FA-enabled users" value={security.totpEnabledUserCount ?? 0} hint="Users with TOTP active. Push admins to enroll." />
              <Kpi icon={<Wifi className="h-4 w-4 text-signal-warn" />} label="IP blocks" value={security.ipBlockCount ?? 0} hint="Active IP block rules (expired ones auto-skip)." />
              <Kpi icon={<ShieldCheck className="h-4 w-4 text-ink-mid" />} label="Active staff" value={security.activeStaffCount ?? 0} hint="Non-blocked super_admin + admin + staff accounts." />
            </div>
            <div className="mt-4">
              <Link href={platform.securityHref || '/admin/security'}>
                <Button variant="neon" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>Open Security Center</Button>
              </Link>
            </div>
          </Card>

          <Card padding="lg" className="mb-6">
            <CardHeader
              title="Recent credential edits"
              subtitle="Last 30 admin actions that changed provider settings, payment methods, IP blocks, or 2FA state. Pulled live from ActivityLog."
              action={<Clock className="h-4 w-4 text-ink-mid" />}
            />
            {recentEdits.length === 0 ? (
              <p className="text-sm text-ink-mid">No credential edits on file yet.</p>
            ) : (
              <ul className="divide-y divide-neon/10">
                {recentEdits.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <Chip tone="info">{e.action}</Chip>
                    <span className="text-xs text-ink-lo">{e.createdAt ? new Date(e.createdAt).toLocaleString() : '-'}</span>
                    <span className="text-ink-mid">
                      {e.actorUsername ?? '(system)'} <span className="text-ink-lo">. {e.actorRole ?? '?'}</span>
                    </span>
                    {e.target ? <code className="font-mono text-xs text-ink-mid">{e.target}</code> : null}
                    {e.detail ? <span className="ml-auto max-w-md truncate text-xs text-ink-mid" title={e.detail}>{e.detail}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="md" className="mt-4">
            <p className="text-xs text-ink-mid">
              <span className="font-semibold text-ink-hi">No credentials are hardcoded.</span> Every provider key, token and secret is stored in the SystemSetting table and edited from the admin pages linked above. Rotating a credential on the VPS is a SystemSetting upsert; no rebuild required. The exception is CRON_SECRET which lives in .env so headless cron callers can authenticate without a session.
            </p>
          </Card>
        </>
      )}
    </>
  );
}

function CategorySection({ title, subtitle, icon, providers, emptyHref, emptyLabel }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  providers: ProviderCard[];
  emptyHref?: string;
  emptyLabel?: string;
}) {
  return (
    <Card padding="lg" className="mb-6">
      <CardHeader title={title} subtitle={subtitle} action={icon} />
      {providers.length === 0 ? (
        <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-4 text-sm text-ink-mid">
          {emptyLabel ?? 'Nothing here yet.'}
          {emptyHref ? (
            <>
              {' '}
              <Link href={emptyHref} className="text-gold-300 hover:underline">Open settings</Link>.
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => (
            <div key={p.key} className={cn('flex min-w-0 flex-col rounded-xl border p-3', p.isActive ? 'border-signal-ok/40 bg-signal-ok/5' : 'border-neon/10 bg-base-deep/40')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 max-w-full">
                  <p className="break-words text-sm font-semibold text-ink-hi">{p.label}</p>
                  <p className="mt-0.5 break-all font-mono text-[10px] uppercase tracking-wider text-ink-lo">{p.key}</p>
                </div>
                <Chip tone={statusTone(p.status)}>{statusLabel(p.status)}</Chip>
              </div>
              <p className="mt-2 break-words text-xs text-ink-mid line-clamp-3" title={p.description || ''}>{p.description || 'No description.'}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-ink-lo">{p.fieldCount} field{p.fieldCount === 1 ? '' : 's'}{p.isActive ? ' . active' : ''}</span>
                {p.configureHref ? (
                  <Link href={p.configureHref}>
                    <Button size="sm" variant="ghost" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>Configure</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface ReadinessTile {
  label: string;
  state: 'live' | 'ready' | 'pending' | 'configured' | 'missing';
  detail: string;
  href?: string;
}

function tileTone(state: ReadinessTile['state']): 'ok' | 'warn' | 'neutral' | 'danger' | 'info' {
  if (state === 'live') return 'ok';
  if (state === 'ready' || state === 'configured') return 'info';
  if (state === 'pending') return 'warn';
  if (state === 'missing') return 'danger';
  return 'neutral';
}

function tileLabel(state: ReadinessTile['state']): string {
  if (state === 'live') return 'Live';
  if (state === 'ready') return 'Provider-ready';
  if (state === 'pending') return 'Awaiting credentials';
  if (state === 'configured') return 'Configured';
  if (state === 'missing') return 'Needs configuration';
  return state;
}

function LaunchReadinessPanel({ readiness }: { readiness: NonNullable<Snapshot['launchReadiness']> }) {
  const ep = readiness.externalProvider ?? {};
  const epLive = (ep.liveCount ?? 0) > 0;
  const epGames = ep.gameCount ?? 0;
  const epCallbacks = ep.callbackCount ?? 0;
  const epAccepted = ep.acceptedTxCount ?? 0;
  const epDup = ep.duplicateTxCount ?? 0;

  const tiles: ReadinessTile[] = [
    {
      label: 'External game provider',
      state: epLive ? 'live' : (epGames > 0 ? 'ready' : 'pending'),
      detail: epLive
        ? `${ep.liveCount} live . ${epGames} games (${ep.activeGameCount ?? 0} active)`
        : (epGames > 0 ? `${epGames} games imported, provider in Maintenance` : 'No provider registered'),
      href: '/admin/providers',
    },
    {
      label: 'Provider callbacks + wallet',
      state: epAccepted > 0 ? 'live' : (epCallbacks > 0 ? 'configured' : 'pending'),
      detail: `${epCallbacks} callback${epCallbacks === 1 ? '' : 's'} . ${epAccepted} accepted . ${epDup} duplicate`,
      href: '/admin/providers',
    },
    {
      label: 'Payment gateway',
      state: readiness.payment?.live ? 'live' : (readiness.payment?.totalAdapters ? 'pending' : 'missing'),
      detail: readiness.payment?.live
        ? 'At least one gateway live'
        : `${readiness.payment?.totalAdapters ?? 0} adapter${readiness.payment?.totalAdapters === 1 ? '' : 's'} registered, none live yet`,
      href: '/admin/payments',
    },
    {
      label: 'Payout provider',
      state: readiness.payout?.live ? 'live' : (readiness.payout?.totalAdapters ? 'pending' : 'missing'),
      detail: readiness.payout?.live
        ? 'At least one payout adapter live'
        : `${readiness.payout?.totalAdapters ?? 0} adapter${readiness.payout?.totalAdapters === 1 ? '' : 's'} registered, none live yet`,
      href: '/admin/payouts',
    },
    {
      label: 'SMS / OTP',
      state: readiness.sms?.live ? 'live' : (readiness.sms?.activeKey && readiness.sms.activeKey !== 'manual' ? 'pending' : 'missing'),
      detail: readiness.sms?.live
        ? `Active: ${readiness.sms.activeKey}`
        : `Active key: ${readiness.sms?.activeKey ?? 'manual'} (no live adapter)`,
      href: '/admin/notifications',
    },
    {
      label: 'WhatsApp API',
      state: readiness.whatsapp?.configured ? 'configured' : 'pending',
      detail: readiness.whatsapp?.configured ? 'Setting present' : 'Not configured',
      href: '/admin/notifications',
    },
    {
      label: 'Tracking pixels',
      state: (readiness.tracking?.liveCount ?? 0) > 0 ? 'live' : 'pending',
      detail: `${readiness.tracking?.liveCount ?? 0} of ${readiness.tracking?.totalPlatforms ?? 0} platforms live`,
      href: '/admin/notifications',
    },
    {
      label: 'Native games',
      state: readiness.nativeGames?.enabled && (readiness.nativeGames?.liveGames ?? 0) > 0 ? 'live' : 'configured',
      detail: `${readiness.nativeGames?.liveGames ?? 0} live . ${readiness.nativeGames?.totalGames ?? 0} total . global ${readiness.nativeGames?.enabled ? 'ON' : 'OFF'}`,
      href: '/admin/native-games',
    },
    {
      label: 'Cron secret',
      state: readiness.cronSecret?.configured ? 'configured' : 'missing',
      detail: readiness.cronSecret?.configured ? 'CRON_SECRET env set' : 'CRON_SECRET env missing',
    },
    {
      label: 'APK build guide',
      state: readiness.apkGuide?.ready ? 'ready' : 'pending',
      detail: 'docs/APK-BUILD.md committed; signed APK is operator-side',
    },
  ];

  return (
    <Card padding="lg" className="mb-6 border-l-4 border-gold-400/60">
      <CardHeader
        title="Launch readiness"
        subtitle="At-a-glance view of every external surface. Live means a real connection is verified. Provider-ready / Awaiting credentials means the structure exists but real keys are not in place."
        action={<Sparkles className="h-4 w-4 text-gold-300" />}
      />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-semibold text-ink-hi">{t.label}</p>
              <Chip tone={tileTone(t.state)}>{tileLabel(t.state)}</Chip>
            </div>
            <p className="mt-1 break-words text-[11px] text-ink-mid">{t.detail}</p>
            {t.href ? (
              <div className="mt-2">
                <Link href={t.href} className="text-[11px] font-bold uppercase tracking-wider text-gold-300 hover:underline">
                  Configure <ArrowRight className="inline h-3 w-3" />
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs uppercase tracking-wider text-ink-lo">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold text-ink-hi">{Number(value || 0).toLocaleString()}</p>
      <p className="mt-1 text-[11px] text-ink-mid">{hint}</p>
    </div>
  );
}
