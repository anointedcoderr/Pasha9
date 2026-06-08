// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { Megaphone, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PopupConfig {
  enabled: boolean;
  imageOnly: boolean;
  frequency: 'every_visit' | 'once_per_session' | 'once_per_day' | 'once_per_30_days';
  imageUrl: string;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  registerTextEn: string;
  registerTextBn: string;
  registerUrl: string;
  loginTextEn: string;
  loginTextBn: string;
  loginUrl: string;
  laterTextEn: string;
  laterTextBn: string;
}

const EMPTY: PopupConfig = {
  enabled: true,
  imageOnly: false,
  frequency: 'once_per_30_days',
  imageUrl: '',
  titleEn: '',
  titleBn: '',
  bodyEn: '',
  bodyBn: '',
  registerTextEn: '',
  registerTextBn: '',
  registerUrl: '',
  loginTextEn: '',
  loginTextBn: '',
  loginUrl: '',
  laterTextEn: '',
  laterTextBn: '',
};

function readFromMap(map: Record<string, string>): PopupConfig {
  const truthy = (v?: string) => {
    const t = (v ?? '').trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'on';
  };
  const freq = (() => {
    const v = (map.welcome_popup_frequency ?? '').trim().toLowerCase();
    if (v === 'every_visit' || v === 'once_per_session' || v === 'once_per_day' || v === 'once_per_30_days') return v;
    return 'once_per_30_days';
  })();
  const enabledRaw = map.welcome_popup_enabled?.trim();
  return {
    enabled: enabledRaw == null || enabledRaw === '' ? true : truthy(enabledRaw),
    imageOnly: truthy(map.welcome_popup_image_only),
    frequency: freq as PopupConfig['frequency'],
    imageUrl: map.welcome_popup_image_url ?? '',
    titleEn: map.welcome_popup_title_en ?? '',
    titleBn: map.welcome_popup_title_bn ?? '',
    bodyEn: map.welcome_popup_body_en ?? '',
    bodyBn: map.welcome_popup_body_bn ?? '',
    registerTextEn: map.welcome_popup_register_text_en ?? '',
    registerTextBn: map.welcome_popup_register_text_bn ?? '',
    registerUrl: map.welcome_popup_register_url ?? '',
    loginTextEn: map.welcome_popup_login_text_en ?? '',
    loginTextBn: map.welcome_popup_login_text_bn ?? '',
    loginUrl: map.welcome_popup_login_url ?? '',
    laterTextEn: map.welcome_popup_later_text_en ?? '',
    laterTextBn: map.welcome_popup_later_text_bn ?? '',
  };
}

export default function AdminWelcomePopupPage() {
  const [config, setConfig] = useState<PopupConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/welcome-popup', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setConfig(readFromMap((data.values ?? {}) as Record<string, string>));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch('/api/admin/welcome-popup', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setToast('Saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof PopupConfig>(key: K, value: PopupConfig[K]) => setConfig({ ...config, [key]: value });

  return (
    <>
      <PageHeader
        title="First-visit Welcome Popup"
        subtitle="The popup shown to guests on their first visit. Empty values fall back to the bundled defaults; an image-only mode renders just the uploaded image."
        icon={<Megaphone className="h-5 w-5" />}
        action={<Button onClick={save} loading={busy}>Save</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{toast}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="space-y-4">
          <Card padding="lg" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-ink-mid">
                <Switch checked={config.enabled} onChange={(v) => set('enabled', Boolean(v))} />
                Popup enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-mid">
                <Switch checked={config.imageOnly} onChange={(v) => set('imageOnly', Boolean(v))} />
                Image-only mode
              </label>
              <FormField label="Frequency">
                <Select value={config.frequency} onChange={(e) => set('frequency', e.target.value as PopupConfig['frequency'])}>
                  <option value="every_visit">Every visit</option>
                  <option value="once_per_session">Once per session</option>
                  <option value="once_per_day">Once per day</option>
                  <option value="once_per_30_days">Once per 30 days</option>
                </Select>
              </FormField>
            </div>
            <AdminMediaUpload
              label="Popup image"
              hint="Optional. When image-only mode is on, only this image renders. Otherwise it appears behind the text + buttons."
              value={config.imageUrl || null}
              category="banners"
              constraintHint="PNG / JPG / WEBP, ~720x540, max 4 MB"
              onChange={(url) => set('imageUrl', url ?? '')}
            />
          </Card>

          <Card padding="lg" className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-hi">Text content (optional)</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title (English)"><Input value={config.titleEn} onChange={(e) => set('titleEn', e.target.value)} /></FormField>
              <FormField label="Title (Bangla)"><Input value={config.titleBn} onChange={(e) => set('titleBn', e.target.value)} /></FormField>
              <FormField label="Body (English)"><Textarea rows={3} value={config.bodyEn} onChange={(e) => set('bodyEn', e.target.value)} /></FormField>
              <FormField label="Body (Bangla)"><Textarea rows={3} value={config.bodyBn} onChange={(e) => set('bodyBn', e.target.value)} /></FormField>
            </div>
          </Card>

          <Card padding="lg" className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-hi">Register button (optional)</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Text (English)"><Input value={config.registerTextEn} onChange={(e) => set('registerTextEn', e.target.value)} placeholder="Register now" /></FormField>
              <FormField label="Text (Bangla)"><Input value={config.registerTextBn} onChange={(e) => set('registerTextBn', e.target.value)} placeholder="এখন রেজিস্টার করুন" /></FormField>
              <FormField label="URL"><Input value={config.registerUrl} onChange={(e) => set('registerUrl', e.target.value)} placeholder="/?signup=1" /></FormField>
            </div>
          </Card>

          <Card padding="lg" className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-hi">Login button (optional)</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Text (English)"><Input value={config.loginTextEn} onChange={(e) => set('loginTextEn', e.target.value)} placeholder="I have an account" /></FormField>
              <FormField label="Text (Bangla)"><Input value={config.loginTextBn} onChange={(e) => set('loginTextBn', e.target.value)} placeholder="আমার অ্যাকাউন্ট আছে" /></FormField>
              <FormField label="URL"><Input value={config.loginUrl} onChange={(e) => set('loginUrl', e.target.value)} placeholder="/?login=1" /></FormField>
            </div>
          </Card>

          <Card padding="lg" className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-hi">Later button (optional)</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Text (English)"><Input value={config.laterTextEn} onChange={(e) => set('laterTextEn', e.target.value)} placeholder="Maybe later" /></FormField>
              <FormField label="Text (Bangla)"><Input value={config.laterTextBn} onChange={(e) => set('laterTextBn', e.target.value)} placeholder="পরে দেখব" /></FormField>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
