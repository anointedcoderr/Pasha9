// Built by Anointed Coder.
//
// Per-provider detail with tabs: Setup (edit secrets/settings),
// Brands (synced ProviderBrand rows), Games (synced ExternalGame
// rows), Logs (request + callback), Transactions (provider tx
// ledger + totals).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Plug, RefreshCw, ArrowLeft, AlertCircle, ShieldCheck, Zap, Save, Download, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';

interface SecretPreview { set: boolean; preview: string }
interface ProviderRow {
  id: string;
  name: string;
  providerKey: string | null;
  adapterKey: string | null;
  apiBase: string | null;
  apiKey: SecretPreview;
  apiSecret: SecretPreview;
  callbackSecret: SecretPreview;
  secretEncoding: string | null;
  callbackPath: string | null;
  ipWhitelist: string | null;
  clockSkewSeconds: number;
  currencyCode: string | null;
  language: string | null;
  callbackResponseMode: string | null;
  launchMode: string | null;
  status: 'active' | 'maintenance';
  lastSyncAt: string | null;
  lastHealthCheckAt: string | null;
  lastHealthCheckOk: boolean | null;
}

interface ListResp { providers: ProviderRow[] }


export default function AdminProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/providers', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as ListResp | null;
      const row = j?.providers?.find((p) => p.id === id) ?? null;
      if (!row) throw new Error('Provider not found');
      setProvider(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!id) return null;

  return (
    <>
      <PageHeader
        title={provider?.name ?? 'Provider'}
        subtitle={provider ? `${provider.providerKey} . ${provider.adapterKey}` : 'Loading…'}
        icon={<Plug className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/providers"><Button variant="ghost" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>Back</Button></Link>
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={load}>Reload</Button>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}

      {!provider ? (
        <p className="text-sm text-ink-mid">{loading ? 'Loading...' : 'No provider.'}</p>
      ) : (
        <>
          <Card padding="md" className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={provider.status === 'active' ? 'ok' : 'warn'}>{provider.status === 'active' ? 'Live' : 'Maintenance'}</Chip>
                <Chip tone={provider.apiKey.set && provider.apiSecret.set ? 'ok' : 'warn'}>Credentials {provider.apiKey.set && provider.apiSecret.set ? 'set' : 'missing'}</Chip>
                <Chip tone={provider.callbackSecret.set ? 'ok' : 'warn'}>Callback key {provider.callbackSecret.set ? 'set' : 'missing'}</Chip>
                <Chip tone={provider.lastHealthCheckOk ? 'ok' : provider.lastHealthCheckAt ? 'danger' : 'neutral'}>
                  {provider.lastHealthCheckAt
                    ? `Health ${provider.lastHealthCheckOk ? 'OK' : 'FAIL'} . ${new Date(provider.lastHealthCheckAt).toLocaleString()}`
                    : 'Not tested'}
                </Chip>
                {provider.lastSyncAt ? <Chip tone="info">Last sync {new Date(provider.lastSyncAt).toLocaleString()}</Chip> : null}
              </div>
              <Switch
                checked={provider.status === 'active'}
                onChange={async (next) => {
                  try {
                    const res = await fetch(`/api/admin/providers/${id}`, {
                      method: 'PATCH',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ status: next ? 'active' : 'maintenance' }),
                    });
                    if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.message ?? 'Toggle failed'); }
                    load();
                  } catch (e) { setError(e instanceof Error ? e.message : 'Toggle failed'); }
                }}
              />
            </div>
          </Card>

          <Tabs defaultValue="setup">
            <TabsList>
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="brands">Brands</TabsTrigger>
              <TabsTrigger value="games">Games</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="setup">
              <SetupPanel provider={provider} onSaved={(msg) => { showToast(msg); load(); }} onError={(m) => setError(m)} />
            </TabsContent>
            <TabsContent value="brands"><BrandsPanel providerId={id} /></TabsContent>
            <TabsContent value="games"><GamesPanel providerId={id} /></TabsContent>
            <TabsContent value="logs"><LogsPanel providerId={id} /></TabsContent>
            <TabsContent value="transactions"><TransactionsPanel providerId={id} /></TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}

