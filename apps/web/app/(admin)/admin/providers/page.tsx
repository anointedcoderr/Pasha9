// Built by Anointed Coder.
//
// M3 Phase 3A: External provider management. Replaces the M1 mock
// Game Providers placeholder. Lists every GameProvider row with
// adapterKey + providerKey set, shows live status + last health
// check + last sync, and opens the New Provider modal.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Plug, RefreshCw, Plus, AlertCircle, ArrowRight, Save } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AdapterChoice { key: string; label: string }
interface ProviderRow {
  id: string;
  name: string;
  providerKey: string | null;
  adapterKey: string | null;
  apiBase: string | null;
  status: 'active' | 'maintenance';
  lastSyncAt: string | null;
  lastHealthCheckAt: string | null;
  lastHealthCheckOk: boolean | null;
}

interface ListResponse {
  adapters: AdapterChoice[];
  providers: ProviderRow[];
}

export default function AdminProvidersPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/providers', { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message ?? j?.code ?? `HTTP ${res.status}`);
      setData(j as ListResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="External Providers"
        subtitle="Manage iGamingAPIs / SoftAPI and future external game aggregators."
        icon={<Plug className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={load}>Reload</Button>
            <Button variant="gold" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpenCreate(true)}>Add provider</Button>
          </div>
        }
      />

      {error ? (
        <Card padding="md" className="mb-4">
          <p className="inline-flex items-center gap-2 text-sm text-signal-danger"><AlertCircle className="h-4 w-4" /> {error}</p>
        </Card>
      ) : null}

      <Card padding="md" className="mb-4 border-l-4 border-amber-400/60">
        <p className="text-sm font-semibold text-ink-hi inline-flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-300" /> Provider becomes &quot;Live&quot; only after Test connection succeeds AND Sync brands/games returns rows.
        </p>
        <p className="mt-1 text-xs text-ink-mid">
          API token + secret are stored AEAD-encrypted at rest. They are masked in every response and never sent to the browser. Rollback / cancel / refund semantics are NOT confirmed by the provider yet - do not assume they are supported.
        </p>
      </Card>

      {loading ? (
        <p className="text-sm text-ink-mid">Loading...</p>
      ) : !data || data.providers.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">No providers configured. Click &quot;Add provider&quot; to register iGamingAPIs.</p></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.providers.map((p) => (
            <Card key={p.id} padding="lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-extrabold text-ink-hi">{p.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-lo">{p.providerKey ?? '(no key)'} . {p.adapterKey ?? '(no adapter)'}</p>
                </div>
                <Chip tone={p.status === 'active' ? 'ok' : 'warn'}>{p.status === 'active' ? 'Live' : 'Maintenance'}</Chip>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Base URL" value={p.apiBase ?? '-'} mono />
                <Stat label="Last sync" value={p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : 'Never'} />
                <Stat label="Health" value={p.lastHealthCheckAt ? `${p.lastHealthCheckOk ? 'OK' : 'FAIL'} . ${new Date(p.lastHealthCheckAt).toLocaleString()}` : 'Not tested'} positive={p.lastHealthCheckOk === true} negative={p.lastHealthCheckOk === false} />
              </div>
              <div className="mt-4 flex justify-end">
                <Link href={`/admin/providers/${p.id}`}>
                  <Button size="sm" variant="neon" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>Open</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateProviderModal
        open={openCreate}
        onOpenChange={setOpenCreate}
        adapters={data?.adapters ?? []}
        onCreated={() => { setOpenCreate(false); load(); }}
      />
    </>
  );
}

