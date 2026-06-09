// Built by Anointed Coder.
//
// /admin/atelier
//
// Operator console for premium image assets (hero backdrops, tier
// crests, lottery balls, textures). Each slot maps to a SystemSetting
// row and falls back to a CSS-only render when empty.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { Palette } from 'lucide-react';
import { ATELIER_SLOTS, type AtelierSlot } from '@/lib/atelier/slots';

interface AtelierForm {
  assets: Record<string, string>;
}

const EMPTY: AtelierForm = {
  assets: Object.fromEntries(ATELIER_SLOTS.map((s) => [s.id, ''])),
};

const TIER_LABEL: Record<AtelierSlot['tier'], string> = {
  1: 'Tier 1 - Must have',
  2: 'Tier 2 - Nice to have',
  3: 'Tier 3 - Optional',
};

const TIER_HINT: Record<AtelierSlot['tier'], string> = {
  1: 'These are the assets that genuinely elevate the build past CSS alone. Start here.',
  2: 'Lottery ball renders. SVG fallback exists, but real renders make the tumbler animation cinematic.',
  3: 'Texture overlays and accent assets. Skip if you have not generated them - CSS fallback handles it.',
};

export default function AdminAtelierPage() {
  const [form, setForm] = useState<AtelierForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/atelier', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setForm({ assets: { ...EMPTY.assets, ...(data.assets ?? {}) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    setBusy(true); setError(null); setToast(null);
    try {
      const res = await fetch('/api/admin/atelier', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assets: form.assets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setToast('Saved. New assets reach players within 30 seconds.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const setSlotAndSave = async (slotId: string, value: string | null) => {
    setForm((prev) => ({ ...prev, assets: { ...prev.assets, [slotId]: value ?? '' } }));
    try {
      await fetch('/api/admin/atelier', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assets: { [slotId]: value ?? null } }),
      });
    } catch { /* swallow - Save All bar remains */ }
  };

  return (
    <>
      <PageHeader
        title="Premium Atelier"
        subtitle="Upload the photography, 3D renders and textures for the premium Spin and Lotto pages. Empty slots fall back to CSS-only renders."
        icon={<Palette className="h-5 w-5" />}
        action={<Button onClick={save} loading={busy}>Save</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700">{toast}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="space-y-8">
          {([1, 2, 3] as const).map((tier) => {
            const slots = ATELIER_SLOTS.filter((s) => s.tier === tier);
            if (slots.length === 0) return null;
            return (
              <section key={tier} className="space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink-hi">
                    {TIER_LABEL[tier]}
                  </h3>
                  <p className="mt-1 text-[12px] text-ink-mid">{TIER_HINT[tier]}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {slots.map((slot) => (
                    <Card key={slot.id} padding="md" className="space-y-3">
                      <div>
                        <p className="text-sm font-bold text-ink-hi">{slot.label}</p>
                        <p className="mt-0.5 text-[11px] text-ink-mid">{slot.description}</p>
                      </div>
                      <AdminMediaUpload
                        label="Image"
                        category="atelier"
                        constraintHint={slot.ratioHint}
                        value={form.assets[slot.id] || null}
                        onChange={(v) => { void setSlotAndSave(slot.id, v); }}
                      />
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
