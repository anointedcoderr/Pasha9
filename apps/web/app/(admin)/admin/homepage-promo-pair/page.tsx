// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { Sparkles } from 'lucide-react';

interface SlotConfig {
  kickerEn: string;
  kickerBn: string;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  ctaEn: string;
  ctaBn: string;
  href: string;
  imageUrl: string;
}

const EMPTY: SlotConfig = {
  kickerEn: '',
  kickerBn: '',
  titleEn: '',
  titleBn: '',
  bodyEn: '',
  bodyBn: '',
  ctaEn: '',
  ctaBn: '',
  href: '',
  imageUrl: '',
};

type Slot = 'refer' | 'pass';

function readSlot(map: Record<string, string>, slot: Slot): SlotConfig {
  return {
    kickerEn: map[`promo_pair_${slot}_kicker_en`] ?? '',
    kickerBn: map[`promo_pair_${slot}_kicker_bn`] ?? '',
    titleEn: map[`promo_pair_${slot}_title_en`] ?? '',
    titleBn: map[`promo_pair_${slot}_title_bn`] ?? '',
    bodyEn: map[`promo_pair_${slot}_body_en`] ?? '',
    bodyBn: map[`promo_pair_${slot}_body_bn`] ?? '',
    ctaEn: map[`promo_pair_${slot}_cta_en`] ?? '',
    ctaBn: map[`promo_pair_${slot}_cta_bn`] ?? '',
    href: map[`promo_pair_${slot}_href`] ?? '',
    imageUrl: map[`promo_pair_${slot}_image_url`] ?? '',
  };
}

export default function AdminHomepagePromoPairPage() {
  const [refer, setRefer] = useState<SlotConfig>(EMPTY);
  const [pass, setPass] = useState<SlotConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/homepage-promo-pair', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      const values = (data.values ?? {}) as Record<string, string>;
      setRefer(readSlot(values, 'refer'));
      setPass(readSlot(values, 'pass'));
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
      const res = await fetch('/api/admin/homepage-promo-pair', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refer, pass }),
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

  return (
    <>
      <PageHeader
        title="Homepage Affiliate and Betting Pass Banners"
        subtitle="The two promotional cards rendered side-by-side on the homepage"
        icon={<Sparkles className="h-5 w-5" />}
        action={<Button onClick={save} loading={busy}>Save</Button>}
      />

      {error ? (
        <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card>
      ) : null}
      {toast ? (
        <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700">{toast}</p></Card>
      ) : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SlotEditor title="Affiliate card (links to /affiliate by default)" value={refer} onChange={setRefer} defaultHref="/affiliate" />
          <SlotEditor title="Betting Pass card (links to /betting-pass by default)" value={pass} onChange={setPass} defaultHref="/betting-pass" />
        </div>
      )}
    </>
  );
}

function SlotEditor({
  title,
  value,
  onChange,
  defaultHref,
}: {
  title: string;
  value: SlotConfig;
  onChange: (next: SlotConfig) => void;
  defaultHref: string;
}) {
  const set = (k: keyof SlotConfig, v: string) => onChange({ ...value, [k]: v });
  return (
    <Card padding="lg" className="space-y-4">
      <h3 className="text-base font-semibold text-ink-hi">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Kicker (English)"><Input value={value.kickerEn} onChange={(e) => set('kickerEn', e.target.value)} /></FormField>
        <FormField label="Kicker (Bangla)"><Input value={value.kickerBn} onChange={(e) => set('kickerBn', e.target.value)} /></FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Title (English)"><Input value={value.titleEn} onChange={(e) => set('titleEn', e.target.value)} /></FormField>
        <FormField label="Title (Bangla)"><Input value={value.titleBn} onChange={(e) => set('titleBn', e.target.value)} /></FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Body (English)"><Textarea rows={2} value={value.bodyEn} onChange={(e) => set('bodyEn', e.target.value)} /></FormField>
        <FormField label="Body (Bangla)"><Textarea rows={2} value={value.bodyBn} onChange={(e) => set('bodyBn', e.target.value)} /></FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="CTA label (English)"><Input value={value.ctaEn} onChange={(e) => set('ctaEn', e.target.value)} /></FormField>
        <FormField label="CTA label (Bangla)"><Input value={value.ctaBn} onChange={(e) => set('ctaBn', e.target.value)} /></FormField>
      </div>
      <FormField label="Destination URL" hint={`Falls back to ${defaultHref} when empty.`}>
        <Input value={value.href} onChange={(e) => set('href', e.target.value)} placeholder={defaultHref} />
      </FormField>
      <AdminMediaUpload
        label="Background image"
        hint="Optional. Replaces the built-in svg art when set."
        value={value.imageUrl || null}
        category="banners"
        constraintHint="PNG / JPG / WEBP, ~1200x420, max 4 MB"
        onChange={(url) => set('imageUrl', url ?? '')}
      />
    </Card>
  );
}
