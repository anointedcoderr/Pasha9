// Built by Anointed Coder.
//
// /admin/settings. Wires the public-contact + referral-global SystemSetting
// keys to the PATCH /api/admin/settings endpoint so admin edits actually
// persist. The General / Operations / Demo Games / APK cards are left as
// placeholders for now; the load-bearing keys are Support Contacts (which
// drive /support, the footer, FloatingContact) and Referral globals (which
// drive the affiliate engine + /referral dashboard).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Settings, ShieldAlert, Check } from 'lucide-react';
import { BRAND } from '@/lib/constants/brand';

interface SettingRow { key: string; value: string }

// Keys the page reads + writes. Anything not in this list is left alone.
const SUPPORT_KEYS = ['support_telegram', 'support_whatsapp', 'support_email', 'support_phone'] as const;
const REFERRAL_KEYS = [
  'referral_enabled',
  'referral_hold_enabled',
  'referral_hold_days',
  'referral_turnover_x',
  'referral_claim_cadence',
  'referral_first_deposit_min_bdt',
  'referral_first_deposit_reward_bdt',
] as const;
const REWARD_COIN_KEYS = [
  // Coins credited to the depositor on their FIRST approved deposit.
  'reward_coin_first_deposit',
  // Coins credited to the REFERRER when their friend's referral matures
  // (the referred user passes the deposit minimum that triggers the
  // first-deposit reward in lib/affiliate/engine.ts).
  'reward_coin_referral_successful',
  // Coins credited to the REFERRER specifically when the referred friend's
  // first deposit is approved (separate from the BDT first-deposit reward
  // so operators can run a coin campaign and a BDT campaign in parallel).
  'reward_coin_referred_first_deposit',
] as const;
const SITE_KEYS = ['site_name'] as const;
// APK download: apk_download_url drives the site home Download button
// (AppDownloadSection hides itself until this is set); apk_version is
// shown beside it.
const APK_KEYS = ['apk_download_url', 'apk_version'] as const;
const ALL_KEYS = [...SUPPORT_KEYS, ...REFERRAL_KEYS, ...REWARD_COIN_KEYS, ...SITE_KEYS, ...APK_KEYS] as const;

type SettingKey = (typeof ALL_KEYS)[number];