function SetupPanel({ provider, onSaved, onError }: { provider: ProviderRow; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(provider.name);
  const [apiBase, setApiBase] = useState(provider.apiBase ?? '');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [secretEncoding, setSecretEncoding] = useState<'utf8' | 'hex' | 'base64'>((provider.secretEncoding as 'utf8' | 'hex' | 'base64') ?? 'utf8');
  const [callbackPath, setCallbackPath] = useState(provider.callbackPath ?? '');
  const [callbackSecret, setCallbackSecret] = useState('');
  const [ipWhitelist, setIpWhitelist] = useState(provider.ipWhitelist ?? '');
  const [clockSkewSeconds, setClockSkewSeconds] = useState(String(provider.clockSkewSeconds));
  const [currencyCode, setCurrencyCode] = useState(provider.currencyCode ?? 'BDT');
  const [language, setLanguage] = useState(provider.language ?? 'bn');
  const [callbackResponseMode, setCallbackResponseMode] = useState<'updated_balance' | 'net_loss_amount'>((provider.callbackResponseMode as 'updated_balance' | 'net_loss_amount') ?? 'updated_balance');
  const [launchMode, setLaunchMode] = useState<'redirect' | 'iframe'>((provider.launchMode as 'redirect' | 'iframe') ?? 'redirect');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name, apiBase, secretEncoding,
        callbackPath: callbackPath || undefined,
        ipWhitelist: ipWhitelist || undefined,
        clockSkewSeconds: Number(clockSkewSeconds) || 30,
        currencyCode, language, callbackResponseMode, launchMode,
      };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (apiSecret.trim()) body.apiSecret = apiSecret.trim();
      if (callbackSecret.trim()) body.callbackSecret = callbackSecret.trim();
      const res = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { onError(j?.message ?? 'Save failed'); return; }
      onSaved('Saved.');
      setApiKey(''); setApiSecret(''); setCallbackSecret('');
    } catch (e) { onError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  const onTestEncryption = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/test-encryption`, { method: 'POST' });
      const j = await res.json().catch(() => null);
      if (!res.ok) { onError(j?.message ?? j?.code ?? 'Encryption test failed'); return; }
      onSaved(j?.ok ? `Encryption OK. Key bytes: ${j.keyByteLength}.` : `Round-trip mismatch. Key bytes: ${j?.keyByteLength}.`);
    } catch (e) { onError(e instanceof Error ? e.message : 'Encryption test failed'); }
    finally { setBusy(false); }
  };

  const onTestConnection = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/test-connection`, { method: 'POST' });
      const j = await res.json().catch(() => null);
      if (!res.ok) { onError(j?.message ?? 'Connection test failed'); return; }
      onSaved(`Health ${j?.ok ? 'OK' : 'FAIL'} . ${j?.latencyMs ?? '?'}ms . ${j?.detail ?? ''}`);
    } catch (e) { onError(e instanceof Error ? e.message : 'Connection test failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card padding="lg">
      <CardHeader title="Setup" subtitle="Empty secret fields leave the existing value untouched. Save first; then Test." />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="API base URL"><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} className={inputCls} /></Field>
        <Field label={`API token ${provider.apiKey.set ? `(set ${provider.apiKey.preview})` : '(missing)'}`}><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputCls} type="password" placeholder="Leave blank to keep current" /></Field>
        <Field label={`API secret ${provider.apiSecret.set ? `(set ${provider.apiSecret.preview})` : '(missing)'}`}><input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} className={inputCls} type="password" placeholder="Leave blank to keep current" /></Field>
        <Field label="Secret encoding">
          <select value={secretEncoding} onChange={(e) => setSecretEncoding(e.target.value as 'utf8' | 'hex' | 'base64')} className={inputCls}>
            <option value="utf8">utf8</option><option value="hex">hex</option><option value="base64">base64</option>
          </select>
        </Field>
        <Field label="Callback path"><input value={callbackPath} onChange={(e) => setCallbackPath(e.target.value)} className={inputCls} placeholder={`/api/providers/${provider.providerKey}/callback`} /></Field>
        <Field label={`Callback secret ${provider.callbackSecret.set ? `(set ${provider.callbackSecret.preview})` : '(missing)'}`}><input value={callbackSecret} onChange={(e) => setCallbackSecret(e.target.value)} className={inputCls} type="password" placeholder="Leave blank to keep current" /></Field>
        <Field label="IP whitelist (comma)"><input value={ipWhitelist} onChange={(e) => setIpWhitelist(e.target.value)} className={inputCls} placeholder="1.2.3.4, 5.6.7.8" /></Field>
        <Field label="Clock skew (sec)"><input type="number" min={0} max={3600} value={clockSkewSeconds} onChange={(e) => setClockSkewSeconds(e.target.value)} className={inputCls} /></Field>
        <Field label="Currency"><input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} className={inputCls} /></Field>
        <Field label="Language"><input value={language} onChange={(e) => setLanguage(e.target.value.toLowerCase())} className={inputCls} /></Field>
        <Field label="Callback response mode">
          <select value={callbackResponseMode} onChange={(e) => setCallbackResponseMode(e.target.value as 'updated_balance' | 'net_loss_amount')} className={inputCls}>
            <option value="updated_balance">updated_balance</option>
            <option value="net_loss_amount">net_loss_amount</option>
          </select>
        </Field>
        <Field label="Launch mode">
          <select value={launchMode} onChange={(e) => setLaunchMode(e.target.value as 'redirect' | 'iframe')} className={inputCls}>
            <option value="redirect">Redirect</option><option value="iframe">Iframe</option>
          </select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Save</Button>
        <Button variant="neon" loading={busy} leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={onTestEncryption}>Test encryption</Button>
        <Button variant="neon" loading={busy} leftIcon={<Zap className="h-3.5 w-3.5" />} onClick={onTestConnection}>Test connection</Button>
      </div>
    </Card>
  );
}

