// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Tag, Plus, Pencil, Trash2, Eye } from 'lucide-react';

interface PromoCodeRow {
  id: string;
  code: string;
  titleEn: string;
  titleBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  rewardType: 'bonus_grant' | 'main_balance' | 'bonus_balance' | 'locked_balance';
  rewardAmount: number;
  turnoverX: number;
  maxRedemptions: number;
  perUserLimit: number;
  minDepositTotal: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  bonusRuleId: string | null;
  redemptionCount: number;
}

interface BonusRuleOption {
  id: string;
  name: string;
  type: string;
  turnoverX: number;
}

interface RedemptionRow {
  id: string;
  username: string;
  phone: string | null;
  amount: number;
  rewardType: string;
  status: string;
  createdAt: string;
}

const REWARD_OPTIONS: Array<{ value: PromoCodeRow['rewardType']; label: string; hint: string }> = [
  { value: 'bonus_grant', label: 'Bonus grant', hint: 'Routes through the bonus engine. Requires a Bonus Rule.' },
  { value: 'main_balance', label: 'Main balance', hint: 'Credits Wallet.balance directly. No turnover lock.' },
  { value: 'bonus_balance', label: 'Bonus balance', hint: 'Credits Wallet.bonusBalance only.' },
  { value: 'locked_balance', label: 'Locked balance (freebet)', hint: 'Credits Wallet.lockedBalance only.' },
];

const BLANK: Omit<PromoCodeRow, 'id' | 'redemptionCount'> & { id: string; redemptionCount: number } = {
  id: '',
  code: '',
  titleEn: '',
  titleBn: '',
  descriptionEn: '',
  descriptionBn: '',
  rewardType: 'bonus_grant',
  rewardAmount: 0,
  turnoverX: 0,
  maxRedemptions: 0,
  perUserLimit: 1,
  minDepositTotal: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  bonusRuleId: null,
  redemptionCount: 0,
};

