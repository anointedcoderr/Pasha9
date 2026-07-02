// Built by Anointed Coder.
//
// M2I admin console: configure SMS provider + tracking pixels, send
// a test SMS / fire a test event, review the live history of
// NotificationLog + TrackingEvent rows.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { AdminPushToggle } from '@/components/admin/AdminPushToggle';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Bell, RefreshCw, Save, Send, Activity, Wifi, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SmsAdapterRow {
  key: string;
  label: string;
  description: string;
  settingKeys: string[];
  status: 'live' | 'requires_credentials' | 'manual';
  isCurrent: boolean;
}

interface TrackingPlatformRow {
  key: string;
  label: string;
  live: boolean;
  settingKeys: string[];
}

interface NotificationRow {
  id: string;
  channel: string;
  provider: string | null;
  recipient: string;
  template: string | null;
  body: string;
  ok: boolean;
  ref: string | null;
  errorCode: string | null;
  errorBody: string | null;
  createdAt: string;
}

interface EventRow {
  id: string;
  event: string;
  source: string;
  userId: string | null;
  value: number | null;
  currency: string | null;
  reference: string | null;
  results: unknown;
  createdAt: string;
}

interface Snapshot {
  currentSmsProvider: string;
  smsCatalog: SmsAdapterRow[];
  tracking: TrackingPlatformRow[];
  settings: Record<string, string>;
  notifications: NotificationRow[];
  events: EventRow[];
}

const SECRET_KEY = /(token|secret|api_key|api_token|auth_token)/i;

