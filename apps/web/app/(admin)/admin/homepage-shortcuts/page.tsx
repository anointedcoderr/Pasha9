// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { LayoutGrid, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ShortcutDef {
  key: string;
  label: string;
}

const ITEMS: ShortcutDef[] = [
  { key: 'jackpot', label: 'Jackpot' },
  { key: 'hot', label: 'Hot' },
  { key: 'slot', label: 'Slot' },
  { key: 'casino', label: 'Casino' },
  { key: 'crash', label: 'Crash' },
  { key: 'sports', label: 'Sports' },
  { key: 'fishing', label: 'Fishing' },
  { key: 'table', label: 'Table' },
];

export default function AdminHomepageShortcutsPage() {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/homepage-shortcuts', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setIcons((data.icons ?? {}) as Record<string, string>);
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
      const payload = { icons: Object.fromEntries(ITEMS.map((i) => [i.key, icons[i.key] ?? ''])) };
      const res = await fetch('/api/admin/homepage-shortcuts', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
        title="Homepage Category Icons"
        subtitle="Override the lucide icon shown for each homepage shortcut tile. Empty values use the built-in icon."
        icon={<LayoutGrid className="h-5 w-5" />}
        action={<Button onClick={save} loading={busy}>Save</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{toast}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ITEMS.map((item) => (
            <Card key={item.key} padding="lg" className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="relative h-12 w-12 overflow-hidden rounded-xl border border-brand-divider bg-base-deep">
                  {icons[item.key] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icons[item.key]} alt="" className="absolute inset-0 h-full w-full object-contain p-1" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-ink-lo">
                      lucide
                    </span>
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-hi">{item.label}</p>
                  <p className="text-[11px] text-ink-lo">Public homepage shortcut key: <code>{item.key}</code></p>
                </div>
              </div>
              <AdminMediaUpload
                label="Custom icon"
                hint="PNG, SVG or WEBP. Square works best. Falls back to the bundled lucide icon when empty."
                value={icons[item.key] || null}
                category="categories"
                constraintHint="SVG / PNG / WEBP, square, max 1 MB"
                onChange={(url) => setIcons((prev) => ({ ...prev, [item.key]: url ?? '' }))}
              />
              <FormField label="Direct URL (optional)">
                <Input
                  value={icons[item.key] ?? ''}
                  onChange={(e) => setIcons((prev) => ({ ...prev, [item.key]: e.target.value }))}
                  placeholder="/uploads/categories/..."
                />
              </FormField>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
