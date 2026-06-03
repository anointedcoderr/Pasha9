// Built by Anointed Coder.
//
// /admin/deposit-notice
//
// CRUD over DepositNotice rows + global enable toggle. The public
// deposit page reads /api/content/deposit-notice and shows the
// notices when both the global toggle is on AND at least one row is
// enabled.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Bell, Plus, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NoticeRow {
  id: string;
  isEnabled: boolean;
  titleEn: string;
  titleBn: string | null;
  bodyEn: string;
  bodyBn: string | null;
  ctaLabelEn: string;
  ctaLabelBn: string | null;
  position: number;
  updatedAt: string;
}

const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export default function AdminDepositNoticePage() {
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/deposit-notices', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Load failed');
      setRows(j.notices as NoticeRow[]);
      setGlobalEnabled(Boolean(j.globalEnabled));
    } catch (e) { setError(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const patch = async (id: string, body: Partial<NoticeRow>) => {
    setSavingId(id); setError(null);
    try {
      const r = await fetch(`/api/admin/deposit-notices/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setRows((rs) => rs.map((row) => (row.id === id ? { ...row, ...(j.notice as NoticeRow) } : row)));
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSavingId(null); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    setSavingId(id);
    try {
      const r = await fetch(`/api/admin/deposit-notices/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Delete failed');
      setRows((rs) => rs.filter((row) => row.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setSavingId(null); }
  };

  const toggleGlobal = async () => {
    setTogglingGlobal(true); setError(null);
    try {
      const r = await fetch('/api/admin/deposit-notices/settings', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ globalEnabled: !globalEnabled }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Toggle failed');
      setGlobalEnabled(Boolean(j.globalEnabled));
    } catch (e) { setError(e instanceof Error ? e.message : 'Toggle failed'); }
    finally { setTogglingGlobal(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Bell className="h-5 w-5" />}
        title="Deposit notice"
        subtitle="Pre-deposit popup shown to players before the deposit form. Multiple rows render in order."
      />

      {error ? <Card padding="sm" className="border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      <Card padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Global enable</p>
            <p className="text-sm font-semibold text-brand-ink">
              {globalEnabled ? 'Popup is enabled. Player sees it on /deposit.' : 'Popup is disabled. Player skips straight to the form.'}
            </p>
          </div>
          <div className="ml-auto">
            <Button
              variant={globalEnabled ? 'ghost' : 'gold'}
              loading={togglingGlobal}
              onClick={toggleGlobal}
              leftIcon={globalEnabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            >
              {globalEnabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Notice rows</p>
            <p className="text-xs text-brand-inkMute">Per-row toggle decides whether a specific notice is part of the popup body. Order by position.</p>
          </div>
          <Button variant="gold" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add notice</Button>
        </div>

        <div className="mt-4 space-y-3">
          {rows.length === 0 && !loading ? (
            <p className="text-sm text-brand-inkMute">No notice rows yet. Add the first to populate the popup body.</p>
          ) : null}
          {rows.map((row) => (
            <NoticeEditor key={row.id} row={row} saving={savingId === row.id} onPatch={(b) => patch(row.id, b)} onDelete={() => remove(row.id)} />
          ))}
        </div>
      </Card>

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
    </div>
  );
}

function NoticeEditor({ row, saving, onPatch, onDelete }: { row: NoticeRow; saving: boolean; onPatch: (p: Partial<NoticeRow>) => void; onDelete: () => void }) {
  const [titleEn, setTitleEn] = useState(row.titleEn);
  const [titleBn, setTitleBn] = useState(row.titleBn ?? '');
  const [bodyEn, setBodyEn] = useState(row.bodyEn);
  const [bodyBn, setBodyBn] = useState(row.bodyBn ?? '');
  const [ctaLabelEn, setCtaLabelEn] = useState(row.ctaLabelEn);
  const [ctaLabelBn, setCtaLabelBn] = useState(row.ctaLabelBn ?? '');
  const [position, setPosition] = useState(String(row.position));

  useEffect(() => {
    setTitleEn(row.titleEn);
    setTitleBn(row.titleBn ?? '');
    setBodyEn(row.bodyEn);
    setBodyBn(row.bodyBn ?? '');
    setCtaLabelEn(row.ctaLabelEn);
    setCtaLabelBn(row.ctaLabelBn ?? '');
    setPosition(String(row.position));
  }, [row.id, row.titleEn, row.titleBn, row.bodyEn, row.bodyBn, row.ctaLabelEn, row.ctaLabelBn, row.position]);

  return (
    <div className={cn('rounded-lg border border-brand-divider bg-brand-surface p-3', !row.isEnabled && 'opacity-70')}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPatch({ isEnabled: !row.isEnabled })}
          disabled={saving}
          className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
            row.isEnabled ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' : 'border-brand-divider text-brand-inkMute')}
        >
          {row.isEnabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {row.isEnabled ? 'Enabled' : 'Disabled'}
        </button>
        <Button className="ml-auto" variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={onDelete} loading={saving}>
          Delete
        </Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title (EN)</span>
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title (BN)</span>
          <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className={inputCls} />
        </label>
        <label className="md:col-span-2 block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Body (EN)</span>
          <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={5} className={inputCls} />
        </label>
        <label className="md:col-span-2 block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Body (BN)</span>
          <textarea value={bodyBn} onChange={(e) => setBodyBn(e.target.value)} rows={5} className={inputCls} />
        </label>
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">CTA label (EN)</span>
          <input value={ctaLabelEn} onChange={(e) => setCtaLabelEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">CTA label (BN)</span>
          <input value={ctaLabelBn} onChange={(e) => setCtaLabelBn(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Position</span>
          <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="gold"
          leftIcon={<Save className="h-4 w-4" />}
          loading={saving}
          onClick={() => onPatch({
            titleEn,
            titleBn: titleBn.trim() ? titleBn : null,
            bodyEn,
            bodyBn: bodyBn.trim() ? bodyBn : null,
            ctaLabelEn,
            ctaLabelBn: ctaLabelBn.trim() ? ctaLabelBn : null,
            position: Number(position) || 0,
          })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function CreateModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyBn, setBodyBn] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!open) { setTitleEn(''); setTitleBn(''); setBodyEn(''); setBodyBn(''); setErr(null); } }, [open]);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/admin/deposit-notices', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titleEn, titleBn: titleBn || null,
          bodyEn, bodyBn: bodyBn || null,
          ctaLabelEn: 'I understand', ctaLabelBn: 'আমি বুঝেছি',
          isEnabled: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Create failed');
      onOpenChange(false);
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Create failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New deposit notice"
      description="Bilingual notice shown in the popup. Enable the global toggle to start showing it."
      footer={<>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="gold" loading={busy} onClick={create}>Create</Button>
      </>}
    >
      {err ? <p className="mb-3 text-sm text-rose-300">{err}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title (EN)</span>
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title (BN)</span>
          <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className={inputCls} />
        </label>
        <label className="md:col-span-2 block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Body (EN)</span>
          <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={5} className={inputCls} />
        </label>
        <label className="md:col-span-2 block"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Body (BN)</span>
          <textarea value={bodyBn} onChange={(e) => setBodyBn(e.target.value)} rows={5} className={inputCls} />
        </label>
      </div>
    </Modal>
  );
}
