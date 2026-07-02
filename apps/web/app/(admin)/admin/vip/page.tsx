// Built by Anointed Coder.
//
// /admin/vip - VIP Club management. Two sections in one page:
//   1. Tier ladder (create/edit/delete tiers, set cashback rate +
//      withdrawal limit overrides + perks copy)
//   2. Application queue (pending applications with approve/reject)
//
// Approving an application sets User.vipTierId so the next /api/vip/status
// hit shows the new tier and the withdrawal POST respects the new cap.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Crown, Plus, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';

interface Tier {
  id: string;
  name: string;
  nameBn: string | null;
  position: number;
  description: string | null;
  descriptionBn: string | null;
  cashbackRatePercent: number | null;
  withdrawalMaxAmount: number | null;
  payoutPriority: number;
  perksEn: string | null;
  perksBn: string | null;
  iconUrl: string | null;
  badgeColor: string | null;
  status: 'active' | 'hidden';
  userCount: number;
  applicationCount: number;
}

interface Application {
  id: string;
  userId: string;
  username: string;
  phone: string;
  currentTierId: string | null;
  requestedTierId: string | null;
  requestedTierName: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes: string | null;
  reviewNote: string | null;
  appliedAt: string;
  reviewedAt: string | null;
}

const BLANK_TIER: Omit<Tier, 'userCount' | 'applicationCount'> = {
  id: '',
  name: '',
  nameBn: '',
  position: 0,
  description: '',
  descriptionBn: '',
  cashbackRatePercent: null,
  withdrawalMaxAmount: null,
  payoutPriority: 0,
  perksEn: '',
  perksBn: '',
  iconUrl: '',
  badgeColor: '#f5b400',
  status: 'active',
};