function statusTone(s: string): 'ok' | 'warn' | 'neutral' {
  if (s === 'live') return 'ok';
  if (s === 'requires_credentials') return 'warn';
  return 'neutral';
}

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<'sms' | 'tracking' | 'history'>('sms');

  // Deep-linking: /admin/notifications?tab=tracking should land on
  // the Tracking tab without a flash. Runs once on mount; SSR
  // always renders the 'sms' default so there is no hydration
  // mismatch.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('tab');
    if (v === 'tracking' || v === 'history') setTab(v);
  }, []);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Editable copy of settings; we patch only changed keys.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test SMS modal
  const [testPhone, setTestPhone] = useState('');
  const [testBody, setTestBody] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  // Test event modal
  const [testEventName, setTestEventName] = useState<'signup' | 'deposit' | 'withdrawal' | 'custom'>('deposit');
  const [testEventValue, setTestEventValue] = useState(1000);
  const [eventBusy, setEventBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/notifications/snapshot', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setSnap(data as Snapshot);
      setEdits({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flashToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

  const value = (key: string): string => edits[key] ?? snap?.settings[key] ?? '';
  const setValue = (key: string, v: string) => setEdits((e) => ({ ...e, [key]: v }));
  const isMaskedDisplay = (key: string) => SECRET_KEY.test(key) && !(key in edits);

  // `pending` carries key/value pairs that were just chosen but may not
  // be in the `edits` closure yet (setEdits is async). The catalog
  // "Use this" button passes { sms_provider } explicitly so the PATCH
  // body is never empty because of a stale closure.
  const save = async (keys: string[], pending?: Record<string, string>) => {
    setSaving(true);
    try {
      const merged: Record<string, string> = { ...edits, ...pending };
      const updates = keys
        .filter((k) => k in merged)
        .map((k) => ({ key: k, value: merged[k] }));
      if (updates.length === 0) {
        flashToast('No changes to save.');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/admin/notifications/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      flashToast(`Saved (${data.updated ?? updates.length} keys).`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const setSmsProvider = async (newKey: string) => {
    setEdits((e) => ({ ...e, sms_provider: newKey }));
    await save(['sms_provider'], { sms_provider: newKey });
  };

  const sendTestSms = async () => {
    if (!testPhone.trim()) return;
    setTestBusy(true);
    try {
      const res = await fetch('/api/admin/notifications/test-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: testPhone.trim(), body: testBody.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Send failed');
      const r = data.result;
      if (r.ok) flashToast(`Test SMS dispatched via ${r.provider}${r.ref ? ` . ref ${r.ref}` : ''}.`);
      else flashToast(`Test SMS failed via ${r.provider}: ${r.errorCode ?? '?'}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally { setTestBusy(false); }
  };

  const sendTestEvent = async () => {
    setEventBusy(true);
    try {
      const res = await fetch('/api/admin/notifications/test-event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: testEventName, value: testEventValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Fire failed');
      const summary = data.results.map((r: { platform: string; status: string }) => `${r.platform}:${r.status}`).join(' . ');
      flashToast(`Fired ${testEventName}. ${summary}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fire failed');
    } finally { setEventBusy(false); }
  };

  const trackingDirty = useMemo(() => Object.keys(edits).some((k) => k.startsWith('pixel_') || k.startsWith('analytics_')), [edits]);
  const smsDirty = useMemo(() => Object.keys(edits).some((k) => k.startsWith('sms_')), [edits]);

  return (
    <>
      <PageHeader
        title="Notifications + Tracking"
        subtitle="SMS provider, tracking pixel IDs, send-test buttons, full delivery history"
        icon={<Bell className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} onClick={() => setShowSecrets((v) => !v)}>
              {showSecrets ? 'Mask secrets' : 'Show secrets'}
            </Button>
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={load}>Reload</Button>
          </div>
        }
      />

      <div className="mb-4">
        <AdminPushToggle />
      </div>

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'sms' | 'tracking' | 'history')}>
        <TabsList>
          <TabsTrigger value="sms"><Send className="mr-1.5 h-3.5 w-3.5" /> SMS</TabsTrigger>
          <TabsTrigger value="tracking"><Wifi className="mr-1.5 h-3.5 w-3.5" /> Tracking</TabsTrigger>
          <TabsTrigger value="history"><Activity className="mr-1.5 h-3.5 w-3.5" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="sms">
          {!snap ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <div className="space-y-4">
              <Card padding="md">
                <CardHeader title="Active provider" subtitle={`Current: ${snap.currentSmsProvider}. OTP + transactional SMS will use this.`} />
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {snap.smsCatalog.map((a) => (
                    <div key={a.key} className={cn('rounded-xl border p-3', a.isCurrent ? 'border-signal-ok/40 bg-signal-ok/5' : 'border-neon/10 bg-base-deep/40')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-hi">{a.label}</p>
                          <p className="mt-0.5 text-xs text-ink-mid">{a.description}</p>
                        </div>
                        <Chip tone={statusTone(a.status)}>{a.status.replace('_', ' ')}</Chip>
                      </div>
                      <div className="mt-3 flex justify-end">
                        {a.isCurrent ? <Chip tone="ok"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> current</span></Chip> : (
                          <Button size="sm" variant="neon" onClick={() => setSmsProvider(a.key)} disabled={saving}>Use this</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {snap.smsCatalog.filter((a) => a.settingKeys.length > 0).map((a) => (
                <Card key={a.key} padding="md">
                  <CardHeader title={`${a.label} credentials`} subtitle={a.description} />
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {a.settingKeys.map((k) => (
                      <FormField key={k} label={k} hint={SECRET_KEY.test(k) ? 'Stored masked. Leave blank to keep current value.' : undefined}>
                        <Input
                          value={isMaskedDisplay(k) && !showSecrets ? value(k) : (edits[k] ?? (showSecrets ? snap.settings[k] ?? '' : value(k)))}
                          onChange={(e) => setValue(k, e.target.value)}
                          placeholder={isMaskedDisplay(k) ? 'masked' : undefined}
                          type={SECRET_KEY.test(k) && !showSecrets ? 'password' : 'text'}
                        />
                      </FormField>
                    ))}
                  </div>
                </Card>
              ))}

              <Card padding="md">
                <CardHeader title="Send a test SMS" subtitle="Uses the currently active provider. Body is logged in History." />
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField label="Phone">
                    <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                  </FormField>
                  <FormField label="Body (optional)">
                    <Input value={testBody} onChange={(e) => setTestBody(e.target.value)} placeholder="leave blank for auto" />
                  </FormField>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" loading={testBusy} leftIcon={<Send className="h-3.5 w-3.5" />} onClick={sendTestSms} disabled={!testPhone.trim()}>
                    Send test SMS
                  </Button>
                  <Button variant="gold" leftIcon={<Save className="h-3.5 w-3.5" />} loading={saving} disabled={!smsDirty}
                    onClick={() => save(Object.keys(edits).filter((k) => k.startsWith('sms_')))}>
                    Save SMS settings
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tracking">
          {!snap ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <div className="space-y-4">
              <Card padding="md">
                <CardHeader title="Platforms" subtitle="Live when a public pixel id (and any required server token) is set. Browser pixels fire automatically; server-side fire happens on deposit / withdrawal / signup." />
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {snap.tracking.map((p) => (
                    <div key={p.key} className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-hi">{p.label}</p>
                        <Chip tone={p.live ? 'ok' : 'warn'}>{p.live ? 'live' : 'inactive'}</Chip>
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-ink-lo">{p.settingKeys.join(' ; ')}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="md">
                <CardHeader title="Pixel IDs" subtitle="Public ids - safe to expose to the browser." />
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField label="pixel_facebook" hint="Facebook Pixel ID (numeric).">
                    <Input value={value('pixel_facebook')} onChange={(e) => setValue('pixel_facebook', e.target.value)} placeholder="1234567890" />
                  </FormField>
                  <FormField label="pixel_tiktok" hint="TikTok Pixel Code.">
                    <Input value={value('pixel_tiktok')} onChange={(e) => setValue('pixel_tiktok', e.target.value)} placeholder="CXXXXXXX" />
                  </FormField>
                  <FormField label="analytics_ga4" hint="GA4 measurement id (G-XXXX).">
                    <Input value={value('analytics_ga4')} onChange={(e) => setValue('analytics_ga4', e.target.value)} placeholder="G-XXXXXXX" />
                  </FormField>
                  <FormField label="analytics_google_ads" hint="Google Ads conversion id (AW-XXXX).">
                    <Input value={value('analytics_google_ads')} onChange={(e) => setValue('analytics_google_ads', e.target.value)} placeholder="AW-XXXXXXXXX" />
                  </FormField>
                  <FormField label="analytics_google_ads_conv_label" hint="Optional conversion label (after the / in the AW snippet).">
                    <Input value={value('analytics_google_ads_conv_label')} onChange={(e) => setValue('analytics_google_ads_conv_label', e.target.value)} placeholder="abcDEF1234" />
                  </FormField>
                  <FormField label="analytics_gtm" hint="Google Tag Manager container id (GTM-XXXX). Renders gtm.js on every page when set.">
                    <Input value={value('analytics_gtm')} onChange={(e) => setValue('analytics_gtm', e.target.value)} placeholder="GTM-XXXXXXX" />
                  </FormField>
                </div>
              </Card>

              <Card padding="md">
                <CardHeader title="Server-side tokens" subtitle="Private. Used by the server dispatcher to fire conversions via FB CAPI / TikTok Events API / GA4 MP. Leave blank to skip server-side fire (browser pixel still works)." />
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ['pixel_facebook_capi_token', 'FB CAPI access token'],
                    ['pixel_facebook_test_event_code', 'FB test event code (optional)'],
                    ['pixel_tiktok_access_token', 'TikTok Events access token'],
                    ['analytics_ga4_api_secret', 'GA4 API secret'],
                  ].map(([k, label]) => (
                    <FormField key={k} label={label} hint={SECRET_KEY.test(k) ? 'Stored masked. Leave blank to keep current value.' : undefined}>
                      <Input
                        value={edits[k] ?? (showSecrets ? snap.settings[k] ?? '' : (isMaskedDisplay(k) ? snap.settings[k] ?? '' : ''))}
                        onChange={(e) => setValue(k, e.target.value)}
                        type={SECRET_KEY.test(k) && !showSecrets ? 'password' : 'text'}
                      />
                    </FormField>
                  ))}
                </div>
              </Card>

              <Card padding="md">
                <CardHeader title="Fire a test event" subtitle="Sends one synthetic event to every enabled platform. Useful for verifying CAPI tokens without simulating real activity." />
                <div className="grid gap-3 md:grid-cols-3">
                  <FormField label="Event">
                    <Select value={testEventName} onChange={(e) => setTestEventName(e.target.value as 'signup' | 'deposit' | 'withdrawal' | 'custom')}>
                      <option value="signup">signup</option>
                      <option value="deposit">deposit</option>
                      <option value="withdrawal">withdrawal</option>
                      <option value="custom">custom</option>
                    </Select>
                  </FormField>
                  <FormField label="Value (BDT)">
                    <Input type="number" min={0} value={testEventValue} onChange={(e) => setTestEventValue(Number(e.target.value))} />
                  </FormField>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" leftIcon={<Send className="h-3.5 w-3.5" />} loading={eventBusy} onClick={sendTestEvent}>Fire test event</Button>
                  <Button variant="gold" leftIcon={<Save className="h-3.5 w-3.5" />} loading={saving} disabled={!trackingDirty}
                    onClick={() => save(Object.keys(edits).filter((k) => k.startsWith('pixel_') || k.startsWith('analytics_')))}>
                    Save tracking settings
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {!snap ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padding="md" className="overflow-x-auto">
                <CardHeader title="NotificationLog" subtitle="Last 30 SMS / WhatsApp / email sends" />
                {snap.notifications.length === 0 ? <p className="text-sm text-ink-lo">No notifications yet.</p> : (
                  <table className="w-full min-w-[400px] text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-ink-lo">
                      <tr>
                        <th className="px-2 py-1 text-left">When</th>
                        <th className="px-2 py-1 text-left">Provider</th>
                        <th className="px-2 py-1 text-left">Template</th>
                        <th className="px-2 py-1 text-left">Status</th>
                        <th className="px-2 py-1 text-left">Body</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.notifications.map((n) => (
                        <tr key={n.id} className="border-t border-neon/10 align-top">
                          <td className="px-2 py-1 text-ink-lo">{new Date(n.createdAt).toLocaleString()}</td>
                          <td className="px-2 py-1 text-ink-mid">{n.provider ?? '-'}</td>
                          <td className="px-2 py-1 text-ink-mid">{n.template ?? '-'}</td>
                          <td className="px-2 py-1">
                            <Chip tone={n.ok ? 'ok' : 'danger'}>
                              <span className="inline-flex items-center gap-1">{n.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />} {n.ok ? 'ok' : (n.errorCode ?? 'err')}</span>
                            </Chip>
                          </td>
                          <td className="px-2 py-1 max-w-[260px] truncate text-ink-mid" title={n.body}>{n.body}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              <Card padding="md" className="overflow-x-auto">
                <CardHeader title="TrackingEvent" subtitle="Last 30 conversion events" />
                {snap.events.length === 0 ? <p className="text-sm text-ink-lo">No events yet.</p> : (
                  <table className="w-full min-w-[400px] text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-ink-lo">
                      <tr>
                        <th className="px-2 py-1 text-left">When</th>
                        <th className="px-2 py-1 text-left">Event</th>
                        <th className="px-2 py-1 text-right">Value</th>
                        <th className="px-2 py-1 text-left">Reference</th>
                        <th className="px-2 py-1 text-left">Platforms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.events.map((e) => {
                        const results = (e.results ?? {}) as Record<string, string>;
                        return (
                          <tr key={e.id} className="border-t border-neon/10 align-top">
                            <td className="px-2 py-1 text-ink-lo">{new Date(e.createdAt).toLocaleString()}</td>
                            <td className="px-2 py-1 font-mono text-ink-hi">{e.event}</td>
                            <td className="px-2 py-1 text-right font-mono text-ink-mid">{e.value ?? '-'}</td>
                            <td className="px-2 py-1 font-mono text-ink-mid">{e.reference ?? '-'}</td>
                            <td className="px-2 py-1 text-ink-mid">
                              {Object.entries(results).map(([k, v]) => (
                                <span key={k} className="mr-2 inline-flex items-center gap-1">
                                  <span className="text-ink-lo">{k}:</span>
                                  <span className={cn(typeof v === 'string' && v.startsWith('ok') ? 'text-signal-ok' : typeof v === 'string' && v.startsWith('skipped') ? 'text-ink-lo' : 'text-signal-warn')}>{v}</span>
                                </span>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
