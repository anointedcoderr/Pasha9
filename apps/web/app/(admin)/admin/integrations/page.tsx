// Built by Anointed Coder.
//
// M2L Provider Management Console. Single overview hub showing
// every external integration on the platform with a status chip,
// a Configure deep-link to the canonical admin page for that
// subsystem, and a one-click "handover CSV" export for client
// lock-down audits.
//
// Categories (each is a card grid):
//   Inbound payments    (M2B)  -> /admin/payments
//   Outbound payouts    (M2C)  -> /admin/payouts
//   SMS                 (M2I)  -> /admin/notifications
//   Tracking            (M2I)  -> /admin/notifications
//   Cron                (M2F + M2H)
//   Security            (M2K)  -> /admin/security
//
// Bottom panel shows the last 30 credential-edit activity rows so
// admins can audit who changed what.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Plug, RefreshCw, Download, ArrowRight, Wallet, Send, Wifi, ShieldCheck, Clock, Copy, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ProviderCard {
  key: string;
  label: string;
  status: 'live' | 'requires_credentials' | 'manual' | 'disabled';
  description: string;
  configureHref: string;
  fieldCount: number;
  isActive?: boolean;
}

interface Snapshot {
  categories: {
    payments: ProviderCard[];
    payouts: ProviderCard[];
    sms: ProviderCard[];
    tracking: ProviderCard[];
  };
  platform: {
    activeSmsProvider: string;
    cronSecretConfigured: boolean;
    cronRoutes: Array<{ key: string; label: string; path: string; requiresSecret: boolean; deepLink: string }>;
    paymentMethodsHref: string;
    securityHref: string;
  };
  security: {
    ipBlockCount: number;
    totpEnabledUserCount: number;
    activeStaffCount: number;
  };
  recentEdits: Array<{
    id: string;
    action: string;
    target: string | null;
    detail: string | null;
    actorUsername: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
}

function statusTone(s: string): 'ok' | 'warn' | 'neutral' | 'danger' {
  if (s === 'live') return 'ok';
  if (s === 'manual') return 'neutral';
  if (s === 'requires_credentials') return 'warn';
  if (s === 'disabled') return 'danger';
  return 'neutral';
}

function statusLabel(s: string): string {
  if (s === 'live') return 'Live';
  if (s === 'manual') return 'Manual';
  if (s === 'requires_credentials') return 'Needs credentials';
  if (s === 'disabled') return 'Disabled';
  return s;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setSnap(data as Snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
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

      {loading ? <p className="text-sm text-ink-mid">Loading...</p> : !snap ? null : (
        <>
          <CategorySection
            title="Inbound payments"
            subtitle={`Deposit gateways. Active credentials are stored in SystemSetting and never returned by this snapshot.`}
            icon={<Wallet className="h-4 w-4 text-gold-300" />}
            providers={snap.categories.payments}
          />

          <CategorySection
            title="Outbound payouts"
            subtitle="Withdrawal gateways. Many providers reuse the deposit-side merchant credentials."
            icon={<Send className="h-4 w-4 text-gold-300" />}
            providers={snap.categories.payouts}
          />

          <CategorySection
            title="SMS"
            subtitle={`Active provider: ${snap.platform.activeSmsProvider}. OTP, deposit + withdrawal notifications all route here.`}
            icon={<Wifi className="h-4 w-4 text-gold-300" />}
            providers={snap.categories.sms}
          />

          <CategorySection
            title="Tracking pixels"
            subtitle="Conversion events fan out to every platform with a configured id (browser pixel) + token (server-side CAPI / Events API)."
            icon={<Wifi className="h-4 w-4 text-gold-300" />}
            providers={snap.categories.tracking}
          />

          <Card padding="lg" className="mb-6">
            <CardHeader
              title="Scheduled jobs (cron)"
              subtitle={`CRON_SECRET environment variable is ${snap.platform.cronSecretConfigured ? 'set' : 'NOT set'}. Without it, cron POSTs are rejected and the equivalent admin buttons must be clicked manually.`}
            />
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip tone={snap.platform.cronSecretConfigured ? 'ok' : 'warn'}>
                CRON_SECRET {snap.platform.cronSecretConfigured ? 'configured' : 'missing'}
              </Chip>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {snap.platform.cronRoutes.map((r) => (
                <div key={r.key} className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                  <p className="text-sm font-semibold text-ink-hi">{r.label}</p>
                  <code className="mt-1 block break-all font-mono text-[11px] text-ink-mid">POST {r.path}</code>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" leftIcon={<Copy className="h-3.5 w-3.5" />} onClick={() => copyCronCmd(r.path)}>
                      Copy curl
                    </Button>
                    <Link href={r.deepLink}>
                      <Button size="sm" variant="neon" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>Configure</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {!snap.platform.cronSecretConfigured ? (
              <p className="mt-3 inline-flex items-start gap-2 text-xs text-signal-warn">
                <AlertCircle className="mt-0.5 h-3 w-3" />
                Set CRON_SECRET in your VPS .env to a long random value, then add the curl commands above to crontab.
              </p>
            ) : null}
          </Card>

          <Card padding="lg" className="mb-6">
            <CardHeader title="Security posture" subtitle="Read-only KPIs from M2K. Edit at /admin/security and /dashboard/security." />
            <div className="grid gap-3 md:grid-cols-3">
              <Kpi icon={<ShieldCheck className="h-4 w-4 text-signal-ok" />} label="2FA-enabled users" value={snap.security.totpEnabledUserCount} hint="Users with TOTP active. Push admins to enroll." />
              <Kpi icon={<Wifi className="h-4 w-4 text-signal-warn" />} label="IP blocks" value={snap.security.ipBlockCount} hint="Active IP block rules (expired ones auto-skip)." />
              <Kpi icon={<ShieldCheck className="h-4 w-4 text-ink-mid" />} label="Active staff" value={snap.security.activeStaffCount} hint="Non-blocked super_admin + admin + staff accounts." />
            </div>
            <div className="mt-4">
              <Link href={snap.platform.securityHref}>
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
            {snap.recentEdits.length === 0 ? (
              <p className="text-sm text-ink-mid">No credential edits on file yet.</p>
            ) : (
              <ul className="divide-y divide-neon/10">
                {snap.recentEdits.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <Chip tone="info">{e.action}</Chip>
                    <span className="text-xs text-ink-lo">{new Date(e.createdAt).toLocaleString()}</span>
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

function CategorySection({ title, subtitle, icon, providers }: { title: string; subtitle: string; icon: React.ReactNode; providers: ProviderCard[] }) {
  return (
    <Card padding="lg" className="mb-6">
      <CardHeader title={title} subtitle={subtitle} action={icon} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => (
          <div key={p.key} className={cn('rounded-xl border p-3', p.isActive ? 'border-signal-ok/40 bg-signal-ok/5' : 'border-neon/10 bg-base-deep/40')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-hi">{p.label}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-lo">{p.key}</p>
              </div>
              <Chip tone={statusTone(p.status)}>{statusLabel(p.status)}</Chip>
            </div>
            <p className="mt-2 text-xs text-ink-mid line-clamp-3">{p.description}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-ink-lo">{p.fieldCount} field{p.fieldCount === 1 ? '' : 's'}{p.isActive ? ' . active' : ''}</span>
              <Link href={p.configureHref}>
                <Button size="sm" variant="ghost" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>Configure</Button>
              </Link>
            </div>
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
      <p className="mt-1 text-2xl font-bold text-ink-hi">{value.toLocaleString()}</p>
      <p className="mt-1 text-[11px] text-ink-mid">{hint}</p>
    </div>
  );
}