export default function AdminVipPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [appsFilter, setAppsFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<typeof BLANK_TIER | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Failures inside the tier editor / review modals render inside the
  // modal body; the page error card sits behind the open overlay.
  const [editorError, setEditorError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [reviewTierId, setReviewTierId] = useState<string>('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  // Delete confirmation runs through an in-page ConfirmDialog. The
  // native confirm()/alert() pair this page used before is silently
  // suppressed in installed PWAs, so Delete looked dead.
  const [deleteTarget, setDeleteTarget] = useState<Tier | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [tiersRes, appsRes] = await Promise.all([
        fetch('/api/admin/vip/tiers', { cache: 'no-store' }),
        fetch(`/api/admin/vip/applications?status=${appsFilter}`, { cache: 'no-store' }),
      ]);
      const t = await tiersRes.json();
      const a = await appsRes.json();
      if (tiersRes.ok) setTiers(t.tiers as Tier[]);
      if (appsRes.ok) setApps(a.applications as Application[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }, [appsFilter]);
  useEffect(() => { refresh(); }, [refresh]);

  const saveTier = async () => {
    if (!editor) return;
    setBusy(true); setEditorError(null);
    const payload = {
      name: editor.name,
      nameBn: editor.nameBn || undefined,
      position: editor.position,
      description: editor.description || undefined,
      descriptionBn: editor.descriptionBn || undefined,
      cashbackRatePercent: editor.cashbackRatePercent ?? null,
      withdrawalMaxAmount: editor.withdrawalMaxAmount ?? null,
      payoutPriority: editor.payoutPriority,
      perksEn: editor.perksEn || undefined,
      perksBn: editor.perksBn || undefined,
      iconUrl: editor.iconUrl || undefined,
      badgeColor: editor.badgeColor || undefined,
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/vip/tiers/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/vip/tiers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setEditor(null);
      setToast(`Tier "${editor.name}" saved. টিয়ারটি সংরক্ষণ করা হয়েছে।`);
      setTimeout(() => setToast(null), 4000);
      await refresh();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed');
    } finally { setBusy(false); }
  };

  // Runs after the operator confirms in the ConfirmDialog.
  const removeTier = async (t: Tier) => {
    setError(null); setToast(null);
    try {
      const res = await fetch(`/api/admin/vip/tiers/${t.id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(`${j?.message ?? j?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
        return;
      }
      setToast(`Tier "${t.name}" deleted. টিয়ারটি মুছে ফেলা হয়েছে।`);
      setTimeout(() => setToast(null), 4000);
      await refresh();
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const review = async (action: 'approve' | 'reject') => {
    if (!reviewing) return;
    setBusy(true); setReviewError(null);
    try {
      const res = await fetch(`/api/admin/vip/applications/${reviewing.id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, tierId: reviewTierId || undefined, reviewNote: reviewNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      setToast(action === 'approve'
        ? `${reviewing.username} approved. আবেদনটি অনুমোদন করা হয়েছে।`
        : `${reviewing.username} rejected. আবেদনটি প্রত্যাখ্যান করা হয়েছে।`);
      setTimeout(() => setToast(null), 4000);
      setReviewing(null); setReviewTierId(''); setReviewNote('');
      await refresh();
    } catch (e) {
      // Keep the review modal open and show the failure inside it.
      setReviewError(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader
        title="VIP Club"
        subtitle={`${tiers.length} tier${tiers.length === 1 ? '' : 's'} . ${apps.filter((a) => a.status === 'pending').length} pending application${apps.filter((a) => a.status === 'pending').length === 1 ? '' : 's'}`}
        icon={<Crown className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={refresh}>Refresh</Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK_TIER, position: tiers.length + 1 })}>New tier</Button>
          </div>
        }
      />
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-mid">Tier ladder</h2>
      {loading ? <Card padding="lg">Loading...</Card> : tiers.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">No tiers yet. Create a few (e.g. Bronze, Silver, Gold, Platinum, Elite).</p></Card>
      ) : (
        <div className="space-y-2">
          {tiers.map((t) => (
            <Card key={t.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md text-ink-hi" style={{ background: t.badgeColor ?? '#f5b400' }}>
                    <Crown className="h-4 w-4" />
                  </span>
                  <p className="text-base font-extrabold text-ink-hi">{t.name}</p>
                  <Chip tone={t.status === 'active' ? 'ok' : 'neutral'}>{t.status}</Chip>
                  <span className="text-[11px] text-ink-lo">pos {t.position}</span>
                  <Chip tone="info">{t.userCount} members</Chip>
                  {t.applicationCount > 0 ? <Chip>{t.applicationCount} apps</Chip> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mid">
                  {t.cashbackRatePercent != null ? <span>Cashback: {t.cashbackRatePercent}%</span> : <span className="text-ink-lo">Cashback: (campaign default)</span>}
                  {t.withdrawalMaxAmount != null ? <span>Withdraw cap: ৳{t.withdrawalMaxAmount.toLocaleString()}</span> : <span className="text-ink-lo">Withdraw cap: (global)</span>}
                  <span>Payout priority: {t.payoutPriority}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ id: t.id, name: t.name, nameBn: t.nameBn ?? '', position: t.position, description: t.description ?? '', descriptionBn: t.descriptionBn ?? '', cashbackRatePercent: t.cashbackRatePercent, withdrawalMaxAmount: t.withdrawalMaxAmount, payoutPriority: t.payoutPriority, perksEn: t.perksEn ?? '', perksBn: t.perksBn ?? '', iconUrl: t.iconUrl ?? '', badgeColor: t.badgeColor ?? '#f5b400', status: t.status })}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(t)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-6 mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-mid">
        Applications
        <Select className="ml-2 h-7 text-xs" value={appsFilter} onChange={(e) => setAppsFilter(e.target.value as 'pending' | 'all')}>
          <option value="pending">Pending only</option>
          <option value="all">All</option>
        </Select>
      </h2>
      {apps.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">No applications.</p></Card>
      ) : (
        <div className="space-y-2">
          {apps.map((a) => (
            <Card key={a.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold text-ink-hi">{a.username}</p>
                  <span className="text-[11px] text-ink-lo">{a.phone}</span>
                  <Chip tone={a.status === 'pending' ? 'info' : a.status === 'approved' ? 'ok' : 'neutral'}>{a.status}</Chip>
                  {a.requestedTierName ? <Chip>{a.requestedTierName}</Chip> : <span className="text-[11px] text-ink-lo">any tier</span>}
                </div>
                {a.notes ? <p className="mt-1 text-xs text-ink-mid">&ldquo;{a.notes}&rdquo;</p> : null}
                {a.reviewNote ? <p className="mt-1 text-xs text-ink-lo">Admin: {a.reviewNote}</p> : null}
              </div>
              {a.status === 'pending' ? (
                <Button size="sm" onClick={() => { setReviewing(a); setReviewTierId(a.requestedTierId ?? ''); setReviewNote(''); }}>Review</Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }} title={editor?.id ? 'Edit tier' : 'New tier'} size="lg">
        {editor ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void saveTier(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name (EN)" required><Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="Gold" /></FormField>
              <FormField label="Name (BN)"><Input value={editor.nameBn ?? ''} onChange={(e) => setEditor({ ...editor, nameBn: e.target.value })} placeholder="গোল্ড" /></FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Position"><Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} /></FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as 'active' | 'hidden' })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                </Select>
              </FormField>
              <FormField label="Badge color"><Input value={editor.badgeColor ?? ''} onChange={(e) => setEditor({ ...editor, badgeColor: e.target.value })} placeholder="#f5b400" /></FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Cashback %" hint="Override per-tier (5 = 5%). Blank = use campaign rate."><Input type="number" step="0.01" min="0" max="100" value={editor.cashbackRatePercent ?? ''} onChange={(e) => setEditor({ ...editor, cashbackRatePercent: e.target.value === '' ? null : Number(e.target.value) })} placeholder="10" /></FormField>
              <FormField label="Withdraw cap (BDT)" hint="Per-request max for this tier. Blank = global limit."><Input type="number" min="0" value={editor.withdrawalMaxAmount ?? ''} onChange={(e) => setEditor({ ...editor, withdrawalMaxAmount: e.target.value === '' ? null : Number(e.target.value) })} placeholder="500000" /></FormField>
              <FormField label="Payout priority" hint="Higher = paid first in the queue."><Input type="number" min="0" value={String(editor.payoutPriority)} onChange={(e) => setEditor({ ...editor, payoutPriority: Number(e.target.value) || 0 })} /></FormField>
            </div>
            <FormField label="Description (EN)"><Textarea rows={2} value={editor.description ?? ''} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></FormField>
            <FormField label="Description (BN)"><Textarea rows={2} value={editor.descriptionBn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionBn: e.target.value })} /></FormField>
            <FormField label="Perks (EN)" hint="One per line. Rendered as a bullet list on /vip."><Textarea rows={4} value={editor.perksEn ?? ''} onChange={(e) => setEditor({ ...editor, perksEn: e.target.value })} placeholder="Dedicated account manager&#10;Priority withdrawal queue&#10;Birthday bonus" /></FormField>
            <FormField label="Perks (BN)"><Textarea rows={4} value={editor.perksBn ?? ''} onChange={(e) => setEditor({ ...editor, perksBn: e.target.value })} /></FormField>

            {editorError ? (
              <p className="text-sm text-signal-danger">Save failed: {editorError} (সংরক্ষণ ব্যর্থ হয়েছে: {editorError})</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditor(null); setEditorError(null); }}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!reviewing} onOpenChange={(v) => { if (!v && !busy) { setReviewing(null); setReviewError(null); } }} title="Review VIP application" size="md">
        {reviewing ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-mid"><b>{reviewing.username}</b> applied for <b>{reviewing.requestedTierName ?? 'any tier'}</b>.</p>
            {reviewing.notes ? <p className="rounded-md bg-ink-100 p-3 text-xs text-ink-mid">&ldquo;{reviewing.notes}&rdquo;</p> : null}
            <FormField label="Assign tier" hint="If you approve, the user goes into this tier.">
              <Select value={reviewTierId} onChange={(e) => setReviewTierId(e.target.value)}>
                <option value="">(none - reject)</option>
                {tiers.filter((t) => t.status === 'active').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Note (shown to player on reject; logged on approve)">
              <Textarea rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
            </FormField>
            {reviewError ? (
              <p className="text-sm text-signal-danger">Review failed: {reviewError} (রিভিউ ব্যর্থ হয়েছে: {reviewError})</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="danger" leftIcon={<X className="h-4 w-4" />} loading={busy} onClick={() => void review('reject')}>Reject</Button>
              <Button leftIcon={<Check className="h-4 w-4" />} loading={busy} disabled={!reviewTierId} onClick={() => void review('approve')}>Approve into tier</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete VIP tier"
        message={deleteTarget ? `Delete tier "${deleteTarget.name}"? Deletion is only allowed when no users are assigned to it.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.name}" টিয়ারটি মুছে ফেলবেন? কোনো ব্যবহারকারী এই টিয়ারে না থাকলেই কেবল মুছে ফেলা যাবে।` : ''}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await removeTier(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