function defaultFor(key: SettingKey): string {
  if (key === 'referral_enabled') return 'true';
  if (key === 'referral_hold_enabled') return 'true';
  if (key === 'referral_hold_days') return '7';
  if (key === 'referral_turnover_x') return '1';
  if (key === 'referral_claim_cadence') return 'weekly';
  if (key === 'referral_first_deposit_min_bdt') return '300';
  if (key === 'referral_first_deposit_reward_bdt') return '200';
  if (key === 'reward_coin_first_deposit') return '0';
  if (key === 'reward_coin_referral_successful') return '0';
  if (key === 'reward_coin_referred_first_deposit') return '0';
  if (key === 'site_name') return 'Pasha 9';
  return '';
}

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [apkUploading, setApkUploading] = useState(false);
  const [apkUploadError, setApkUploadError] = useState<string | null>(null);
  // True once an APK is uploaded and until Save Settings publishes it.
  const [apkUnsaved, setApkUnsaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/settings', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      const rows = (j.settings as SettingRow[]) ?? [];
      const map: Record<string, string> = {};
      for (const k of ALL_KEYS) map[k] = defaultFor(k);
      for (const row of rows) {
        if ((ALL_KEYS as readonly string[]).includes(row.key)) {
          map[row.key] = row.value ?? '';
        }
      }
      setValues(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (key: SettingKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // Uploads the picked APK to /uploads/apk via the shared upload endpoint and
  // fills the download URL. The operator still presses Save Settings to
  // publish it. Files above the server cap are rejected here, in which case
  // the operator can host the file elsewhere and paste the URL instead.
  //
  // The two-step upload-then-save is the reason players kept downloading the
  // previous build: the upload fills this field in local state only, so the
  // page LOOKS updated while the site still serves the old URL. Leaving
  // without pressing Save silently discarded the new build. The unsaved flag
  // below makes that state impossible to miss.
  const uploadApk = async (file: File) => {
    setApkUploading(true);
    setApkUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'apk');
      const r = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Upload failed');
      update('apk_download_url', String(j.url ?? ''));
      setApkUnsaved(true);
    } catch (e) {
      setApkUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setApkUploading(false);
    }
  };

  // Closing the tab with an uploaded but unpublished APK is the exact way the
  // new build got lost, so it is worth one browser prompt.
  useEffect(() => {
    if (!apkUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [apkUnsaved]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const updates = (ALL_KEYS as readonly SettingKey[]).map((k) => ({ key: k, value: values[k] ?? '' }));
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setSavedAt(Date.now());
      setApkUnsaved(false);
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const referralEnabled = (values.referral_enabled ?? 'true').toLowerCase() === 'true';
  const holdEnabled = (values.referral_hold_enabled ?? 'true').toLowerCase() === 'true';

  return (
    <>
      <PageHeader title="System Settings" subtitle="Platform wide configuration" icon={<Settings className="h-5 w-5" />} />

      <Card padding="lg" tone="gold" className="mb-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-base-deep text-gold-300"><ShieldAlert className="h-5 w-5" /></span>
          <div>
            <h2 className="text-base font-semibold text-ink-hi">Compliance Notice</h2>
            <p className="mt-1 text-sm text-ink-mid">
              The platform is built as a technical product only. The site owner is responsible for obtaining the appropriate license, complying with local laws, securing payment provider approval, satisfying KYC requirements, and signing the necessary agreements with each game provider before any public launch. {BRAND.developer.label}.
            </p>
          </div>
        </div>
      </Card>

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Public Support Contacts" subtitle="What players see in the footer, support page and floating contact button. Leave a field empty to hide that channel." />
          {loading ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <div className="space-y-3">
              <FormField label="Telegram link" hint="e.g. https://t.me/pasha9_support">
                <Input value={values.support_telegram ?? ''} onChange={(e) => update('support_telegram', e.target.value)} placeholder="https://t.me/your-channel" />
              </FormField>
              <FormField label="WhatsApp link" hint="e.g. https://wa.me/8801XXXXXXXXX">
                <Input value={values.support_whatsapp ?? ''} onChange={(e) => update('support_whatsapp', e.target.value)} placeholder="https://wa.me/8801XXXXXXXXX" />
              </FormField>
              <FormField label="Support email">
                <Input value={values.support_email ?? ''} onChange={(e) => update('support_email', e.target.value)} placeholder="support@pasha9.com" />
              </FormField>
              <FormField label="Phone (optional)" hint="Displayed as a tel: link on /support">
                <Input value={values.support_phone ?? ''} onChange={(e) => update('support_phone', e.target.value)} placeholder="+8801XXXXXXXXX" />
              </FormField>
            </div>
          )}
        </Card>

        <Card padding="lg">
          <CardHeader title="Referral / Affiliate Globals" subtitle="Drives the /referral dashboard, the affiliate engine and the withdrawal turnover gate. Per-tier percentages are set in /admin/affiliate/tiers." />
          {loading ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <div className="space-y-3">
              <Row
                label="Referral program enabled"
                hint="When off, deposit-approval hook will not accrue commissions."
                value={referralEnabled}
                onChange={(v) => update('referral_enabled', v ? 'true' : 'false')}
              />
              <Row
                label="Hold period enabled"
                hint="When off, commissions become claimable immediately (subject to turnover)."
                value={holdEnabled}
                onChange={(v) => update('referral_hold_enabled', v ? 'true' : 'false')}
              />
              <FormField label="Hold period (days)" hint="Days a pending commission waits before becoming claimable.">
                <Input type="number" min={0} max={365} value={values.referral_hold_days ?? ''} onChange={(e) => update('referral_hold_days', e.target.value)} placeholder="7" />
              </FormField>
              <FormField label="Turnover multiplier" hint="Multiplier applied to paid referral rewards. 0 disables the withdrawal lock.">
                <Input type="number" step="0.1" min={0} max={50} value={values.referral_turnover_x ?? ''} onChange={(e) => update('referral_turnover_x', e.target.value)} placeholder="1" />
              </FormField>
              <FormField label="Fixed reward minimum approved deposits (BDT)" hint="Cumulative approved deposits required before the direct referrer receives the one-time fixed reward. Percentage commissions are never blocked by this minimum.">
                <Input type="number" min={0} max={10000000} value={values.referral_first_deposit_min_bdt ?? ''} onChange={(e) => update('referral_first_deposit_min_bdt', e.target.value)} placeholder="300" />
              </FormField>
              <FormField label="Claim cadence">
                <Select value={values.referral_claim_cadence ?? 'weekly'} onChange={(e) => update('referral_claim_cadence', e.target.value)}>
                  <option value="auto">Auto (claim whenever balance is available)</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="manual">Manual (admin approves each claim)</option>
                </Select>
              </FormField>
              <FormField label="First deposit fixed reward (BDT)" hint="Global default for the one-time reward credited to the direct upline after cumulative approved deposits reach the configured minimum. Per-tier overrides are set in /admin/affiliate/tiers.">
                <Input type="number" min={0} max={1000000} value={values.referral_first_deposit_reward_bdt ?? ''} onChange={(e) => update('referral_first_deposit_reward_bdt', e.target.value)} placeholder="200" />
              </FormField>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card padding="lg">
          <CardHeader title="Reward Coins" subtitle="Coins are awarded into Wallet.bonusBalance and are visible on /rewards. Set 0 to disable any single grant. Per-event triggers fire from the deposit-approval flow and the affiliate first-deposit reward path." />
          {loading ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="First deposit coins" hint="Credited to the depositor on their first ever approved deposit. 0 = disabled.">
                <Input type="number" min={0} max={1_000_000} value={values.reward_coin_first_deposit ?? '0'} onChange={(e) => update('reward_coin_first_deposit', e.target.value)} placeholder="100" />
              </FormField>
              <FormField label="Successful referral coins" hint="Credited to the REFERRER each time one of their referrals matures (first-deposit threshold met). 0 = disabled.">
                <Input type="number" min={0} max={1_000_000} value={values.reward_coin_referral_successful ?? '0'} onChange={(e) => update('reward_coin_referral_successful', e.target.value)} placeholder="50" />
              </FormField>
              <FormField label="Referred friend first-deposit coins" hint="Extra coin grant to the REFERRER specifically when the referred friend's first deposit is approved. 0 = disabled.">
                <Input type="number" min={0} max={1_000_000} value={values.reward_coin_referred_first_deposit ?? '0'} onChange={(e) => update('reward_coin_referred_first_deposit', e.target.value)} placeholder="100" />
              </FormField>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card padding="lg">
          <CardHeader title="App Download (APK)" subtitle="Publish the Android app. Once a download URL is set, a Download button appears on the site home page. Update it here on every new build." />
          {loading ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <div className="space-y-3">
              <FormField label="Android APK file" hint="Choose the .apk from your computer (up to 80 MB). It uploads immediately, then press Save Settings below to publish. For a larger file, host it and paste the URL instead.">
                <div className="flex flex-wrap items-center gap-3">
                  {/*
                    sr-only, not hidden. display:none takes the input out of the
                    tab order, and the label wrapping it is not focusable, so
                    the whole upload control was unreachable by keyboard.
                    focus-within puts the ring on the label the input sits in.
                  */}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neon/20 bg-base-deep px-4 py-2 text-sm text-ink-hi hover:border-neon/40 focus-within:border-neon/40 focus-within:ring-2 focus-within:ring-neon/40">
                    <input
                      type="file"
                      accept=".apk,application/vnd.android.package-archive"
                      className="sr-only"
                      disabled={apkUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadApk(f); e.target.value = ''; }}
                    />
                    {apkUploading ? 'Uploading...' : 'Choose APK'}
                  </label>
                  {values.apk_download_url ? (
                    <a href={values.apk_download_url} target="_blank" rel="noreferrer" className="text-sm text-neon underline">
                      {apkUnsaved ? 'Open uploaded file' : 'Open current file'}
                    </a>
                  ) : <span className="text-xs text-ink-lo">No file set yet</span>}
                </div>
              </FormField>
              {apkUploadError ? <p className="text-sm text-signal-danger" role="alert">{apkUploadError}</p> : null}
              {apkUnsaved ? (
                <p role="status" className="rounded-lg border border-signal-warn/40 bg-signal-warn/10 px-3 py-2 text-sm text-ink-hi">
                  <strong className="font-semibold">Not published yet.</strong> The file is uploaded, but players still get
                  the previous app until you press Save Settings below.
                </p>
              ) : null}
              <FormField label="Download URL" hint="Filled automatically when you upload above. You can also paste a full URL to an APK hosted elsewhere.">
                <Input value={values.apk_download_url ?? ''} onChange={(e) => update('apk_download_url', e.target.value)} placeholder="/uploads/apk/pasha9.apk" />
              </FormField>
              <FormField label="Version (optional)" hint="Shown next to the download button, e.g. 1.0.0">
                <Input value={values.apk_version ?? ''} onChange={(e) => update('apk_version', e.target.value)} placeholder="1.0.0" />
              </FormField>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neon/10 pt-4 text-xs text-ink-lo">
        <span>{BRAND.developer.label} . <a href={`mailto:${BRAND.developer.email}`} className="hover:text-ink-hi">{BRAND.developer.email}</a></span>
        <div className="flex items-center gap-3">
          {/* signal-ok is the real token; text-signal-success was never defined, so this confirmation had no colour. */}
          {savedAt ? <span role="status" className="inline-flex items-center gap-1 text-signal-ok"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved</span> : null}
          <Button onClick={save} loading={saving}>Save Settings</Button>
        </div>
      </div>
    </>
  );
}

function Row({ label, hint, value, onChange, tone }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; tone?: 'brand' | 'danger' }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <div>
        <p className="text-sm font-medium text-ink-hi">{label}</p>
        <p className="text-xs text-ink-mid">{hint}</p>
      </div>
      <Switch checked={value} onChange={onChange} tone={tone} />
    </div>
  );
}
