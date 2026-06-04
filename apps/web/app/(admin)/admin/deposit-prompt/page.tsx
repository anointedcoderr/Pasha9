// Built by Anointed Coder.
//
// Admin editor for the "Deposit Required" modal that fires inside
// every native game when the player's wallet balance is below the
// bet. Title, subtitle, CTA label, background gradient/image and
// accent colour are all stored in SystemSetting and reload live
// inside the modal cache on the next open.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { AlertCircle, RefreshCw, Save, Wallet, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';

interface Settings {
  titleEn: string;
  titleBn: string;
  messageEn: string;
  messageBn: string;
  ctaEn: string;
  ctaBn: string;
  bgType: 'gradient' | 'image';
  bgImageUrl: string;
  bgImageEnabled: boolean;
  accent: 'gold' | 'royal' | 'red' | 'emerald' | 'sapphire';
}

const ACCENTS: Settings['accent'][] = ['gold', 'royal', 'red', 'emerald', 'sapphire'];

const ACCENT_PREVIEW: Record<Settings['accent'], string> = {
  gold:     'from-[#3a1f08] via-[#5a330e] to-[#1a0a06]',
  royal:    'from-[#1a0d2a] via-[#2a1062] to-[#101030]',
  red:      'from-[#260714] via-[#480818] to-[#1a0608]',
  emerald:  'from-[#08231a] via-[#0e4634] to-[#06120e]',
  sapphire: 'from-[#0a1640] via-[#102a72] to-[#04060f]',
};

export default function DepositPromptAdminPage() {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/content/deposit-prompt', { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message ?? j?.code ?? `HTTP ${res.status}`);
      setData(j as Settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/content/deposit-prompt', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setData(j as Settings);
      setToast('Saved. The modal will refresh on its next open.');
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Deposit Required modal"
        subtitle="Edit the popup players see inside the native games when their balance is below the bet."
        icon={<Wallet className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={load}>Reload</Button>
            <Button variant="gold" leftIcon={<Save className="h-3.5 w-3.5" />} loading={saving} onClick={onSave} disabled={!data}>Save</Button>
          </div>
        }
      />

      {error ? (
        <Card padding="md" className="mb-4">
          <p className="inline-flex items-center gap-2 text-sm text-signal-danger">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        </Card>
      ) : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}

      {!data ? (
        <p className="text-sm text-ink-mid">{loading ? 'Loading...' : 'No data.'}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card padding="lg">
              <CardHeader title="Copy" subtitle="English + Bangla. Both languages are required." />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Title (English)">
                  <input type="text" value={data.titleEn} maxLength={80} onChange={(e) => update('titleEn', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Title (Bangla)">
                  <input type="text" value={data.titleBn} maxLength={80} onChange={(e) => update('titleBn', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Message (English)">
                  <textarea rows={3} value={data.messageEn} maxLength={400} onChange={(e) => update('messageEn', e.target.value)} className={cn(inputCls, 'h-auto py-2')} />
                </Field>
                <Field label="Message (Bangla)">
                  <textarea rows={3} value={data.messageBn} maxLength={400} onChange={(e) => update('messageBn', e.target.value)} className={cn(inputCls, 'h-auto py-2')} />
                </Field>
                <Field label="CTA label (English)">
                  <input type="text" value={data.ctaEn} maxLength={40} onChange={(e) => update('ctaEn', e.target.value)} className={inputCls} />
                </Field>
                <Field label="CTA label (Bangla)">
                  <input type="text" value={data.ctaBn} maxLength={40} onChange={(e) => update('ctaBn', e.target.value)} className={inputCls} />
                </Field>
              </div>
            </Card>

            <Card padding="lg">
              <CardHeader title="Background" subtitle="Default is a premium gradient. Add an optional image to overlay it." />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Background type">
                  <select value={data.bgType} onChange={(e) => update('bgType', e.target.value as Settings['bgType'])} className={inputCls}>
                    <option value="gradient">Gradient only</option>
                    <option value="image">Gradient + image overlay</option>
                  </select>
                </Field>
                <Field label="Accent color">
                  <select value={data.accent} onChange={(e) => update('accent', e.target.value as Settings['accent'])} className={inputCls}>
                    {ACCENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <AdminMediaUpload
                    label="Background image"
                    hint="Renders at 55% opacity over the gradient when the overlay switch is ON."
                    value={data.bgImageUrl}
                    category="promo_background"
                    constraintHint="PNG / JPG / WEBP, ~1600x1000, max 4 MB"
                    onChange={(url) => update('bgImageUrl', url ?? '')}
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-neon/10 bg-base-panel/60 p-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-hi">Show image overlay</p>
                    <p className="text-xs text-ink-mid">When ON and bgType is image, the URL above renders at 55% opacity over the gradient. Falls back to gradient if the image fails to load.</p>
                  </div>
                  <Switch checked={data.bgImageEnabled} onChange={(v) => update('bgImageEnabled', v)} />
                </div>
              </div>
              <p className="mt-3 text-[11px] text-ink-mid">
                The modal caches settings until the next page reload on the player side. Players who already have it open in the current session keep the old copy until they navigate.
              </p>
            </Card>
          </div>

          {/* Live preview pane */}
          <div>
            <Card padding="md" className="sticky top-4">
              <CardHeader title="Preview" subtitle="Roughly matches the player view." />
              <ModalPreview data={data} />
              <p className="mt-3 text-[11px] text-ink-mid">
                See the real modal in any native game (Dice / Mines / Keno / Roulette / Slots / Crash) when wallet balance is below the bet.{' '}
                <Link className="text-gold-300 hover:underline" href="/games/dice" target="_blank" rel="noreferrer">
                  <ExternalLink className="ml-1 inline h-3 w-3" /> Open Dice
                </Link>
              </p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls = 'h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none focus:border-gold-300/60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ModalPreview({ data }: { data: Settings }) {
  const useImage = data.bgImageEnabled && data.bgType === 'image' && Boolean(data.bgImageUrl);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0613] text-white">
      <div className="relative">
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-95', ACCENT_PREVIEW[data.accent])} />
        {useImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.bgImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : null}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,213,84,0.22),transparent_55%)]" />
        <div className="relative px-5 pt-6 pb-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00]">
            <Wallet className="h-6 w-6" />
          </span>
          <h3 className="mt-2 text-lg font-extrabold leading-tight">{data.titleEn}</h3>
          <p className="mt-1 text-xs text-white/85">{data.messageEn}</p>
        </div>
      </div>
      <div className="relative grid grid-cols-2 gap-2 border-t border-white/10 bg-black/40 px-4 py-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Current</p>
          <p className="mt-0.5 text-sm font-extrabold tabular-nums">BDT 0</p>
        </div>
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">Required</p>
          <p className="mt-0.5 text-sm font-extrabold tabular-nums text-amber-100">BDT 100</p>
        </div>
      </div>
      <div className="relative flex gap-2 border-t border-white/10 bg-black/55 px-4 py-3">
        <span className="inline-flex h-9 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xs font-bold uppercase tracking-wider text-white/85">
          Keep Browsing
        </span>
        <span className="inline-flex h-9 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-xs font-extrabold uppercase tracking-wider text-[#3A1F00]">
          {data.ctaEn}
        </span>
      </div>
    </div>
  );
}