interface BrandRow { id: string; brandKey: string; displayName: string; status: string; gameCount: number; lastSyncAt: string | null; createdAt: string }

function BrandsPanel({ providerId }: { providerId: string }) {
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; snippet?: string } | null>(null);
  const [openManual, setOpenManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/brands`, { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      setRows(Array.isArray(j?.brands) ? (j.brands as BrandRow[]) : []);
    } finally { setLoading(false); }
  }, [providerId]);
  useEffect(() => { load(); }, [load]);

  const onSync = async () => {
    setBusy(true); setErr(null); setInfo(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/sync-brands`, { method: 'POST' });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErr({ msg: j?.message ?? j?.code ?? 'Sync failed', snippet: typeof j?.snippet === 'string' ? j.snippet : undefined }); return; }
      setInfo(`Brands synced: ${j?.count ?? 0} (inserted ${j?.inserted ?? 0}, updated ${j?.updated ?? 0}).`);
      load();
    } catch (e) { setErr({ msg: e instanceof Error ? e.message : 'Sync failed' }); }
    finally { setBusy(false); }
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Brands"
        subtitle="Aggregator sub-providers. Auto sync first; if the catalog is gated, use Add Manual Brand."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpenManual(true)}>Add Manual Brand</Button>
            <Button size="sm" variant="neon" loading={busy} leftIcon={<Download className="h-3.5 w-3.5" />} onClick={onSync}>Sync brands</Button>
          </div>
        }
      />

      <Card padding="sm" className="mb-3 border-l-4 border-amber-400/60">
        <p className="text-[11px] font-semibold text-ink-mid">
          If auto brand sync returns 0, the provider catalog likely requires panel login. Click <strong>Add Manual Brand</strong> with brandKey <code>JILI</code> / displayName <code>JILI</code>, then go to the Games tab and use the confirmed brand_id from the provider panel.
        </p>
      </Card>

      {info ? <p className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{info}</p> : null}
      {err ? (
        <div className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <p className="font-semibold">{err.msg}</p>
          {err.snippet ? <pre className="mt-2 max-h-24 overflow-auto rounded border border-rose-400/20 bg-black/40 p-2 text-[10px] text-rose-100/85">{err.snippet}</pre> : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-mid">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-mid">No brands yet. Sync or Add Manual Brand.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-lg border border-neon/10 bg-base-panel/40 px-3 py-2 text-sm">
              <div>
                <span className="font-semibold text-ink-hi">{b.displayName}</span>
                <span className="ml-2 font-mono text-[10px] text-ink-lo">{b.brandKey}</span>
                <span className="ml-2 text-[10px] text-ink-lo">. {b.gameCount} game{b.gameCount === 1 ? '' : 's'}</span>
              </div>
              <span className="text-[10px] text-ink-lo">{b.lastSyncAt ? new Date(b.lastSyncAt).toLocaleString() : 'Never'}</span>
            </li>
          ))}
        </ul>
      )}

      <ManualBrandModal open={openManual} onOpenChange={setOpenManual} providerId={providerId} onCreated={() => { setOpenManual(false); load(); }} />
    </Card>
  );
}

