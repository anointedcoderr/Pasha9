// Built by Anointed Coder.
//
// /admin/site-sounds
//
// Operator-facing console for the Spin and Lotto sound layer. Each
// row is one SoundSlot: upload, preview, clear. The master enable
// toggle and default volume slider sit at the top.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { AdminSoundUpload } from '@/components/admin/AdminSoundUpload';
import { Volume2 } from 'lucide-react';
import { SOUND_SLOTS, type SoundSlot } from '@/lib/sounds/slots';

interface SiteSoundsForm {
  enabled: boolean;
  defaultVolume: number;
  sounds: Record<string, string>;
}

const EMPTY: SiteSoundsForm = {
  enabled: true,
  defaultVolume: 70,
  sounds: Object.fromEntries(SOUND_SLOTS.map((s) => [s.id, ''])),
};

const GROUP_LABEL: Record<SoundSlot['group'], string> = {
  spin: 'Spin Wheel',
  lotto: 'Lottery',
  ui: 'Interface',
};

export default function AdminSiteSoundsPage() {
  const [form, setForm] = useState<SiteSoundsForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/site-sounds', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setForm({
        enabled: data.enabled !== false,
        defaultVolume: Number(data.defaultVolume ?? 70),
        sounds: { ...EMPTY.sounds, ...(data.sounds ?? {}) },
      });
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
      const res = await fetch('/api/admin/site-sounds', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          defaultVolume: form.defaultVolume,
          sounds: form.sounds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setToast('Saved. New sounds reach players within 30 seconds.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const setSlot = (slotId: string, value: string | null) => {
    setForm((prev) => ({ ...prev, sounds: { ...prev.sounds, [slotId]: value ?? '' } }));
  };

  // Auto-save whenever an upload completes (better UX than a save
  // button for a page mostly about uploads). The Save bar at the
  // bottom remains for the enable / volume controls.
  const setSlotAndSave = async (slotId: string, value: string | null) => {
    setSlot(slotId, value);
    try {
      await fetch('/api/admin/site-sounds', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sounds: { [slotId]: value ?? null } }),
      });
    } catch { /* silent; the user can hit Save All */ }
  };

  return (
    <>
      <PageHeader
        title="Site Sounds"
        subtitle="Upload one audio file per slot. The Spin and Lotto pages play them at the right moment."
        icon={<Volume2 className="h-5 w-5" />}
        action={<Button onClick={save} loading={busy}>Save</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700">{toast}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="space-y-6">
          {/* Master controls */}
          <Card padding="lg" className="space-y-4">
            <h3 className="text-base font-extrabold text-ink-hi">Master controls</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Switch
                checked={form.enabled}
                onChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
              />
              <div>
                <p className="text-sm font-semibold text-ink-hi">Sounds enabled site-wide</p>
                <p className="text-[11px] text-ink-mid">
                  When off, no slot plays for any player. Useful for late-night silent hours.
                </p>
              </div>
            </div>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
                Default volume: {form.defaultVolume}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.defaultVolume}
                onChange={(e) => setForm((p) => ({ ...p, defaultVolume: Number(e.target.value) }))}
                className="mt-2 w-full accent-brand-yellow-500"
              />
              <p className="text-[11px] text-brand-inkMute">
                Player can still override with the speaker icon in the header.
              </p>
            </label>
          </Card>

          {/* Slot list, grouped */}
          {(['spin', 'lotto', 'ui'] as const).map((group) => {
            const slots = SOUND_SLOTS.filter((s) => s.group === group);
            if (slots.length === 0) return null;
            return (
              <section key={group} className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink-hi">
                  {GROUP_LABEL[group]}
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {slots.map((slot) => (
                    <AdminSoundUpload
                      key={slot.id}
                      label={slot.labelEn}
                      description={slot.descriptionEn}
                      value={form.sounds[slot.id] || null}
                      onChange={(v) => { void setSlotAndSave(slot.id, v); }}
                    />
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
