// Built by Anointed Coder.
//
// Admin WhatsApp settings. Stores Meta Cloud API / third-party
// gateway credentials so a future adapter can pick them up.
//
// No adapter is wired today: even with credentials saved, the
// integrations tile flips to "Configured" but does NOT claim "Live"
// because we cannot prove a real outbound message was delivered.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { MessageCircle, Save, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ProviderType = 'meta_cloud' | 'gateway' | 'manual';

interface SettingMap {
  whatsapp_enabled: { value: string };
  whatsapp_provider_type: { value: string };
  whatsapp_phone_number_id: { value: string };
  whatsapp_waba_id: { value: string };
  whatsapp_default_support_number: { value: string };
  whatsapp_access_token: { value: string; masked?: { set: boolean; preview: string } };
  whatsapp_verify_token: { value: string; masked?: { set: boolean; preview: string } };
}

export default function AdminWhatsappPage() {
  const [data, setData] = useState<SettingMap | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [providerType, setProviderType] = useState<ProviderType>('manual');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [supportNumber, setSupportNumber] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/whatsapp/settings', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? `HTTP ${r.status}`);
      const settings = (j?.settings ?? {}) as SettingMap;
      setData(settings);
      setEnabled(settings.whatsapp_enabled?.value === '1');
      const pt = settings.whatsapp_provider_type?.value;
      setProviderType((pt === 'meta_cloud' || pt === 'gateway' || pt === 'manual') ? pt : 'manual');
      setPhoneNumberId(settings.whatsapp_phone_number_id?.value ?? '');
      setWabaId(settings.whatsapp_waba_id?.value ?? '');
      setSupportNumber(settings.whatsapp_default_support_number?.value ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onSave = async () => {
    setBusy(true); setError(null);
    try {
      const updates: Array<{ key: string; value: string }> = [
        { key: 'whatsapp_enabled', value: enabled ? '1' : '0' },
        { key: 'whatsapp_provider_type', value: providerType },
        { key: 'whatsapp_phone_number_id', value: phoneNumberId.trim() },
        { key: 'whatsapp_waba_id', value: wabaId.trim() },
        { key: 'whatsapp_default_support_number', value: supportNumber.trim() },
      ];
      // Empty secret fields are deliberately skipped server-side so we
      // do not wipe an existing token on every save.
      if (accessToken.trim()) updates.push({ key: 'whatsapp_access_token', value: accessToken.trim() });
      if (verifyToken.trim()) updates.push({ key: 'whatsapp_verify_token', value: verifyToken.trim() });

      const res = await fetch('/api/admin/whatsapp/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message ?? j?.code ?? `HTTP ${res.status}`);
      flash(`Saved (${j?.updated ?? 0} fields).`);
      setAccessToken(''); setVerifyToken('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  const copy = async (label: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard unavailable */ }
  };

  const hasToken = data?.whatsapp_access_token?.masked?.set ?? false;
  const hasVerifyToken = data?.whatsapp_verify_token?.masked?.set ?? false;
  const status: 'live' | 'configured' | 'pending' = enabled && providerType !== 'manual' && hasToken && phoneNumberId
    ? 'live'
    : (hasToken || phoneNumberId || wabaId)
      ? 'configured'
      : 'pending';
  const statusTone = status === 'live' ? 'ok' : status === 'configured' ? 'info' : 'warn';
  const statusLabel = status === 'live' ? 'Live . credentials configured' : status === 'configured' ? 'Configured' : 'Awaiting credentials';

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/integrations/whatsapp/webhook` : '/api/integrations/whatsapp/webhook';

  return (
    <>
      <PageHeader
        title="WhatsApp"
        subtitle="Store Cloud API or gateway credentials so a future adapter can send messages. No outbound delivery happens yet."
        icon={<MessageCircle className="h-5 w-5" />}
        action={<Button variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>Reload</Button>}
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="inline-flex items-center gap-2 text-sm text-signal-danger"><AlertCircle className="h-4 w-4" /> {error}</p></Card> : null}

      <Card padding="md" className="mb-4 border-l-4 border-amber-400/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-hi">Status</p>
          <Chip tone={statusTone}>{statusLabel}</Chip>
        </div>
        <p className="mt-1 text-[11px] text-ink-mid">
          Pasha 9 does not ship a WhatsApp adapter yet. Saving credentials here lets a future integration pick them up and lets /admin/integrations show the real configured state. Do not present WhatsApp as Live to clients unless a real outbound message has been verified.
        </p>
      </Card>

      <Card padding="lg" className="mb-4">
        <CardHeader title="Provider" subtitle="Pick which type of WhatsApp integration you intend to use." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Enabled">
            <div className="inline-flex rounded-lg border border-neon/15 bg-base-panel p-1 text-xs">
              <button type="button" onClick={() => setEnabled(true)} className={cn('rounded-md px-3 py-1.5 font-semibold transition', enabled ? 'bg-gold-400 text-base-deep' : 'text-ink-mid')}>On</button>
              <button type="button" onClick={() => setEnabled(false)} className={cn('rounded-md px-3 py-1.5 font-semibold transition', !enabled ? 'bg-gold-400 text-base-deep' : 'text-ink-mid')}>Off</button>
            </div>
          </Field>
          <Field label="Provider type">
            <select value={providerType} onChange={(e) => setProviderType(e.target.value as ProviderType)} className={inputCls}>
              <option value="manual">Manual (no automation)</option>
              <option value="meta_cloud">Meta Cloud API</option>
              <option value="gateway">Third-party gateway</option>
            </select>
          </Field>
          <Field label="Default support number">
            <input value={supportNumber} onChange={(e) => setSupportNumber(e.target.value)} className={inputCls} placeholder="+8801xxxxxxxxx" />
          </Field>
          <Field label="Phone number id (Meta Cloud)">
            <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className={inputCls} placeholder="123456789012345" />
          </Field>
          <Field label="WABA id (Meta Business Account)">
            <input value={wabaId} onChange={(e) => setWabaId(e.target.value)} className={inputCls} placeholder="123456789012345" />
          </Field>
        </div>
      </Card>

      <Card padding="lg" className="mb-4">
        <CardHeader
          title="Tokens"
          subtitle="Access token + verify token are encrypted at rest with AES-256-GCM. Empty fields leave the existing token untouched."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Access token ${data?.whatsapp_access_token?.masked?.set ? `(set ${data.whatsapp_access_token.masked.preview})` : '(missing)'}`}>
            <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className={inputCls} placeholder="Leave blank to keep current" />
          </Field>
          <Field label={`Verify token ${data?.whatsapp_verify_token?.masked?.set ? `(set ${data.whatsapp_verify_token.masked.preview})` : '(missing)'}`}>
            <input type="password" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} className={inputCls} placeholder="Leave blank to keep current" />
          </Field>
        </div>
        <p className="mt-2 text-[10px] text-ink-lo">
          Verify token is what Meta uses to validate the webhook handshake. Choose any long random string and paste the same value into the Meta business portal.
        </p>
      </Card>

      <Card padding="lg" className="mb-4">
        <CardHeader title="Webhook URL" subtitle="Configure this in the Meta Business portal (or your gateway) once the adapter is wired." />
        <div className="flex flex-wrap items-center gap-2">
          <code className="grow break-all rounded border border-neon/15 bg-base-panel/60 px-2 py-1 font-mono text-[11px] text-ink-mid">{webhookUrl}</code>
          <Button size="sm" variant="ghost" leftIcon={copied === 'webhook' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => copy('webhook', webhookUrl)}>{copied === 'webhook' ? 'Copied' : 'Copy'}</Button>
        </div>
        <p className="mt-2 text-[10px] text-ink-lo">
          This endpoint does not exist yet. It will be wired when the WhatsApp adapter ships. The URL preview is here so the operator knows the eventual path.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Save settings</Button>
      </div>
    </>
  );
}

const inputCls = 'h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none focus:border-gold-300/60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