function ManualBrandModal({ open, onOpenChange, providerId, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; providerId: string; onCreated: () => void }) {
  const [brandKey, setBrandKey] = useState('JILI');
  const [displayName, setDisplayName] = useState('JILI');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onSave = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/brands`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandKey: brandKey.trim(), displayName: displayName.trim() }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErr(j?.message ?? j?.code ?? 'Save failed'); return; }
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Manual Brand"
      description="Use this when the provider catalog is gated. Type the brand ID confirmed from the provider panel."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Save brand</Button>
        </>
      }
    >
      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}
      <div className="space-y-3">
        <Field label="Brand key / brand_id"><input value={brandKey} onChange={(e) => setBrandKey(e.target.value)} className={inputCls} placeholder="JILI" /></Field>
        <Field label="Display name"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="JILI" /></Field>
      </div>
    </Modal>
  );
}

interface GameRow { id: string; gameUid: string; brandId: string | null; displayName: string; category: string | null; status: string; lastSyncAt: string | null }

function GamesPanel({ providerId }: { providerId: string }) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [brandKey, setBrandKey] = useState('');
  const [filterBrandId, setFilterBrandId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; snippet?: string } | null>(null);
  const [previewSample, setPreviewSample] = useState<Array<{ gameUid: string; displayName: string }> | null>(null);
  const [openManual, setOpenManual] = useState(false);
  const [testGame, setTestGame] = useState<GameRow | null>(null);

  const loadBrands = useCallback(async () => {
    const r = await fetch(`/api/admin/providers/${providerId}/brands`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    const list = Array.isArray(j?.brands) ? (j.brands as BrandRow[]) : [];
    setBrands(list);
    if (!brandKey && list.length === 1) setBrandKey(list[0].brandKey);
  }, [providerId, brandKey]);
  const loadGames = useCallback(async () => {
    const r = await fetch(`/api/admin/providers/${providerId}/games?${filterBrandId ? `brandId=${filterBrandId}&` : ''}limit=200`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    setGames(Array.isArray(j?.games) ? (j.games as GameRow[]) : []);
  }, [providerId, filterBrandId]);
  useEffect(() => { loadBrands(); }, [loadBrands]);
  useEffect(() => { loadGames(); }, [loadGames]);

  const onPreview = async () => {
    if (!brandKey.trim()) { setErr({ msg: 'Enter a brand_id first.' }); return; }
    setBusy(true); setInfo(null); setErr(null); setPreviewSample(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/preview-games`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandKey: brandKey.trim() }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErr({ msg: j?.message ?? 'Preview failed', snippet: typeof j?.snippet === 'string' ? j.snippet : undefined }); return; }
      setInfo(`Preview ok. Provider would return ${j?.count ?? 0} games. No rows inserted yet.`);
      setPreviewSample(Array.isArray(j?.sample) ? (j.sample as Array<{ gameUid: string; displayName: string }>) : []);
    } catch (e) { setErr({ msg: e instanceof Error ? e.message : 'Preview failed' }); }
    finally { setBusy(false); }
  };

  const onSync = async () => {
    if (!brandKey.trim()) { setErr({ msg: 'Enter a brand_id first.' }); return; }
    setBusy(true); setInfo(null); setErr(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/sync-games`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandKey: brandKey.trim() }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErr({ msg: j?.message ?? 'Sync failed', snippet: typeof j?.snippet === 'string' ? j.snippet : undefined }); return; }
      setInfo(`Games synced: ${j?.count ?? 0} (inserted ${j?.inserted ?? 0}, updated ${j?.updated ?? 0}).`);
      loadGames();
    } catch (e) { setErr({ msg: e instanceof Error ? e.message : 'Sync failed' }); }
    finally { setBusy(false); }
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Games"
        subtitle="Auto sync first. Manual import when the provider catalog is gated."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpenManual(true)}>Add Manual Game</Button>
          </div>
        }
      />

      <Card padding="sm" className="mb-3 border-l-4 border-amber-400/60">
        <p className="text-[11px] font-semibold text-ink-mid">
          Use manual games only when the provider panel supplies confirmed game IDs. The provider stays at Maintenance until you flip it Live. Test launch is available per row to confirm the upstream accepts the gameUid before exposing it to players.
        </p>
      </Card>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="grow">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">Brand id / key</label>
          <input value={brandKey} onChange={(e) => setBrandKey(e.target.value)} className={cn(inputCls, 'mt-1')} placeholder="JILI (or 73, etc)" list="brand-suggestions" />
          <datalist id="brand-suggestions">
            {brands.map((b) => <option key={b.id} value={b.brandKey}>{b.displayName}</option>)}
          </datalist>
        </div>
        <Button variant="ghost" loading={busy} leftIcon={<Zap className="h-3.5 w-3.5" />} onClick={onPreview}>Preview</Button>
        <Button variant="neon" loading={busy} leftIcon={<Download className="h-3.5 w-3.5" />} onClick={onSync}>Sync games</Button>
      </div>

      {info ? <p className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{info}</p> : null}
      {err ? (
        <div className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <p className="font-semibold">{err.msg}</p>
          {err.snippet ? <pre className="mt-2 max-h-24 overflow-auto rounded border border-rose-400/20 bg-black/40 p-2 text-[10px] text-rose-100/85">{err.snippet}</pre> : null}
        </div>
      ) : null}

      {previewSample && previewSample.length > 0 ? (
        <Card padding="sm" className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Preview sample ({previewSample.length})</p>
          <ul className="mt-2 grid gap-1 text-xs text-ink-mid md:grid-cols-2">
            {previewSample.map((s, i) => (
              <li key={`${s.gameUid}-${i}`} className="rounded border border-neon/10 bg-base-panel/50 px-2 py-1">
                <span className="font-semibold text-ink-hi">{s.displayName}</span>
                <span className="ml-2 font-mono text-[10px] text-ink-lo">{s.gameUid}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mb-2 flex items-center gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Filter</label>
        <select value={filterBrandId} onChange={(e) => setFilterBrandId(e.target.value)} className={cn(inputCls, 'w-auto')}>
          <option value="">All brands ({games.length})</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.displayName} ({b.gameCount})</option>)}
        </select>
      </div>

      {games.length === 0 ? (
        <p className="text-sm text-ink-mid">No games yet. Preview a brand_id then Sync games, or use Add Manual Game.</p>
      ) : (
        <ul className="grid gap-1 md:grid-cols-2">
          {games.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-lg border border-neon/10 bg-base-panel/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-semibold text-ink-hi">{g.displayName}</span>
                <span className="ml-2 font-mono text-[10px] text-ink-lo">{g.gameUid}</span>
                {g.category ? <span className="ml-2 text-[10px] text-ink-lo">. {g.category}</span> : null}
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                <Chip tone={g.status === 'active' ? 'ok' : g.status === 'maintenance' ? 'warn' : 'neutral'}>{g.status}</Chip>
                <Button size="sm" variant="ghost" leftIcon={<Zap className="h-3.5 w-3.5" />} onClick={() => setTestGame(g)}>Test</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ManualGameModal
        open={openManual}
        onOpenChange={setOpenManual}
        providerId={providerId}
        brands={brands}
        onDone={(msg) => { setOpenManual(false); setInfo(msg); loadGames(); }}
      />
      <TestLaunchModal
        open={!!testGame}
        onOpenChange={(v) => { if (!v) setTestGame(null); }}
        providerId={providerId}
        game={testGame}
      />
    </Card>
  );
}

function ManualGameModal({ open, onOpenChange, providerId, brands, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  brands: BrandRow[];
  onDone: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [brandKey, setBrandKey] = useState('');
  const [gameUid, setGameUid] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('slot');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'maintenance'>('active');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [bulkData, setBulkData] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode('single'); setBrandKey(''); setGameUid(''); setDisplayName('');
      setCategory('slot'); setImageUrl(''); setStatus('active');
      setFormat('csv'); setBulkData(''); setErr(null); setBusy(false);
    } else if (!brandKey && brands.length === 1) {
      setBrandKey(brands[0].brandKey);
    }
  }, [open, brands, brandKey]);

  const onSave = async () => {
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = {};
      if (brandKey.trim()) body.brandKey = brandKey.trim();
      if (mode === 'single') {
        if (!gameUid.trim() || !displayName.trim()) { setErr('gameUid and displayName are required.'); return; }
        body.gameUid = gameUid.trim();
        body.displayName = displayName.trim();
        if (category.trim()) body.category = category.trim();
        if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
        body.status = status;
      } else {
        if (!bulkData.trim()) { setErr('Paste at least one row.'); return; }
        body.format = format;
        body.data = bulkData;
      }
      const res = await fetch(`/api/admin/providers/${providerId}/manual-games`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        const issues = Array.isArray(j?.issues) ? j.issues.map((i: { path?: string[]; message?: string }) => `${(i.path ?? []).join('.')}: ${i.message}`).join('; ') : '';
        setErr(j?.message ?? j?.code ?? `Save failed${issues ? ` (${issues})` : ''}`);
        return;
      }
      const rowErrors = Array.isArray(j?.rowErrors) && j.rowErrors.length > 0 ? ` Skipped: ${j.rowErrors.length}.` : '';
      onDone(`Manual import done. Inserted ${j?.inserted ?? 0}, updated ${j?.updated ?? 0}.${rowErrors}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Manual Game"
      description="Single entry or bulk import. Upserts on (provider, gameUid). Provider stays at Maintenance."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Save</Button>
        </>
      }
    >
      <div className="mb-3 inline-flex rounded-lg border border-neon/15 bg-base-panel p-1 text-xs">
        <button type="button" onClick={() => setMode('single')} className={cn('rounded-md px-3 py-1.5 font-semibold transition', mode === 'single' ? 'bg-gold-400 text-base-deep' : 'text-ink-mid')}>Single</button>
        <button type="button" onClick={() => setMode('bulk')} className={cn('rounded-md px-3 py-1.5 font-semibold transition', mode === 'bulk' ? 'bg-gold-400 text-base-deep' : 'text-ink-mid')}>Bulk import</button>
      </div>

      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}

      <div className="space-y-3">
        <Field label="Brand (optional)">
          <select value={brandKey} onChange={(e) => setBrandKey(e.target.value)} className={inputCls}>
            <option value="">- unassigned -</option>
            {brands.map((b) => <option key={b.id} value={b.brandKey}>{b.displayName} ({b.brandKey})</option>)}
          </select>
        </Field>

        {mode === 'single' ? (
          <>
            <Field label="Game UID"><input value={gameUid} onChange={(e) => setGameUid(e.target.value)} className={inputCls} placeholder="784512" /></Field>
            <Field label="Display name"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="Fortune Gems" /></Field>
            <Field label="Category (optional)"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="slot" /></Field>
            <Field label="Image URL (optional)"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputCls} placeholder="https://..." /></Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'maintenance')} className={inputCls}>
                <option value="active">active</option>
                <option value="maintenance">maintenance</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Format">
              <div className="inline-flex rounded-lg border border-neon/15 bg-base-panel p-1 text-xs">
                <button type="button" onClick={() => setFormat('csv')} className={cn('rounded-md px-3 py-1.5 font-semibold transition', format === 'csv' ? 'bg-gold-400 text-base-deep' : 'text-ink-mid')}>CSV</button>
                <button type="button" onClick={() => setFormat('json')} className={cn('rounded-md px-3 py-1.5 font-semibold transition', format === 'json' ? 'bg-gold-400 text-base-deep' : 'text-ink-mid')}>JSON</button>
              </div>
            </Field>
            <Field label={format === 'csv' ? 'CSV (first row = header)' : 'JSON (array of objects)'}>
              <textarea
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                rows={10}
                className={cn(inputCls, 'h-auto py-2 font-mono text-[11px]')}
                placeholder={format === 'csv' ? 'gameUid,displayName,category,imageUrl\n784512,Fortune Gems,slot,\n784513,Money Coming,slot,' : '[\n  {"gameUid":"784512","displayName":"Fortune Gems","category":"slot"},\n  {"gameUid":"784513","displayName":"Money Coming","category":"slot"}\n]'}
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

