// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Star, Save, CheckCircle2 } from 'lucide-react';

interface Values {
  ambassador_name: string;
  ambassador_caption: string;
  ambassador_image_url: string;
  ambassador_active: string;
  video_promo_title: string;
  video_promo_caption: string;
  video_promo_url: string;
  video_promo_poster_url: string;
}

const BLANK: Values = {
  ambassador_name: '',
  ambassador_caption: '',
  ambassador_image_url: '',
  ambassador_active: 'true',
  video_promo_title: '',
  video_promo_caption: '',
  video_promo_url: '',
  video_promo_poster_url: '',
};

export default function AdminAmbassadorPage() {
  const [values, setValues] = useState<Values>(BLANK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [okFlash, setOkFlash] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/ambassador', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setValues({ ...BLANK, ...(data.values ?? {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setOkFlash(false);
    try {
      const res = await fetch('/api/admin/ambassador', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...values,
          ambassador_active: values.ambassador_active === 'true',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setOkFlash(true);
      setTimeout(() => setOkFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Values>(key: K, v: Values[K]) => setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <>
      <PageHeader
        title="Ambassador and Promo Video"
        subtitle="Manage the homepage ambassador slot and promotional video card"
        icon={<Star className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-3">
            {okFlash ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> saved</span> : null}
            <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save</Button>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="lg">
            <CardHeader title="Brand Ambassador" subtitle="Shown on the homepage ambassador card" />
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-brand-divider bg-brand-surface p-3">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">Active</p>
                  <p className="text-xs text-brand-inkMute">Hide the ambassador section if disabled</p>
                </div>
                <Switch
                  checked={values.ambassador_active !== 'false'}
                  onChange={(next) => set('ambassador_active', next ? 'true' : 'false')}
                />
              </div>

              <FormField label="Ambassador name">
                <Input value={values.ambassador_name} onChange={(e) => set('ambassador_name', e.target.value)} placeholder="e.g. Samira Khan" />
              </FormField>

              <FormField label="Caption" hint="Shown below the ambassador name on the homepage">
                <Textarea rows={3} value={values.ambassador_caption} onChange={(e) => set('ambassador_caption', e.target.value)} placeholder="Official ambassador of Pasha 9 for the season" />
              </FormField>

              <FormField label="Image URL" hint="Upload via Banner uploader or paste an external URL. Leave empty to use the brand placeholder.">
                <Input value={values.ambassador_image_url} onChange={(e) => set('ambassador_image_url', e.target.value)} placeholder="/uploads/banners/ambassador.png" />
              </FormField>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader title="Promo Video" subtitle="Right column of the homepage ambassador and video section" />
            <div className="space-y-3">
              <FormField label="Video title">
                <Input value={values.video_promo_title} onChange={(e) => set('video_promo_title', e.target.value)} placeholder="e.g. Behind the scenes" />
              </FormField>

              <FormField label="Caption">
                <Textarea rows={3} value={values.video_promo_caption} onChange={(e) => set('video_promo_caption', e.target.value)} placeholder="Watch the official Pasha 9 promo and matchday highlights." />
              </FormField>

              <FormField label="Video URL" hint="External link (YouTube, Vimeo or a hosted mp4)">
                <Input value={values.video_promo_url} onChange={(e) => set('video_promo_url', e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
              </FormField>

              <FormField label="Poster image URL" hint="Optional thumbnail shown before the video plays">
                <Input value={values.video_promo_poster_url} onChange={(e) => set('video_promo_poster_url', e.target.value)} placeholder="/uploads/banners/video-poster.jpg" />
              </FormField>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
