// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Home, Save } from 'lucide-react';

interface Section {
  section: string;
  titleBn?: string | null;
  titleEn?: string | null;
  bodyBn?: string | null;
  bodyEn?: string | null;
  imageUrl?: string | null;
  link?: string | null;
}

const KNOWN_SECTIONS = [
  { key: 'hero_primary', label: 'Hero primary slide' },
  { key: 'hero_live', label: 'Hero live casino slide' },
  { key: 'hero_referral', label: 'Hero referral slide' },
  { key: 'about', label: 'About section' },
];

export default function AdminHomepagePage() {
  const [sections, setSections] = useState<Record<string, Section>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okKey, setOkKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/homepage', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      const map: Record<string, Section> = {};
      for (const known of KNOWN_SECTIONS) {
        map[known.key] = { section: known.key };
      }
      for (const s of data.sections as Section[]) {
        map[s.section] = s;
      }
      setSections(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async (key: string) => {
    const row = sections[key];
    if (!row) return;
    setSavingKey(key);
    setOkKey(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/homepage', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          section: row.section,
          titleBn: row.titleBn || undefined,
          titleEn: row.titleEn || undefined,
          bodyBn: row.bodyBn || undefined,
          bodyEn: row.bodyEn || undefined,
          imageUrl: row.imageUrl || undefined,
          link: row.link || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setOkKey(key);
      setTimeout(() => setOkKey((c) => (c === key ? null : c)), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  const setField = <K extends keyof Section>(key: string, field: K, value: Section[K]) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], section: key, [field]: value } }));
  };

  return (
    <>
      <PageHeader title="Homepage Content" subtitle="Edit hero copy and the about section" icon={<Home className="h-5 w-5" />} />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-6">
        {loading ? (
          <Card padding="lg">Loading content...</Card>
        ) : (
          KNOWN_SECTIONS.map((k) => {
            const s = sections[k.key] ?? { section: k.key };
            return (
              <Card key={k.key} padding="lg">
                <CardHeader
                  title={k.label}
                  subtitle={`Section key: ${k.key}`}
                  action={
                    <div className="flex items-center gap-3">
                      {okKey === k.key ? <span className="text-xs text-neon">saved</span> : null}
                      <Button leftIcon={<Save className="h-4 w-4" />} loading={savingKey === k.key} onClick={() => save(k.key)}>Save</Button>
                    </div>
                  }
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField label="Title (Bangla)">
                    <Input value={s.titleBn ?? ''} onChange={(e) => setField(k.key, 'titleBn', e.target.value)} />
                  </FormField>
                  <FormField label="Title (English)">
                    <Input value={s.titleEn ?? ''} onChange={(e) => setField(k.key, 'titleEn', e.target.value)} />
                  </FormField>
                  <FormField label="Body (Bangla)">
                    <Textarea rows={3} value={s.bodyBn ?? ''} onChange={(e) => setField(k.key, 'bodyBn', e.target.value)} />
                  </FormField>
                  <FormField label="Body (English)">
                    <Textarea rows={3} value={s.bodyEn ?? ''} onChange={(e) => setField(k.key, 'bodyEn', e.target.value)} />
                  </FormField>
                  <FormField label="Image URL">
                    <Input value={s.imageUrl ?? ''} onChange={(e) => setField(k.key, 'imageUrl', e.target.value)} placeholder="/uploads/banners/..." />
                  </FormField>
                  <FormField label="Link">
                    <Input value={s.link ?? ''} onChange={(e) => setField(k.key, 'link', e.target.value)} placeholder="/promotions" />
                  </FormField>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