interface TestLaunchResult {
  launchUrl: string;
  mode: string;
  rawCode?: number;
  rawMessage?: string;
  balanceUsed: number;
  testUser: { id: string; username: string };
  maskedResponse: unknown;
}

function TestLaunchModal({ open, onOpenChange, providerId, game }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  game: GameRow | null;
}) {
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; snippet?: string } | null>(null);
  const [result, setResult] = useState<TestLaunchResult | null>(null);

  useEffect(() => {
    if (!open) { setUserId(''); setErr(null); setResult(null); setBusy(false); }
  }, [open]);

  const onRun = async () => {
    if (!game) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const body: Record<string, unknown> = { gameUid: game.gameUid };
      if (userId.trim()) body.userId = userId.trim();
      const res = await fetch(`/api/admin/providers/${providerId}/test-launch`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErr({ msg: j?.message ?? j?.code ?? 'Test failed', snippet: typeof j?.snippet === 'string' ? j.snippet : undefined }); return; }
      setResult(j as TestLaunchResult);
    } catch (e) { setErr({ msg: e instanceof Error ? e.message : 'Test failed' }); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={game ? `Test launch ${game.displayName}` : 'Test launch'}
      description="Runs the encrypted launch payload through the provider. Token and secret stay on the server."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="gold" loading={busy} leftIcon={<Zap className="h-3.5 w-3.5" />} onClick={onRun}>Run test</Button>
        </>
      }
    >
      {err ? (
        <div className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <p className="font-semibold">{err.msg}</p>
          {err.snippet ? <pre className="mt-2 max-h-24 overflow-auto rounded border border-rose-400/20 bg-black/40 p-2 text-[10px] text-rose-100/85">{err.snippet}</pre> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-[11px] text-ink-mid">Game UID: <span className="font-mono text-ink-hi">{game?.gameUid ?? '-'}</span></p>
        <Field label="Test user id (optional, defaults to you)">
          <input value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls} placeholder="user cuid" />
        </Field>
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          <Card padding="sm" className="border-l-4 border-emerald-400/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Launch URL</p>
            <p className="mt-1 break-all font-mono text-[11px] text-emerald-200">{result.launchUrl}</p>
          </Card>
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-mid md:grid-cols-4">
            <Totals label="Mode" value={result.mode} />
            <Totals label="Code" value={String(result.rawCode ?? '-')} />
            <Totals label="Balance used" value={fmt(result.balanceUsed)} />
            <Totals label="Tester" value={result.testUser.username} />
          </div>
          {result.rawMessage ? <p className="text-xs text-ink-mid">Message: {result.rawMessage}</p> : null}
          <Card padding="sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Masked response</p>
            <pre className="mt-1 max-h-48 overflow-auto rounded border border-neon/10 bg-black/40 p-2 text-[10px] text-ink-mid">{JSON.stringify(result.maskedResponse, null, 2)}</pre>
          </Card>
        </div>
      ) : null}
    </Modal>
  );
}

