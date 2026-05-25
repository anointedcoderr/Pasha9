// Built by Anointed Coder.
//
// Payout Providers admin. Sister page to /admin/payments. Same shape
// as M2B: provider cards with status chip + credential form. The
// inbound deposit credentials are shared from /admin/payments, so
// some payout fields are stored there; this page focuses on payout
// enable + callback secrets.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import {
  Wallet as WalletIcon,
  Phone,
  Banknote,
  FlaskConical,
  ShieldCheck,
  Save,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type IconName = 'wallet' | 'phone' | 'banknote' | 'flask-conical' | 'shield-check';
type ProviderStatus = 'live' | 'requires_credentials' | 'disabled' | 'manual';
type FieldKind = 'text' | 'secret' | 'toggle' | 'select';

interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  hint?: string;
  value: string | null;
  hasValue: boolean;
}

interface ProviderSummary {
  key: string;
  label: string;
  icon: IconName;
  description: string;
  status: { configured: boolean; status: ProviderStatus; notes?: string[] };
  fields: Field[];
}

function iconFor(name: IconName, className?: string) {
  const cls = className ?? 'h-5 w-5';
  switch (name) {
    case 'wallet': return <WalletIcon className={cls} />;
    case 'phone': return <Phone className={cls} />;
    case 'banknote': return <Banknote className={cls} />;
    case 'flask-conical': return <FlaskConical className={cls} />;
    case 'shield-check': return <ShieldCheck className={cls} />;
  }
}

function chipFor(status: ProviderStatus) {
  switch (status) {
    case 'live': return <Chip tone="ok">Live</Chip>;
    case 'manual': return <Chip tone="info">Manual</Chip>;
    case 'requires_credentials': return <Chip tone="warn">Requires credentials</Chip>;
    case 'disabled': return <Chip>Disabled</Chip>;
  }
}

export default function AdminPayoutsPage() {
  const [providers, setProviders] = useState<ProviderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/payouts', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      setProviders(data.providers as ProviderSummary[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Payout Providers"
        subtitle="Outbound payout adapters. Manual payout (admin Mark-Paid at /admin/withdrawals) remains the authoritative flow."
        icon={<WalletIcon className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/payments/reconciliation?direction=outbound" className="btn-gold inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-ink">
              Outbound log <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Button variant="neon" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          M2C ships the payout adapter scaffolding + per-method limits + Mark Paid action. Webhooks POST to{' '}
          <code className="font-mono text-xs">/api/payouts/webhook/&lt;provider&gt;</code>. Each adapter must verify
          its own signature before the service marks the matching Withdrawal as paid. Live signature verification for
          bKash / Nagad / Rocket lands when the client supplies sandbox credentials.
        </p>
      </Card>

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {!providers ? (
        <Card padding="lg">Loading providers...</Card>
      ) : (
        <div className="space-y-4">
          {providers.map((p) => (
            <ProviderCard key={p.key} provider={p} onSaved={load} />
          ))}
        </div>
      )}
    </>
  );
}

function ProviderCard({ provider, onSaved }: { provider: ProviderSummary; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of provider.fields) {
      map[f.key] = f.kind === 'secret' ? '' : (f.value ?? '');
    }
    return map;
  }, [provider]);
  const [draft, setDraft] = useState<Record<string, string>>(initial);

  const save = async () => {
    setSaving(true);
    setSavedMessage(null);
    setError(null);
    try {
      const updates = Object.entries(draft).map(([key, value]) => ({ key, value }));
      const res = await fetch(`/api/admin/payouts/${provider.key}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setSavedMessage(`Saved (${data.updated} field${data.updated === 1 ? '' : 's'} updated).`);
      setTimeout(() => setSavedMessage(null), 4500);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
              {iconFor(provider.icon, 'h-4 w-4')}
            </span>
            <span className="font-extrabold text-ink-hi">{provider.label}</span>
          </span>
        }
        subtitle={provider.description}
        action={chipFor(provider.status.status)}
      />

      {provider.status.notes && provider.status.notes.length > 0 ? (
        <ul className="mb-3 space-y-1 rounded-lg border border-neon/10 bg-base-deep/40 px-3 py-2 text-xs text-ink-mid">
          {provider.status.notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      ) : null}

      {provider.fields.length === 0 ? (
        <p className="text-xs text-ink-lo">No payout-specific credentials required.</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {provider.fields.map((f) => {
              const current = draft[f.key] ?? '';
              if (f.kind === 'toggle') {
                const checked = current === '1';
                return (
                  <FormField key={f.key} label={f.label} hint={f.hint}>
                    <div className="flex h-10 items-center gap-3">
                      <Switch checked={checked} onChange={(next) => setDraft((d) => ({ ...d, [f.key]: next ? '1' : '0' }))} />
                      <span className="text-xs text-ink-mid">{checked ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </FormField>
                );
              }
              if (f.kind === 'secret') {
                return (
                  <FormField
                    key={f.key}
                    label={f.label}
                    hint={f.hasValue ? `${f.hint ?? ''}${f.hint ? ' ' : ''}A value is stored (${f.value ?? 'hidden'}). Leave empty to keep it.` : f.hint}
                  >
                    <PasswordInput
                      value={current}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={f.hasValue ? '************' : 'Enter value'}
                    />
                  </FormField>
                );
              }
              return (
                <FormField key={f.key} label={f.label} hint={f.hint}>
                  <Input
                    value={current}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.label}
                  />
                </FormField>
              );
            })}
          </div>

          {error ? <p className="text-sm text-signal-danger">{error}</p> : null}
          {savedMessage ? <p className="text-sm text-signal-ok">{savedMessage}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <code className="text-[11px] text-ink-lo">
              Webhook: <span className="font-mono text-ink-mid">/api/payouts/webhook/{provider.key}</span>
            </code>
            <Button type="submit" variant="gold" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>
              Save
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