// Formats an ISO timestamp for a datetime-local input in the
// OPERATOR'S LOCAL TIME. The previous toISOString().slice(0, 16)
// produced UTC, so every edit prefilled 6 hours behind Dhaka time and
// re-saving silently shifted the window.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCodeRow[]>([]);
  const [rules, setRules] = useState<BonusRuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editor, setEditor] = useState<PromoCodeRow | null>(null);
  // Save failures render INSIDE the editor modal; the page error card
  // sits behind the open modal overlay.
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Delete confirmation runs through an in-page ConfirmDialog. The
  // native confirm() is silently suppressed in installed PWAs.
  const [deleteTarget, setDeleteTarget] = useState<PromoCodeRow | null>(null);
  const [redemptionsFor, setRedemptionsFor] = useState<PromoCodeRow | null>(null);
  const [redemptionList, setRedemptionList] = useState<RedemptionRow[]>([]);
  const [redLoading, setRedLoading] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [codesRes, rulesRes] = await Promise.all([
        fetch('/api/admin/promo-codes', { cache: 'no-store' }),
        fetch('/api/admin/bonus-rules', { cache: 'no-store' }),
      ]);
      const codesData = await codesRes.json();
      if (!codesRes.ok) throw new Error(codesData.message ?? codesData.code ?? 'Failed');
      setCodes(codesData.codes ?? []);
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        const list = Array.isArray(rulesData.rules) ? rulesData.rules : [];
        setRules(
          list.map((r: { id: string; name: string; type: string; turnoverX: number }) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            turnoverX: Number(r.turnoverX),
          })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setEditorError(null);
    const payload = {
      code: editor.code,
      titleEn: editor.titleEn,
      titleBn: editor.titleBn || null,
      descriptionEn: editor.descriptionEn || null,
      descriptionBn: editor.descriptionBn || null,
      rewardType: editor.rewardType,
      rewardAmount: editor.rewardAmount,
      turnoverX: editor.turnoverX,
      maxRedemptions: editor.maxRedemptions,
      perUserLimit: editor.perUserLimit,
      minDepositTotal: editor.minDepositTotal,
      startsAt: editor.startsAt ? new Date(editor.startsAt).toISOString() : null,
      endsAt: editor.endsAt ? new Date(editor.endsAt).toISOString() : null,
      isActive: editor.isActive,
      bonusRuleId: editor.rewardType === 'bonus_grant' ? editor.bonusRuleId : null,
    };
    try {
      const isNew = !editor.id;
      const res = isNew
        ? await fetch('/api/admin/promo-codes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/promo-codes/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setEditor(null);
      setToast(`Code "${payload.code}" saved. প্রোমো কোডটি সংরক্ষণ করা হয়েছে।`);
      setTimeout(() => setToast(null), 4000);
      await refresh();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  // Runs after the operator confirms in the ConfirmDialog.
  const remove = async (c: PromoCodeRow) => {
    setError(null); setToast(null);
    try {
      const res = await fetch(`/api/admin/promo-codes/${c.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      } else {
        setToast(`Code "${c.code}" deleted. প্রোমো কোডটি মুছে ফেলা হয়েছে।`);
        setTimeout(() => setToast(null), 4000);
        refresh();
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggleActive = async (c: PromoCodeRow) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/promo-codes/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Toggle failed');
      refresh();
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Toggle failed'} (Status change failed. স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।)`);
    }
  };

  const showRedemptions = async (c: PromoCodeRow) => {
    setRedemptionsFor(c);
    setRedLoading(true);
    setRedemptionList([]);
    const res = await fetch(`/api/admin/promo-codes/${c.id}/redemptions`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setRedLoading(false);
    if (res.ok) setRedemptionList(data.redemptions ?? []);
  };

  return (
    <>
      <PageHeader
        title="Promo Codes"
        subtitle="Create single-use or multi-use codes that grant a configured payout"
        icon={<Tag className="h-5 w-5" />}
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK })}>
            New code
          </Button>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-3">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : codes.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No promo codes yet"
              description="Create your first code to give players a redeemable reward."
            />
          </Card>
        ) : (
          codes.map((c) => (
            <Card key={c.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-base-deep px-2 py-1 text-sm font-mono font-bold text-brand-yellow-400">{c.code}</code>
                  <Chip tone={c.isActive ? 'ok' : 'neutral'}>{c.isActive ? 'active' : 'hidden'}</Chip>
                  <Chip tone="info">{c.rewardType.replace('_', ' ')}</Chip>
                  <span className="text-xs text-ink-lo">{c.redemptionCount} redeemed</span>
                </div>
                <p className="text-sm font-semibold text-ink-hi">{c.titleEn}</p>
                {c.titleBn ? <p className="text-sm text-ink-mid">{c.titleBn}</p> : null}
                <p className="text-[11px] text-ink-lo">
                  {`Amount ${c.rewardAmount.toLocaleString()} BDT . Turnover ${c.turnoverX}x . Per-user ${c.perUserLimit} . Cap ${c.maxRedemptions || 'open'}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.isActive} onChange={() => toggleActive(c)} />
                <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => showRedemptions(c)}>
                  Audit
                </Button>
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(c)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(c)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }} title={editor?.id ? 'Edit Code' : 'New Code'} size="lg">
        {editor ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Code" required hint="Uppercased, letters/digits/dashes/underscores only.">
                <Input
                  value={editor.code}
                  onChange={(e) => setEditor({ ...editor, code: e.target.value.toUpperCase() })}
                  placeholder="WELCOME10"
                  disabled={Boolean(editor.id)}
                />
              </FormField>
              <FormField label="Status">
                <label className="inline-flex items-center gap-2 text-sm text-ink-mid">
                  <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: Boolean(v) })} />
                  {editor.isActive ? 'Active' : 'Hidden'}
                </label>
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title (English)" required>
                <Input value={editor.titleEn} onChange={(e) => setEditor({ ...editor, titleEn: e.target.value })} />
              </FormField>
              <FormField label="Title (Bangla)">
                <Input value={editor.titleBn ?? ''} onChange={(e) => setEditor({ ...editor, titleBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Description (English)">
                <Textarea rows={2} value={editor.descriptionEn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionEn: e.target.value })} />
              </FormField>
              <FormField label="Description (Bangla)">
                <Textarea rows={2} value={editor.descriptionBn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Reward type" required hint={REWARD_OPTIONS.find((o) => o.value === editor.rewardType)?.hint}>
                <Select
                  value={editor.rewardType}
                  onChange={(e) => setEditor({ ...editor, rewardType: e.target.value as PromoCodeRow['rewardType'] })}
                >
                  {REWARD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </FormField>
              {editor.rewardType === 'bonus_grant' ? (
                <FormField label="Bonus rule" required hint="Rule provides validity days and turnover requirement.">
                  <Select
                    value={editor.bonusRuleId ?? ''}
                    onChange={(e) => setEditor({ ...editor, bonusRuleId: e.target.value || null })}
                  >
                    <option value="">Select a rule</option>
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.type}, {r.turnoverX}x)
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <FormField label="Bonus rule" hint="Only used for bonus_grant rewards.">
                  <Input value="" disabled />
                </FormField>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Reward amount (BDT)" required>
                <Input type="number" min="0" step="1" value={String(editor.rewardAmount)} onChange={(e) => setEditor({ ...editor, rewardAmount: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Turnover (x)" hint="Locked grant requires this multiplier of wagers before withdrawal.">
                <Input type="number" min="0" step="0.5" value={String(editor.turnoverX)} onChange={(e) => setEditor({ ...editor, turnoverX: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Min deposit (BDT)" hint="0 disables the gate.">
                <Input type="number" min="0" step="1" value={String(editor.minDepositTotal)} onChange={(e) => setEditor({ ...editor, minDepositTotal: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Max redemptions" hint="0 means unlimited.">
                <Input type="number" min="0" step="1" value={String(editor.maxRedemptions)} onChange={(e) => setEditor({ ...editor, maxRedemptions: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Per-user limit" hint="1 is single-use.">
                <Input type="number" min="0" step="1" value={String(editor.perUserLimit)} onChange={(e) => setEditor({ ...editor, perUserLimit: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Starts at">
                <Input type="datetime-local" value={toLocalInput(editor.startsAt)} onChange={(e) => setEditor({ ...editor, startsAt: e.target.value || null })} />
              </FormField>
              <FormField label="Ends at">
                <Input type="datetime-local" value={toLocalInput(editor.endsAt)} onChange={(e) => setEditor({ ...editor, endsAt: e.target.value || null })} />
              </FormField>
            </div>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete promo code"
        message={deleteTarget ? `Delete code "${deleteTarget.code}"? Deletion is only allowed when no redemptions exist.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.code}" কোডটি মুছে ফেলবেন? কোনো রিডেম্পশন না থাকলেই কেবল মুছে ফেলা যাবে।` : ''}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      <Modal open={!!redemptionsFor} onOpenChange={(v) => !v && setRedemptionsFor(null)} title={redemptionsFor ? `Redemptions . ${redemptionsFor.code}` : ''} size="lg">
        {redLoading ? (
          <p className="text-sm text-ink-mid">Loading...</p>
        ) : redemptionList.length === 0 ? (
          <p className="text-sm text-ink-mid">No redemptions yet.</p>
        ) : (
          <div className="space-y-2">
            {redemptionList.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-hi">{r.username}</p>
                  <p className="truncate text-[11px] text-ink-lo">{r.phone ?? ''} . {new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-brand-yellow-700">{r.amount.toLocaleString()} BDT</p>
                  <Chip tone="info">{r.rewardType.replace('_', ' ')}</Chip>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
