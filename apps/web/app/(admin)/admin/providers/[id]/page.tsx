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
import { Plug, RefreshCw, ArrowLeft, AlertCircle, ShieldCheck, Zap, Save, Download, Plus, Copy, Check, AlertTriangle, Activity, PlayCircle, Search, ImageOff } from 'lucide-react';
import { CATEGORY_OPTIONS, normalizeCategory } from '@/lib/providers/category';
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
  launchTimestampOffsetMs: number;
  publicBaseUrl: string | null;
  launchMinBalance: number;
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
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="setup">
              <SetupPanel provider={provider} onSaved={(msg) => { showToast(msg); load(); }} onError={(m) => setError(m)} />
            </TabsContent>
            <TabsContent value="brands"><BrandsPanel providerId={id} /></TabsContent>
            <TabsContent value="games"><GamesPanel providerId={id} /></TabsContent>
            <TabsContent value="logs"><LogsPanel providerId={id} /></TabsContent>
            <TabsContent value="transactions"><TransactionsPanel providerId={id} /></TabsContent>
            <TabsContent value="reports"><ReportsPanel providerId={id} /></TabsContent>
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
  const [launchTimestampOffsetMs, setLaunchTimestampOffsetMs] = useState(String(provider.launchTimestampOffsetMs ?? 0));
  const [publicBaseUrl, setPublicBaseUrl] = useState(provider.publicBaseUrl ?? '');
  const [launchMinBalance, setLaunchMinBalance] = useState(String(provider.launchMinBalance ?? 0));
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
        launchTimestampOffsetMs: Number(launchTimestampOffsetMs) || 0,
        publicBaseUrl: publicBaseUrl.trim() || '',
        launchMinBalance: Number(launchMinBalance) || 0,
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
        <Field label="Launch timestamp offset (ms)">
          <input type="number" step={1} value={launchTimestampOffsetMs} onChange={(e) => setLaunchTimestampOffsetMs(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <Field label="Public base URL (HTTPS, no trailing slash)">
          <input value={publicBaseUrl} onChange={(e) => setPublicBaseUrl(e.target.value)} className={inputCls} placeholder="https://pasha9.com" />
        </Field>
        <Field label="Minimum BDT to allow launch">
          <input type="number" min={0} step="0.01" value={launchMinBalance} onChange={(e) => setLaunchMinBalance(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
      </div>
      <p className="mt-2 text-[10px] text-ink-lo">Public base URL overrides the request origin when building callback + return URLs sent to the provider. Required for production; localhost / private IPs will be refused by the public launch route.</p>
      <p className="mt-1 text-[10px] text-ink-lo">Launch timestamp default 0. The timestamp itself is always generated fresh as Date.now() inside the adapter.</p>
      <p className="mt-1 text-[10px] text-ink-lo">Minimum balance gates the public launch route. The lobby fetches this value and opens DepositRequiredModal when the player is under-funded. 0 disables the check.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Save</Button>
        <Button variant="neon" loading={busy} leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={onTestEncryption}>Test encryption</Button>
        <Button variant="neon" loading={busy} leftIcon={<Zap className="h-3.5 w-3.5" />} onClick={onTestConnection}>Test connection</Button>
      </div>

      <HealthPanel providerId={provider.id} />
    </Card>
  );
}

interface HealthPayload {
  ready: boolean;
  providerActive: boolean;
  urls: { baseUrl: string; baseUrlSource: 'provider_setting' | 'env' | 'request_origin'; callbackUrl: string; returnUrl: string };
  checks: {
    baseUrlIsHttps: boolean;
    baseUrlIsPublic: boolean;
    baseUrlSource: string;
    callbackSecretSet: boolean;
    ipWhitelistConfigured: boolean;
    gameCatalogImported: boolean;
    callbackReceived: boolean;
    transactionProcessed: boolean;
    duplicateProtectionTested: boolean;
  };
  counts: { callbacks: number; accepted: number; duplicates: number; games: number; activeGames: number };
  lastCallback: { receivedAt: string; ip: string | null; callbackKeyValid: boolean | null; error: string | null } | null;
}

function HealthPanel({ providerId }: { providerId: string }) {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSim, setOpenSim] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/providers/${providerId}/health-check`, { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      setData(j as HealthPayload);
    } finally { setLoading(false); }
  }, [providerId]);
  useEffect(() => { load(); }, [load]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard may be unavailable */ }
  };

  const urlSuspect = data && (!data.checks.baseUrlIsHttps || !data.checks.baseUrlIsPublic);

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-hi inline-flex items-center gap-2"><Activity className="h-4 w-4 text-gold-300" /> Callback readiness</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={load}>Reload</Button>
          <Button size="sm" variant="neon" leftIcon={<PlayCircle className="h-3.5 w-3.5" />} onClick={() => setOpenSim(true)}>Simulate callback</Button>
        </div>
      </div>

      {data ? (
        <>
          <Card padding="sm" className={cn('border-l-4', urlSuspect ? 'border-rose-400/60' : 'border-emerald-400/60')}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">URLs sent to provider</p>
            <div className="mt-2 space-y-2 text-xs">
              <UrlRow label="Callback" value={data.urls.callbackUrl} suspect={urlSuspect} onCopy={() => copy('callback', data.urls.callbackUrl)} copied={copied === 'callback'} />
              <UrlRow label="Return" value={data.urls.returnUrl} suspect={urlSuspect} onCopy={() => copy('return', data.urls.returnUrl)} copied={copied === 'return'} />
              <p className="text-[10px] text-ink-lo">Source: <span className="font-mono">{data.urls.baseUrlSource}</span> . Base: <span className="font-mono">{data.urls.baseUrl}</span></p>
            </div>
            {urlSuspect ? (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-200">
                <AlertTriangle className="h-3.5 w-3.5" /> Base URL is not HTTPS or points at a private host. The provider cannot reach this URL. Set Public base URL above to your production domain.
              </p>
            ) : null}
          </Card>

          <Card padding="sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Checklist</p>
            <ul className="mt-2 grid gap-1 text-[12px] md:grid-cols-2">
              <CheckRow label="Callback URL is HTTPS" ok={data.checks.baseUrlIsHttps} />
              <CheckRow label="Callback URL is public host" ok={data.checks.baseUrlIsPublic} />
              <CheckRow label="Callback secret set" ok={data.checks.callbackSecretSet} />
              <CheckRow label="IP whitelist configured" ok={data.checks.ipWhitelistConfigured} optional />
              <CheckRow label={`Game catalog imported (${data.counts.games}${data.counts.activeGames ? ` . ${data.counts.activeGames} active` : ''})`} ok={data.checks.gameCatalogImported} />
              <CheckRow label={`Callback received (${data.counts.callbacks})`} ok={data.checks.callbackReceived} />
              <CheckRow label={`Transaction processed (${data.counts.accepted})`} ok={data.checks.transactionProcessed} />
              <CheckRow label={`Duplicate protection tested (${data.counts.duplicates})`} ok={data.checks.duplicateProtectionTested} optional />
              <CheckRow label={`Provider is Live`} ok={data.providerActive} optional />
            </ul>
            {data.lastCallback ? (
              <p className="mt-2 text-[10px] text-ink-lo">
                Last callback {new Date(data.lastCallback.receivedAt).toLocaleString()} from <span className="font-mono">{data.lastCallback.ip ?? '-'}</span>
                {data.lastCallback.error ? <> . <span className="text-rose-300">{data.lastCallback.error}</span></> : null}
              </p>
            ) : <p className="mt-2 text-[10px] text-ink-lo">No callbacks logged yet. Run Simulate callback or wait for real provider traffic.</p>}
          </Card>
        </>
      ) : <p className="text-sm text-ink-mid">{loading ? 'Loading checklist...' : 'No data.'}</p>}

      <SimulateCallbackModal open={openSim} onOpenChange={setOpenSim} providerId={providerId} onDone={load} />
    </div>
  );
}

function UrlRow({ label, value, suspect, onCopy, copied }: { label: string; value: string; suspect: boolean | null | undefined; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</span>
      <code className={cn('grow break-all rounded border px-2 py-1 font-mono text-[11px]', suspect ? 'border-rose-400/40 bg-rose-500/10 text-rose-100' : 'border-neon/15 bg-base-panel/60 text-ink-mid')}>{value}</code>
      <Button size="sm" variant="ghost" leftIcon={copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  );
}

function CheckRow({ label, ok, optional }: { label: string; ok: boolean; optional?: boolean }) {
  const tone = ok ? 'text-emerald-300' : optional ? 'text-amber-300' : 'text-rose-300';
  const Icon = ok ? Check : optional ? AlertTriangle : AlertCircle;
  return (
    <li className={cn('inline-flex items-center gap-2', tone)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </li>
  );
}

interface SimulateResult {
  gameRound: string;
  memberAccount: string;
  callbackBody: Record<string, unknown>;
  callbackResponse: { status: number; body: unknown };
  result: {
    status: 'accepted' | 'duplicate' | 'rejected';
    errorCode?: string;
    providerTxId: string;
    walletBefore: number;
    walletAfter: number;
    netResult: number;
  };
  testUser: { id: string; username: string };
}

function SimulateCallbackModal({ open, onOpenChange, providerId, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; providerId: string; onDone: () => void }) {
  const [gameUid, setGameUid] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [betAmount, setBetAmount] = useState('10');
  const [winAmount, setWinAmount] = useState('0');
  const [gameRound, setGameRound] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateResult | null>(null);

  useEffect(() => {
    if (!open) { setGameUid(''); setUserQuery(''); setBetAmount('10'); setWinAmount('0'); setGameRound(''); setErr(null); setResult(null); }
  }, [open]);

  const onRun = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const body: Record<string, unknown> = {
        gameUid: gameUid.trim(),
        betAmount: Number(betAmount) || 0,
        winAmount: Number(winAmount) || 0,
      };
      if (userQuery.trim()) body.userQuery = userQuery.trim();
      if (gameRound.trim()) body.gameRound = gameRound.trim();
      const r = await fetch(`/api/admin/providers/${providerId}/simulate-callback`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.message ?? j?.code ?? 'Simulate failed'); return; }
      setResult(j as SimulateResult);
      // Auto-fill gameRound so the operator can immediately re-run to test the duplicate path.
      if (j?.gameRound) setGameRound(j.gameRound);
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Simulate failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Simulate provider callback"
      description="Builds a callback body the provider would send and runs it through the live wallet pipeline. Idempotency, blocked users and mapping checks all apply."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="gold" loading={busy} leftIcon={<PlayCircle className="h-3.5 w-3.5" />} onClick={onRun}>Run simulation</Button>
        </>
      }
    >
      <Card padding="sm" className="mb-3 border-l-4 border-amber-400/60">
        <p className="text-[11px] font-semibold text-ink-mid">
          Simulation moves real money in the test user's wallet. Use a sandbox user or re-run with the same Game round value to exercise the duplicate-protection path without spending more.
        </p>
      </Card>

      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Game UID"><input value={gameUid} onChange={(e) => setGameUid(e.target.value)} className={inputCls} placeholder="784512" /></Field>
        <Field label="Test user (id / username / phone / email)"><input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} className={inputCls} placeholder="defaults to you" /></Field>
        <Field label="Bet amount"><input type="number" min={0} step="0.01" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className={inputCls} /></Field>
        <Field label="Win amount"><input type="number" min={0} step="0.01" value={winAmount} onChange={(e) => setWinAmount(e.target.value)} className={inputCls} /></Field>
        <Field label="Game round (blank = new)">
          <input value={gameRound} onChange={(e) => setGameRound(e.target.value)} className={inputCls} placeholder="auto" />
        </Field>
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          <Card padding="sm" className={cn('border-l-4', result.result.status === 'accepted' ? 'border-emerald-400/60' : result.result.status === 'duplicate' ? 'border-amber-400/60' : 'border-rose-400/60')}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Wallet pipeline</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Totals label="Status" value={result.result.status + (result.result.errorCode ? ` (${result.result.errorCode})` : '')} />
              <Totals label="Round" value={result.gameRound} />
              <Totals label="Member" value={result.memberAccount} />
              <Totals label="Tester" value={result.testUser.username} />
              <Totals label="Wallet before" value={fmt(result.result.walletBefore)} />
              <Totals label="Wallet after" value={fmt(result.result.walletAfter)} positive={result.result.walletAfter >= result.result.walletBefore} />
              <Totals label="Net" value={fmt(result.result.netResult)} positive={result.result.netResult >= 0} />
              <Totals label="Provider tx" value={result.result.providerTxId} />
            </div>
          </Card>
          <Card padding="sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Callback body sent</p>
            <pre className="mt-1 max-h-40 overflow-auto rounded border border-neon/10 bg-black/40 p-2 text-[10px] text-ink-mid">{JSON.stringify(result.callbackBody, null, 2)}</pre>
          </Card>
          <Card padding="sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Callback response returned</p>
            <pre className="mt-1 max-h-40 overflow-auto rounded border border-neon/10 bg-black/40 p-2 text-[10px] text-ink-mid">{JSON.stringify(result.callbackResponse, null, 2)}</pre>
          </Card>
          <p className="text-[11px] text-ink-mid">Tip: keep this modal open and click <strong>Run simulation</strong> again to re-send the same Game round - the status should flip to <strong>duplicate</strong> and the wallet should not move.</p>
        </div>
      ) : null}
    </Modal>
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

interface GameRow { id: string; gameUid: string; brandId: string | null; displayName: string; category: string | null; imageUrl: string | null; status: string; lastSyncAt: string | null }
interface GamesCounts { total: number; filtered: number; byStatus: Record<string, number>; byCategory: Record<string, number> }

function GamesPanel({ providerId }: { providerId: string }) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [counts, setCounts] = useState<GamesCounts | null>(null);
  const [brandKey, setBrandKey] = useState('');
  const [filterBrandId, setFilterBrandId] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; snippet?: string } | null>(null);
  const [previewSample, setPreviewSample] = useState<Array<{ gameUid: string; displayName: string }> | null>(null);
  const [openManual, setOpenManual] = useState(false);
  const [testGame, setTestGame] = useState<GameRow | null>(null);
  const [editGame, setEditGame] = useState<GameRow | null>(null);

  // Debounce the search field so we are not hammering the API
  // on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const loadBrands = useCallback(async () => {
    const r = await fetch(`/api/admin/providers/${providerId}/brands`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    const list = Array.isArray(j?.brands) ? (j.brands as BrandRow[]) : [];
    setBrands(list);
    if (!brandKey && list.length === 1) setBrandKey(list[0].brandKey);
  }, [providerId, brandKey]);
  const loadGames = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterBrandId) params.set('brandId', filterBrandId);
    if (filterCategory) params.set('category', filterCategory);
    if (filterStatus) params.set('status', filterStatus);
    if (debouncedQ) params.set('q', debouncedQ);
    params.set('limit', '300');
    const r = await fetch(`/api/admin/providers/${providerId}/games?${params.toString()}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    setGames(Array.isArray(j?.games) ? (j.games as GameRow[]) : []);
    setCounts((j?.counts as GamesCounts) ?? null);
    setSelectedIds(new Set());
  }, [providerId, filterBrandId, filterCategory, filterStatus, debouncedQ]);
  useEffect(() => { loadBrands(); }, [loadBrands]);
  useEffect(() => { loadGames(); }, [loadGames]);

  const toggleSel = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(games.map((g) => g.id)));
  const clearSel = () => setSelectedIds(new Set());

  const onBulkStatus = async (status: 'active' | 'maintenance' | 'hidden') => {
    if (selectedIds.size === 0) return;
    setBusy(true); setErr(null); setInfo(null);
    try {
      const r = await fetch(`/api/admin/providers/${providerId}/games/bulk-status`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr({ msg: j?.message ?? j?.code ?? 'Bulk update failed' }); return; }
      setInfo(`Bulk status -> ${status}: updated ${j?.updated ?? 0}, skipped ${j?.skipped ?? 0}.`);
      loadGames();
    } catch (e) { setErr({ msg: e instanceof Error ? e.message : 'Bulk update failed' }); }
    finally { setBusy(false); }
  };

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

      {counts ? (
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Totals label="Total" value={String(counts.total)} />
          <Totals label="Active" value={String(counts.byStatus.active ?? 0)} positive={(counts.byStatus.active ?? 0) > 0} />
          <Totals label="Maintenance" value={String(counts.byStatus.maintenance ?? 0)} />
          <Totals label="Hidden" value={String(counts.byStatus.hidden ?? 0)} />
        </div>
      ) : null}

      {counts && Object.keys(counts.byCategory).length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
          {Object.entries(counts.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              className={cn(
                'rounded-full border px-3 py-1 font-semibold transition',
                filterCategory === cat ? 'border-gold-400/60 bg-gold-400/20 text-gold-100' : 'border-neon/15 bg-base-panel/40 text-ink-mid hover:border-neon/40'
              )}
            >
              {cat} ({n})
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative grow">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">Search</label>
          <Search className="absolute left-3 top-9 h-3.5 w-3.5 text-ink-lo" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className={cn(inputCls, 'mt-1 pl-9')} placeholder="Name or gameUid" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">Brand</label>
          <select value={filterBrandId} onChange={(e) => setFilterBrandId(e.target.value)} className={cn(inputCls, 'mt-1 w-auto')}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.displayName} ({b.gameCount})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">Category</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={cn(inputCls, 'mt-1 w-auto')}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={cn(inputCls, 'mt-1 w-auto')}>
            <option value="">All</option>
            <option value="active">active</option>
            <option value="maintenance">maintenance</option>
            <option value="hidden">hidden</option>
          </select>
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <Card padding="sm" className="mb-3 border-l-4 border-gold-400/60">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-gold-200">{selectedIds.size} selected</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="neon" loading={busy} onClick={() => onBulkStatus('active')}>Mark active</Button>
              <Button size="sm" variant="ghost" loading={busy} onClick={() => onBulkStatus('maintenance')}>Mark maintenance</Button>
              <Button size="sm" variant="ghost" loading={busy} onClick={() => onBulkStatus('hidden')}>Mark hidden</Button>
              <Button size="sm" variant="ghost" onClick={clearSel}>Clear</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {games.length === 0 ? (
        <p className="text-sm text-ink-mid">No games yet. Use Add Manual Game, run the JILI importer on the VPS, or Preview + Sync from a brand.</p>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-ink-lo">
            <input
              type="checkbox"
              checked={games.length > 0 && selectedIds.size === games.length}
              onChange={(e) => (e.target.checked ? selectAll() : clearSel())}
              className="h-3.5 w-3.5 rounded border-neon/30 bg-base-panel"
              aria-label="Select all"
            />
            <span>Showing {games.length}{counts ? ` of ${counts.total}` : ''}</span>
          </div>
          <ul className="grid gap-1 md:grid-cols-2">
            {games.map((g) => (
              <li key={g.id} className={cn('flex items-center gap-2 rounded-lg border bg-base-panel/40 px-3 py-2 text-sm', selectedIds.has(g.id) ? 'border-gold-400/60' : 'border-neon/10')}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(g.id)}
                  onChange={() => toggleSel(g.id)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-neon/30 bg-base-panel"
                  aria-label={`Select ${g.displayName}`}
                />
                <GameThumb game={g} />
                <div className="min-w-0 grow">
                  <p className="truncate font-semibold text-ink-hi">{g.displayName}</p>
                  <p className="font-mono text-[10px] text-ink-lo">{g.gameUid}{g.category ? ` . ${g.category}` : ''}</p>
                </div>
                <Chip tone={g.status === 'active' ? 'ok' : g.status === 'maintenance' ? 'warn' : 'neutral'}>{g.status}</Chip>
                <Button size="sm" variant="ghost" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={() => setEditGame(g)}>Edit</Button>
                <Button size="sm" variant="ghost" leftIcon={<Zap className="h-3.5 w-3.5" />} onClick={() => setTestGame(g)}>Test</Button>
              </li>
            ))}
          </ul>
        </>
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
      <EditGameModal
        open={!!editGame}
        onOpenChange={(v) => { if (!v) setEditGame(null); }}
        providerId={providerId}
        brands={brands}
        game={editGame}
        onDone={(msg) => { setEditGame(null); setInfo(msg); loadGames(); }}
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
  const [category, setCategory] = useState<string>('slots');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'maintenance'>('active');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [bulkData, setBulkData] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode('single'); setBrandKey(''); setGameUid(''); setDisplayName('');
      setCategory('slots'); setImageUrl(''); setStatus('active');
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
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
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
  testUser: { id: string; username: string; phone: string; email: string | null };
  providerMemberAccount: string;
  timestamp?: { timestampSent: number | null; serverNow: number | null; ageMs: number | null; offsetMs: number };
  urls?: { callbackUrl: string; returnUrl: string; baseUrl: string; baseUrlSource: string; isHttps: boolean; isPrivateHost: boolean };
  maskedResponse: unknown;
}

function EditGameModal({ open, onOpenChange, providerId, brands, game, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  brands: BrandRow[];
  game: GameRow | null;
  onDone: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState<string>('slots');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'maintenance' | 'hidden'>('active');
  const [brandKey, setBrandKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !game) return;
    setDisplayName(game.displayName);
    setCategory(normalizeCategory(game.category ?? '') as string);
    setImageUrl(game.imageUrl ?? '');
    setStatus((game.status === 'maintenance' || game.status === 'hidden') ? game.status : 'active');
    const currentBrand = brands.find((b) => b.id === game.brandId);
    setBrandKey(currentBrand?.brandKey ?? '');
    setErr(null);
  }, [open, game, brands]);

  const onSave = async () => {
    if (!game) return;
    if (!displayName.trim()) { setErr('Display name is required.'); return; }
    setBusy(true); setErr(null);
    try {
      const body = {
        displayName: displayName.trim(),
        category,
        imageUrl: imageUrl.trim(),
        status,
        brandKey: brandKey.trim(),
      };
      const r = await fetch(`/api/admin/providers/${providerId}/games/${game.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.message ?? j?.code ?? 'Save failed'); return; }
      onDone(`Updated ${displayName.trim()}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={game ? `Edit ${game.displayName}` : 'Edit game'}
      description="Updates the row in ExternalGame. Provider catalog re-sync would overwrite manual edits with the upstream values; manual rows are stable."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Save changes</Button>
        </>
      }
    >
      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}

      <div className="space-y-3">
        <p className="text-[11px] text-ink-mid">Game UID: <span className="font-mono text-ink-hi">{game?.gameUid ?? '-'}</span></p>
        <Field label="Display name"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} /></Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Image URL"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputCls} placeholder="https://..." /></Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'maintenance' | 'hidden')} className={inputCls}>
            <option value="active">active</option>
            <option value="maintenance">maintenance</option>
            <option value="hidden">hidden</option>
          </select>
        </Field>
        <Field label="Brand (optional)">
          <select value={brandKey} onChange={(e) => setBrandKey(e.target.value)} className={inputCls}>
            <option value="">- unassigned -</option>
            {brands.map((b) => <option key={b.id} value={b.brandKey}>{b.displayName} ({b.brandKey})</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function TestLaunchModal({ open, onOpenChange, providerId, game }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  game: GameRow | null;
}) {
  const [userQuery, setUserQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; snippet?: string } | null>(null);
  const [result, setResult] = useState<TestLaunchResult | null>(null);

  useEffect(() => {
    if (!open) { setUserQuery(''); setErr(null); setResult(null); setBusy(false); }
  }, [open]);

  const onRun = async () => {
    if (!game) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const body: Record<string, unknown> = { gameUid: game.gameUid };
      if (userQuery.trim()) body.userQuery = userQuery.trim();
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
      <Card padding="sm" className="mb-3 border-l-4 border-amber-400/60">
        <p className="text-[11px] font-semibold text-ink-mid">
          Provider requires a numeric member account. The internal user ID is mapped securely server-side to a stable 10-digit account and reused forever for callbacks.
        </p>
      </Card>

      {err ? (
        <div className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <p className="font-semibold">{err.msg}</p>
          {err.snippet ? <pre className="mt-2 max-h-24 overflow-auto rounded border border-rose-400/20 bg-black/40 p-2 text-[10px] text-rose-100/85">{err.snippet}</pre> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-[11px] text-ink-mid">Game UID: <span className="font-mono text-ink-hi">{game?.gameUid ?? '-'}</span></p>
        <Field label="Test user (id, username, phone or email - defaults to you)">
          <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} className={inputCls} placeholder="username, +8801..., email or cuid" />
        </Field>
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          <Card padding="sm" className="border-l-4 border-emerald-400/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Launch URL</p>
            <p className="mt-1 break-all font-mono text-[11px] text-emerald-200">{result.launchUrl}</p>
          </Card>
          <Card padding="sm" className="border-l-4 border-gold-400/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Provider user_id sent</p>
            <p className="mt-1 font-mono text-base font-extrabold text-gold-200">{result.providerMemberAccount}</p>
            <p className="mt-1 text-[10px] text-ink-lo">Internal user: <span className="font-mono text-ink-mid">{result.testUser.username}</span> ({result.testUser.id})</p>
          </Card>
          {result.urls ? (
            <Card padding="sm" className={cn('border-l-4', !result.urls.isHttps || result.urls.isPrivateHost ? 'border-rose-400/60' : 'border-neon/30')}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Callback / return URLs the provider received</p>
              <p className="mt-1 break-all font-mono text-[11px] text-ink-mid">Callback: {result.urls.callbackUrl}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-ink-mid">Return:   {result.urls.returnUrl}</p>
              <p className="mt-1 text-[10px] text-ink-lo">source: {result.urls.baseUrlSource} . https: {String(result.urls.isHttps)} . private host: {String(result.urls.isPrivateHost)}</p>
              {!result.urls.isHttps || result.urls.isPrivateHost ? <p className="mt-2 text-[11px] font-semibold text-rose-200">These URLs are NOT reachable by the provider in production. Set Public base URL in Setup before going live.</p> : null}
            </Card>
          ) : null}
          {result.timestamp ? <TimestampPanel diag={result.timestamp} /> : null}
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

interface TxRow {
  id: string;
  createdAt: string;
  userId: string | null;
  memberAccount: string;
  gameUid: string | null;
  gameRound: string;
  betAmount: number;
  winAmount: number;
  netResult: number;
  type: string;
  status: string;
  errorCode: string | null;
  rolledBackAt?: string | null;
  rolledBackBy?: string | null;
  rollbackReason?: string | null;
}
interface TxResp { rows: TxRow[]; totals: { rounds: number; totalBet: number; totalWin: number; netResult: number; ggr: number } }

function TransactionsPanel({ providerId }: { providerId: string }) {
  const [data, setData] = useState<TxResp | null>(null);
  const [rollback, setRollback] = useState<TxRow | null>(null);
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
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-base-elev text-left text-[11px] uppercase tracking-wider text-ink-lo">
            <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Member</th><th className="px-3 py-2">Game</th><th className="px-3 py-2">Round</th><th className="px-3 py-2">Bet</th><th className="px-3 py-2">Win</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action</th></tr>
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
                <td className="px-3 py-2">
                  <Chip tone={r.status === 'accepted' ? 'ok' : r.status === 'duplicate' ? 'info' : r.status === 'rolled_back' ? 'warn' : 'danger'}>{r.status}</Chip>
                </td>
                <td className="px-3 py-2">
                  {r.status === 'accepted' ? (
                    <Button size="sm" variant="ghost" leftIcon={<AlertTriangle className="h-3.5 w-3.5" />} onClick={() => setRollback(r)}>Rollback</Button>
                  ) : r.status === 'rolled_back' ? (
                    <span className="text-[10px] text-ink-lo" title={r.rollbackReason ?? ''}>{r.rolledBackAt ? new Date(r.rolledBackAt).toLocaleString() : 'rolled back'}</span>
                  ) : null}
                </td>
              </tr>
            ))}
            {(data?.rows ?? []).length === 0 ? <tr><td colSpan={9} className="px-3 py-4 text-center text-ink-mid">No transactions yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <RollbackModal
        open={!!rollback}
        onOpenChange={(v) => { if (!v) setRollback(null); }}
        providerId={providerId}
        tx={rollback}
        onDone={() => { setRollback(null); load(); }}
      />
    </Card>
  );
}

function RollbackModal({ open, onOpenChange, providerId, tx, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  tx: TxRow | null;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ walletBefore: number; walletAfter: number; adjustDelta: number } | null>(null);

  useEffect(() => { if (!open) { setReason(''); setErr(null); setResult(null); setBusy(false); } }, [open]);

  const onRun = async () => {
    if (!tx) return;
    if (reason.trim().length < 3) { setErr('Reason is required.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/providers/${providerId}/transactions/${tx.id}/rollback`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.message ?? j?.code ?? 'Rollback failed'); return; }
      setResult({
        walletBefore: Number(j?.walletBefore ?? 0),
        walletAfter: Number(j?.walletAfter ?? 0),
        adjustDelta: Number(j?.adjustDelta ?? 0),
      });
      setTimeout(() => onDone(), 1200);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Rollback failed'); }
    finally { setBusy(false); }
  };

  const impact = tx ? tx.winAmount - tx.betAmount : 0;
  const rollbackDelta = -impact;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={tx ? `Rollback round ${tx.gameRound}` : 'Rollback'}
      description="This reverses the wallet effect inside Pasha 9 only. Provider-side rollback is not confirmed."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" loading={busy} leftIcon={<AlertTriangle className="h-3.5 w-3.5" />} onClick={onRun}>Confirm rollback</Button>
        </>
      }
    >
      <Card padding="sm" className="mb-3 border-l-4 border-rose-400/60">
        <p className="text-[11px] font-semibold text-ink-mid">
          Super-admin only. Writes one adjust Transaction row reversing the net wallet delta and flags this ProviderTransaction as rolled_back. We never call the provider's rollback API.
        </p>
      </Card>

      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}

      {tx ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <Totals label="Bet" value={fmt(tx.betAmount)} />
            <Totals label="Win" value={fmt(tx.winAmount)} />
            <Totals label="Original impact" value={fmt(impact)} positive={impact >= 0} />
            <Totals label="Rollback delta" value={fmt(rollbackDelta)} positive={rollbackDelta >= 0} />
          </div>
          <Field label="Reason (required, kept in activity log)">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={cn(inputCls, 'h-auto py-2')} placeholder="e.g. provider replay caused duplicate debit" />
          </Field>
        </div>
      ) : null}

      {result ? (
        <Card padding="sm" className="mt-4 border-l-4 border-emerald-400/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Rollback applied</p>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <Totals label="Wallet before" value={fmt(result.walletBefore)} />
            <Totals label="Wallet after" value={fmt(result.walletAfter)} positive={result.walletAfter >= result.walletBefore} />
            <Totals label="Delta" value={fmt(result.adjustDelta)} positive={result.adjustDelta >= 0} />
          </div>
        </Card>
      ) : null}
    </Modal>
  );
}

function TimestampPanel({ diag }: { diag: { timestampSent: number | null; serverNow: number | null; ageMs: number | null; offsetMs: number } }) {
  const sent = diag.timestampSent;
  const now = diag.serverNow;
  const age = diag.ageMs;
  const offset = diag.offsetMs;
  const clockSuspect = sent != null && (sent < 1_600_000_000_000 || sent > 4_000_000_000_000);
  const drift = age != null && Math.abs(age) > 1_500;
  const tone = clockSuspect || drift ? 'border-rose-400/60' : 'border-neon/30';
  const fmtTs = (n: number | null) => n == null ? '-' : `${n} (${new Date(n).toISOString()})`;
  return (
    <Card padding="sm" className={cn('border-l-4', tone)}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Launch timestamp</p>
      <div className="mt-1 grid grid-cols-1 gap-1 text-[11px] text-ink-mid md:grid-cols-2">
        <div><span className="text-ink-lo">timestampSent:</span> <span className="font-mono text-ink-hi">{fmtTs(sent)}</span></div>
        <div><span className="text-ink-lo">serverNow:</span> <span className="font-mono text-ink-hi">{fmtTs(now)}</span></div>
        <div><span className="text-ink-lo">ageMs:</span> <span className="font-mono text-ink-hi">{age == null ? '-' : age}</span></div>
        <div><span className="text-ink-lo">offsetMs:</span> <span className="font-mono text-ink-hi">{offset}</span></div>
      </div>
      {clockSuspect ? <p className="mt-2 text-[11px] font-semibold text-rose-200">VPS clock is far outside the expected range. Check NTP / chrony immediately.</p> : null}
      {drift && !clockSuspect ? <p className="mt-2 text-[11px] font-semibold text-rose-200">Local ageMs &gt; 1500ms - investigate request slowdown.</p> : null}
    </Card>
  );
}

function GameThumb({ game }: { game: GameRow }) {
  const [failed, setFailed] = useState(false);
  if (game.imageUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={game.imageUrl} alt={game.displayName} onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-md border border-neon/15 bg-base-panel object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neon/15 bg-gradient-to-br from-base-deep to-base-panel">
      <ImageOff className="h-4 w-4 text-ink-lo" />
    </div>
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

interface ReportPayload {
  totals: { rounds: number; totalBet: number; totalWin: number; netResult: number; ggr: number };
  byStatus: Record<string, number>;
  daily: Array<{ day: string; rounds: number; totalBet: number; totalWin: number; netResult: number; ggr: number }>;
  topGames: Array<{ gameUid: string; displayName: string; category: string | null; rounds: number; totalBet: number; totalWin: number; netResult: number; ggr: number }>;
  topUsers: Array<{ userId: string; username: string; rounds: number; totalBet: number; totalWin: number; netResult: number; ggr: number }>;
  byCategory: Record<string, { rounds: number; totalBet: number; totalWin: number; ggr: number }>;
}

function isoDay(d: Date): string { return d.toISOString().slice(0, 10); }

function ReportsPanel({ providerId }: { providerId: string }) {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDay(sevenDaysAgo));
  const [to, setTo] = useState(isoDay(today));
  const [gameUid, setGameUid] = useState('');
  const [userIdQ, setUserIdQ] = useState('');
  const [category, setCategory] = useState('');
  const [data, setData] = useState<ReportPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buildQs = useCallback((extra?: Record<string, string>): string => {
    const p = new URLSearchParams();
    if (from) p.set('from', new Date(from).toISOString());
    if (to) p.set('to', new Date(`${to}T23:59:59`).toISOString());
    if (gameUid.trim()) p.set('gameUid', gameUid.trim());
    if (userIdQ.trim()) p.set('userId', userIdQ.trim());
    if (category) p.set('category', category);
    if (extra) for (const k of Object.keys(extra)) p.set(k, extra[k]);
    return p.toString();
  }, [from, to, gameUid, userIdQ, category]);

  const load = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/providers/${providerId}/reports?${buildQs()}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.message ?? j?.code ?? 'Report failed'); return; }
      setData(j as ReportPayload);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Report failed'); }
    finally { setBusy(false); }
  }, [providerId, buildQs]);
  useEffect(() => { load(); }, [load]);

  const onCsv = () => {
    const qs = buildQs({ format: 'csv' });
    window.location.href = `/api/admin/providers/${providerId}/reports?${qs}`;
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Reports"
        subtitle="Aggregated accepted transactions across the selected date range."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />} onClick={load}>Reload</Button>
            <Button size="sm" variant="neon" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={onCsv}>Export CSV</Button>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
        <Field label="Game UID (optional)"><input value={gameUid} onChange={(e) => setGameUid(e.target.value)} className={inputCls} placeholder="any" /></Field>
        <Field label="User id (optional)"><input value={userIdQ} onChange={(e) => setUserIdQ(e.target.value)} className={inputCls} placeholder="any" /></Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="">All</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}

      {data ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Totals label="Rounds" value={String(data.totals.rounds)} />
            <Totals label="Total bet" value={fmt(data.totals.totalBet)} />
            <Totals label="Total win" value={fmt(data.totals.totalWin)} />
            <Totals label="Net" value={fmt(data.totals.netResult)} positive={data.totals.netResult >= 0} />
            <Totals label="GGR" value={fmt(data.totals.ggr)} positive={data.totals.ggr >= 0} />
          </div>

          {Object.keys(data.byStatus).length > 0 ? (
            <Card padding="sm" className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">By status</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {Object.entries(data.byStatus).map(([s, n]) => (
                  <Chip key={s} tone={s === 'accepted' ? 'ok' : s === 'duplicate' ? 'info' : s === 'rolled_back' ? 'warn' : 'danger'}>{s} ({n})</Chip>
                ))}
              </div>
            </Card>
          ) : null}

          {data.daily.length > 0 ? (
            <Card padding="sm" className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Daily series</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[600px] text-xs">
                  <thead className="text-ink-lo">
                    <tr><th className="px-2 py-1 text-left">Day</th><th className="px-2 py-1 text-right">Rounds</th><th className="px-2 py-1 text-right">Bet</th><th className="px-2 py-1 text-right">Win</th><th className="px-2 py-1 text-right">Net</th><th className="px-2 py-1 text-right">GGR</th></tr>
                  </thead>
                  <tbody className="divide-y divide-neon/10">
                    {data.daily.map((d) => (
                      <tr key={d.day}>
                        <td className="px-2 py-1 text-ink-mid">{d.day}</td>
                        <td className="px-2 py-1 text-right">{d.rounds}</td>
                        <td className="px-2 py-1 text-right">{fmt(d.totalBet)}</td>
                        <td className="px-2 py-1 text-right">{fmt(d.totalWin)}</td>
                        <td className="px-2 py-1 text-right">{fmt(d.netResult)}</td>
                        <td className="px-2 py-1 text-right">{fmt(d.ggr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {data.topGames.length > 0 ? (
            <Card padding="sm" className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Top games</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[600px] text-xs">
                  <thead className="text-ink-lo">
                    <tr><th className="px-2 py-1 text-left">Game</th><th className="px-2 py-1 text-left">Cat</th><th className="px-2 py-1 text-right">Rounds</th><th className="px-2 py-1 text-right">Bet</th><th className="px-2 py-1 text-right">Win</th><th className="px-2 py-1 text-right">GGR</th></tr>
                  </thead>
                  <tbody className="divide-y divide-neon/10">
                    {data.topGames.map((g) => (
                      <tr key={g.gameUid}>
                        <td className="px-2 py-1"><span className="text-ink-hi">{g.displayName}</span> <span className="ml-1 font-mono text-[10px] text-ink-lo">{g.gameUid}</span></td>
                        <td className="px-2 py-1 text-ink-mid">{g.category ?? '-'}</td>
                        <td className="px-2 py-1 text-right">{g.rounds}</td>
                        <td className="px-2 py-1 text-right">{fmt(g.totalBet)}</td>
                        <td className="px-2 py-1 text-right">{fmt(g.totalWin)}</td>
                        <td className="px-2 py-1 text-right">{fmt(g.ggr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {data.topUsers.length > 0 ? (
            <Card padding="sm" className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Top users</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[600px] text-xs">
                  <thead className="text-ink-lo">
                    <tr><th className="px-2 py-1 text-left">User</th><th className="px-2 py-1 text-right">Rounds</th><th className="px-2 py-1 text-right">Bet</th><th className="px-2 py-1 text-right">Win</th><th className="px-2 py-1 text-right">GGR</th></tr>
                  </thead>
                  <tbody className="divide-y divide-neon/10">
                    {data.topUsers.map((u) => (
                      <tr key={u.userId}>
                        <td className="px-2 py-1"><span className="text-ink-hi">{u.username}</span> <span className="ml-1 font-mono text-[10px] text-ink-lo">{u.userId}</span></td>
                        <td className="px-2 py-1 text-right">{u.rounds}</td>
                        <td className="px-2 py-1 text-right">{fmt(u.totalBet)}</td>
                        <td className="px-2 py-1 text-right">{fmt(u.totalWin)}</td>
                        <td className="px-2 py-1 text-right">{fmt(u.ggr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {Object.keys(data.byCategory).length > 0 ? (
            <Card padding="sm" className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">By category (top games sum)</p>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                {Object.entries(data.byCategory).map(([cat, v]) => (
                  <div key={cat} className="rounded-lg border border-neon/10 bg-base-panel/40 p-2 text-[11px]">
                    <div className="font-semibold text-ink-hi">{cat}</div>
                    <div className="text-ink-mid">{v.rounds} rounds . GGR {fmt(v.ggr)}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