function Stat({ label, value, mono, positive, negative }: { label: string; value: string; mono?: boolean; positive?: boolean; negative?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={cn('mt-0.5 font-semibold', negative ? 'text-signal-danger' : positive ? 'text-signal-ok' : 'text-ink-hi', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  );
}

function CreateProviderModal({ open, onOpenChange, adapters, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; adapters: AdapterChoice[]; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState('iGamingAPIs JILI');
  const [providerKey, setProviderKey] = useState('igamingapis');
  const [adapterKey, setAdapterKey] = useState('igamingapis');
  const [apiBase, setApiBase] = useState('https://igamingapis.live/api/v1');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [secretEncoding, setSecretEncoding] = useState<'utf8' | 'hex' | 'base64'>('utf8');
  const [callbackPath, setCallbackPath] = useState('');
  const [callbackSecret, setCallbackSecret] = useState('');
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [currencyCode, setCurrencyCode] = useState('BDT');
  const [language, setLanguage] = useState('bn');
  const [callbackResponseMode, setCallbackResponseMode] = useState<'updated_balance' | 'net_loss_amount'>('updated_balance');
  const [launchMode, setLaunchMode] = useState<'redirect' | 'iframe'>('redirect');

  const generateCallbackSecret = () => {
    const arr = new Uint8Array(24);
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) crypto.getRandomValues(arr);
    setCallbackSecret(Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join(''));
  };

  const onSave = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name, providerKey, adapterKey, apiBase, apiKey, apiSecret, secretEncoding,
          callbackPath: callbackPath || undefined,
          callbackSecret, ipWhitelist: ipWhitelist || undefined,
          currencyCode, language, callbackResponseMode, launchMode,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErr(j?.message ?? j?.code ?? 'Create failed'); return; }
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Create failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add provider"
      description="Credentials are stored AEAD-encrypted and never echoed. Activate the provider from the detail page after Test connection passes."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Create</Button>
        </>
      }
    >
      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Provider key (URL slug)"><input value={providerKey} onChange={(e) => setProviderKey(e.target.value.toLowerCase())} className={inputCls} placeholder="igamingapis" /></Field>
        <Field label="Adapter">
          <select value={adapterKey} onChange={(e) => setAdapterKey(e.target.value)} className={inputCls}>
            {adapters.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="API base URL"><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} className={inputCls} /></Field>
        <Field label="API token"><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputCls} placeholder="Token from provider panel" type="password" /></Field>
        <Field label="API secret (32 chars typical)"><input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} className={inputCls} placeholder="AES-256-ECB secret" type="password" /></Field>
        <Field label="Secret encoding">
          <select value={secretEncoding} onChange={(e) => setSecretEncoding(e.target.value as 'utf8' | 'hex' | 'base64')} className={inputCls}>
            <option value="utf8">utf8 (raw 32 chars)</option>
            <option value="hex">hex (64 chars)</option>
            <option value="base64">base64</option>
          </select>
        </Field>
        <Field label="Callback path (optional)"><input value={callbackPath} onChange={(e) => setCallbackPath(e.target.value)} className={inputCls} placeholder={`/api/providers/${providerKey || '<key>'}/callback`} /></Field>
        <Field label="Callback secret">
          <div className="flex gap-2">
            <input value={callbackSecret} onChange={(e) => setCallbackSecret(e.target.value)} className={cn(inputCls, 'flex-1')} placeholder="?key= value the provider must send" />
            <button type="button" onClick={generateCallbackSecret} className="h-10 rounded-lg border border-neon/15 bg-base-panel px-3 text-xs font-bold uppercase tracking-wider text-ink-mid hover:border-gold-300/50">Generate</button>
          </div>
        </Field>
        <Field label="IP whitelist (comma-joined, optional)"><input value={ipWhitelist} onChange={(e) => setIpWhitelist(e.target.value)} className={inputCls} placeholder="1.2.3.4, 5.6.7.8" /></Field>
        <Field label="Currency"><input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} className={inputCls} /></Field>
        <Field label="Language"><input value={language} onChange={(e) => setLanguage(e.target.value.toLowerCase())} className={inputCls} /></Field>
        <Field label="Callback response mode">
          <select value={callbackResponseMode} onChange={(e) => setCallbackResponseMode(e.target.value as 'updated_balance' | 'net_loss_amount')} className={inputCls}>
            <option value="updated_balance">updated_balance (default)</option>
            <option value="net_loss_amount">net_loss_amount (bet - win)</option>
          </select>
        </Field>
        <Field label="Launch mode">
          <select value={launchMode} onChange={(e) => setLaunchMode(e.target.value as 'redirect' | 'iframe')} className={inputCls}>
            <option value="redirect">Full-page redirect</option>
            <option value="iframe">Inline iframe</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

const inputCls = 'h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none focus:border-gold-300/60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