interface RequestLogRow { id: string; createdAt: string; direction: string; endpoint: string; method: string; status: number | null; durationMs: number | null; errorMessage: string | null }
interface CallbackLogRow { id: string; receivedAt: string; ip: string | null; callbackKeyValid: boolean | null; ipValid: boolean | null; timestampValid: boolean | null; processedTxId: string | null; error: string | null }

function LogsPanel({ providerId }: { providerId: string }) {
  const [kind, setKind] = useState<'request' | 'callback'>('request');
  const [rows, setRows] = useState<RequestLogRow[] | CallbackLogRow[]>([]);
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/providers/${providerId}/logs?kind=${kind}&limit=50`, { cache: 'no-store' });
    const j = await res.json().catch(() => null);
    setRows((j?.rows ?? []) as RequestLogRow[] | CallbackLogRow[]);
  }, [providerId, kind]);
  useEffect(() => { load(); }, [load]);

  return (
    <Card padding="md">
      <CardHeader
        title="Logs"
        subtitle="Outbound provider calls + inbound callbacks. Secrets are masked."
        action={
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'request' | 'callback')} className={cn(inputCls, 'w-auto')}>
              <option value="request">Requests</option>
              <option value="callback">Callbacks</option>
            </select>
            <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>Reload</Button>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          {kind === 'request' ? (
            <>
              <thead className="bg-base-elev text-left text-[11px] uppercase tracking-wider text-ink-lo">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Dir</th><th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">ms</th><th className="px-3 py-2">Error</th></tr>
              </thead>
              <tbody className="divide-y divide-neon/10">
                {(rows as RequestLogRow[]).map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-ink-mid">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-ink-mid">{r.direction}</td>
                    <td className="px-3 py-2 font-mono">{r.endpoint}</td>
                    <td className="px-3 py-2">{r.status ?? '-'}</td>
                    <td className="px-3 py-2">{r.durationMs ?? '-'}</td>
                    <td className="px-3 py-2 text-signal-danger">{r.errorMessage ?? ''}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-4 text-center text-ink-mid">No requests yet.</td></tr> : null}
              </tbody>
            </>
          ) : (
            <>
              <thead className="bg-base-elev text-left text-[11px] uppercase tracking-wider text-ink-lo">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">IP</th><th className="px-3 py-2">Key</th><th className="px-3 py-2">IP OK</th><th className="px-3 py-2">TS</th><th className="px-3 py-2">Tx</th><th className="px-3 py-2">Error</th></tr>
              </thead>
              <tbody className="divide-y divide-neon/10">
                {(rows as CallbackLogRow[]).map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-ink-mid">{new Date(r.receivedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono">{r.ip ?? '-'}</td>
                    <td className="px-3 py-2">{r.callbackKeyValid ? 'OK' : r.callbackKeyValid === false ? 'BAD' : '-'}</td>
                    <td className="px-3 py-2">{r.ipValid ? 'OK' : r.ipValid === false ? 'BAD' : '-'}</td>
                    <td className="px-3 py-2">{r.timestampValid ? 'OK' : r.timestampValid === false ? 'WARN' : '-'}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{r.processedTxId ?? '-'}</td>
                    <td className="px-3 py-2 text-signal-danger">{r.error ?? ''}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-4 text-center text-ink-mid">No callbacks yet.</td></tr> : null}
              </tbody>
            </>
          )}
        </table>
      </div>
    </Card>
  );
}

interface TxRow { id: string; createdAt: string; userId: string | null; memberAccount: string; gameUid: string | null; gameRound: string; betAmount: number; winAmount: number; netResult: number; type: string; status: string; errorCode: string | null }
interface TxResp { rows: TxRow[]; totals: { rounds: number; totalBet: number; totalWin: number; netResult: number; ggr: number } }

function TransactionsPanel({ providerId }: { providerId: string }) {
  const [data, setData] = useState<TxResp | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/providers/${providerId}/transactions?limit=100`, { cache: 'no-store' });
    const j = await res.json().catch(() => null);
    setData(j as TxResp);
  }, [providerId]);
  useEffect(() => { load(); }, [load]);

  return (
    <Card padding="md">
      <CardHeader title="Transactions" subtitle="Provider wallet events. Accepted rows feed the GGR aggregate." action={<Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>Reload</Button>} />
      {data?.totals ? (
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Totals label="Rounds" value={data.totals.rounds.toString()} />
          <Totals label="Total bet" value={fmt(data.totals.totalBet)} />
          <Totals label="Total win" value={fmt(data.totals.totalWin)} />
          <Totals label="Net" value={fmt(data.totals.netResult)} positive={data.totals.netResult >= 0} />
          <Totals label="GGR" value={fmt(data.totals.ggr)} positive={data.totals.ggr >= 0} />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-base-elev text-left text-[11px] uppercase tracking-wider text-ink-lo">
            <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Member</th><th className="px-3 py-2">Game</th><th className="px-3 py-2">Round</th><th className="px-3 py-2">Bet</th><th className="px-3 py-2">Win</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-neon/10">
            {(data?.rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-ink-mid">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.memberAccount}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.gameUid ?? '-'}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.gameRound}</td>
                <td className="px-3 py-2">{fmt(r.betAmount)}</td>
                <td className="px-3 py-2">{fmt(r.winAmount)}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.type}</td>
                <td className="px-3 py-2"><Chip tone={r.status === 'accepted' ? 'ok' : r.status === 'duplicate' ? 'info' : 'danger'}>{r.status}</Chip></td>
              </tr>
            ))}
            {(data?.rows ?? []).length === 0 ? <tr><td colSpan={8} className="px-3 py-4 text-center text-ink-mid">No transactions yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Totals({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-neon/10 bg-base-panel/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={cn('mt-0.5 text-base font-extrabold', positive === false ? 'text-signal-danger' : 'text-ink-hi')}>{value}</p>
    </div>
  );
}

function fmt(n: number): string {
  return `BDT ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
