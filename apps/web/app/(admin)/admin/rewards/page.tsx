// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { formatFreeSpins, freeSpinMode, freeSpinValue, isUnlimitedFreeSpins, type FreeSpinMode } from '@/lib/rewards/free-spins';
import { Trophy, Pencil, Trash2, Plus, Disc3 } from 'lucide-react';

type Accent = 'yellow' | 'blue' | 'red' | 'green';
type Status = 'active' | 'hidden' | 'paused';
type Category = 'recharge' | 'spin' | 'bet' | 'physical' | 'misc';
type RewardType = 'recharge' | 'physical' | 'digital';

interface RewardItem {
  id: string;
  title: string;
  titleBn?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  cost: number;
  category: Category;
  rewardType: RewardType;
  accent: Accent;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  shortInstructionEn?: string | null;
  shortInstructionBn?: string | null;
  position: number;
  status: Status;
}

const BLANK: RewardItem = {
  id: '',
  title: '',
  titleBn: '',
  description: '',
  descriptionBn: '',
  cost: 1000,
  category: 'misc',
  rewardType: 'digital',
  accent: 'yellow',
  imageUrl: '',
  bannerUrl: '',
  shortInstructionEn: '',
  shortInstructionBn: '',
  position: 0,
  status: 'active',
};

export default function AdminRewardsPage() {
  const [items, setItems] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<RewardItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<RewardItem | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/rewards', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setItems((data.items ?? []) as RewardItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const payload = {
      title: editor.title,
      titleBn: editor.titleBn || null,
      description: editor.description || null,
      descriptionBn: editor.descriptionBn || null,
      cost: Number(editor.cost),
      category: editor.category,
      rewardType: editor.rewardType,
      accent: editor.accent,
      imageUrl: editor.imageUrl || null,
      bannerUrl: editor.bannerUrl || null,
      shortInstructionEn: editor.shortInstructionEn || null,
      shortInstructionBn: editor.shortInstructionBn || null,
      position: Number(editor.position),
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/rewards/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/rewards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: RewardItem) => {
    try {
      const res = await fetch(`/api/admin/rewards/${r.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Reward deleted. রিওয়ার্ড মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggle = async (r: RewardItem) => {
    try {
      const res = await fetch(`/api/admin/rewards/${r.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: r.status === 'active' ? 'hidden' : 'active' }),
      });
      if (!res.ok) {
        setError('Failed to update status. স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।');
        return;
      }
      refresh();
    } catch {
      setError('Failed to update status: network error. স্ট্যাটাস আপডেট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  return (
    <>
      <PageHeader
        title="Reward Catalog"
        subtitle="Items shown in the Reward Store tab on the public /rewards page"
        icon={<Trophy className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: items.length + 1 })}>New Reward</Button>}
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <CheckInConfigCard />
      <SpinConfigCard />

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : items.length === 0 ? (
        <Card padding="lg"><EmptyState title="No rewards" description="Add reward items so players can browse and (in M2) redeem them." /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <Card key={r.id} padding="md" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-extrabold text-brand-ink">{r.title}</p>
                <Chip tone={r.status === 'active' ? 'ok' : 'neutral'}>{r.status}</Chip>
              </div>
              <p className="text-sm text-brand-inkSoft">{r.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-inkSoft">
                <span><span className="text-brand-inkMute">Cost</span> <span className="font-bold text-brand-ink tabular-nums">{r.cost.toLocaleString()} coins</span></span>
                <span><span className="text-brand-inkMute">Category</span> <span className="font-bold text-brand-ink capitalize">{r.category}</span></span>
                <span><span className="text-brand-inkMute">Accent</span> <span className="font-bold text-brand-ink capitalize">{r.accent}</span></span>
                <span><span className="text-brand-inkMute">Position</span> <span className="font-bold text-brand-ink">{r.position}</span></span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Switch checked={r.status === 'active'} onChange={() => toggle(r)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(r)}>Edit</Button>
                  <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(r)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Reward' : 'New Reward'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title EN" required>
                <Input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
              </FormField>
              <FormField label="Title BN">
                <Input value={editor.titleBn ?? ''} onChange={(e) => setEditor({ ...editor, titleBn: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Description EN">
              <Textarea rows={2} value={editor.description ?? ''} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
            </FormField>
            <FormField label="Description BN">
              <Textarea rows={2} value={editor.descriptionBn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionBn: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-2">
              <AdminMediaUpload
                label="Reward thumbnail (square)"
                hint="Shown in the rewards grid."
                value={editor.imageUrl}
                category="promo_thumbnail"
                constraintHint="PNG / JPG / WEBP, ~400x400, max 1 MB"
                onChange={(url) => setEditor({ ...editor, imageUrl: url ?? '' })}
              />
              <AdminMediaUpload
                label="Reward banner (wide)"
                hint="Header on the reward detail panel."
                value={editor.bannerUrl}
                category="promo_background"
                constraintHint="PNG / JPG / WEBP, ~1600x1000, max 4 MB"
                onChange={(url) => setEditor({ ...editor, bannerUrl: url ?? '' })}
              />
            </div>
            <FormField label="Short claim instructions EN (shown above the claim form)">
              <Textarea rows={2} value={editor.shortInstructionEn ?? ''} onChange={(e) => setEditor({ ...editor, shortInstructionEn: e.target.value })} />
            </FormField>
            <FormField label="Short claim instructions BN">
              <Textarea rows={2} value={editor.shortInstructionBn ?? ''} onChange={(e) => setEditor({ ...editor, shortInstructionBn: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-4">
              <FormField label="Cost (coins)">
                <Input type="number" min="0" step="100" value={String(editor.cost)} onChange={(e) => setEditor({ ...editor, cost: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Category">
                <Select value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value as Category })}>
                  <option value="recharge">Recharge</option>
                  <option value="spin">Spin</option>
                  <option value="bet">Free Bet</option>
                  <option value="physical">Physical</option>
                  <option value="misc">Misc</option>
                </Select>
              </FormField>
              <FormField label="Claim flow">
                <Select value={editor.rewardType} onChange={(e) => setEditor({ ...editor, rewardType: e.target.value as RewardType })}>
                  <option value="recharge">Mobile recharge (operator + phone)</option>
                  <option value="physical">Physical (name + address)</option>
                  <option value="digital">Digital (confirm only)</option>
                </Select>
              </FormField>
              <FormField label="Accent">
                <Select value={editor.accent} onChange={(e) => setEditor({ ...editor, accent: e.target.value as Accent })}>
                  <option value="yellow">Yellow</option>
                  <option value="blue">Blue</option>
                  <option value="red">Red</option>
                  <option value="green">Green</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Position">
                <Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
            </div>
            <p className="text-xs text-brand-inkMute">Real claim, wallet deduct and prize fulfilment ship in Milestone 2.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete reward"
        message={deleteTarget ? `Delete reward "${deleteTarget.title}"? This cannot be undone.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.titleBn || deleteTarget.title}" রিওয়ার্ডটি মুছে ফেলবেন? এটি আর ফেরানো যাবে না।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Daily Check-in configuration (SystemSetting via /api/admin/rewards-config).
// Cycle length, per-day coin amounts, the deposit-per-cycle gate, and the
// lifetime activity gate. Uses rewards.write, same as this page.
// ---------------------------------------------------------------------------

interface CheckInCfg {
  enabled: boolean;
  dailyCoins: number;
  streakBonusDay7: number;
  cycleLength: number;
  dayAmounts: number[];
  requireDepositPerCycle: boolean;
  minDepositForNextCycle: number;
  minDepositRequirement: number;
  minBetRequirement: number;
  depositGateTextEn: string;
  depositGateTextBn: string;
}

const CHECKIN_DEFAULTS: CheckInCfg = {
  enabled: true,
  dailyCoins: 50,
  streakBonusDay7: 200,
  cycleLength: 7,
  dayAmounts: [],
  requireDepositPerCycle: false,
  minDepositForNextCycle: 0,
  minDepositRequirement: 50,
  minBetRequirement: 50,
  depositGateTextEn: 'Please make a new deposit to unlock the next Daily Check-in cycle.',
  depositGateTextBn: 'পরবর্তী ডেইলি চেক-ইন সাইকেল আনলক করতে অনুগ্রহ করে একটি নতুন ডিপোজিট করুন।',
};

function CheckInConfigCard() {
  const [cfg, setCfg] = useState<CheckInCfg>(CHECKIN_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perDay, setPerDay] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/rewards-config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.checkIn) return;
        const c = { ...CHECKIN_DEFAULTS, ...d.checkIn } as CheckInCfg;
        setCfg(c);
        setPerDay(Array.isArray(c.dayAmounts) && c.dayAmounts.length === (c.cycleLength || 7));
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const set = <K extends keyof CheckInCfg>(k: K, v: CheckInCfg[K]) => setCfg((p) => ({ ...p, [k]: v }));

  const cycle = Math.max(1, Math.min(60, cfg.cycleLength || 7));
  const dayValue = (i: number) => cfg.dayAmounts[i] ?? cfg.dailyCoins;
  const setDay = (i: number, v: number) => {
    const arr = Array.from({ length: cycle }, (_, j) => cfg.dayAmounts[j] ?? cfg.dailyCoins);
    arr[i] = Math.max(0, v);
    set('dayAmounts', arr);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const dayAmounts = perDay
      ? Array.from({ length: cycle }, (_, i) => Math.max(0, Math.floor(Number(cfg.dayAmounts[i] ?? cfg.dailyCoins))))
      : [];
    try {
      const res = await fetch('/api/admin/rewards-config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ checkIn: { ...cfg, cycleLength: cycle, dayAmounts } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setMsg({ ok: true, text: 'Daily check-in settings saved.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card padding="lg" className="mb-6"><p className="text-sm text-brand-inkMute">Loading check-in settings...</p></Card>;

  const days = Array.from({ length: cycle }, (_, i) => i + 1);

  return (
    <Card padding="lg" className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-brand-ink">Daily Check-in</h2>
          <p className="text-sm text-brand-inkMute">Cycle length, per-day coins, and the deposit gate for the next cycle.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-brand-inkSoft">
          <Switch checked={cfg.enabled} onChange={() => set('enabled', !cfg.enabled)} />
          {cfg.enabled ? 'Enabled' : 'Disabled'}
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <FormField label="Cycle length (days)">
          <Input type="number" min="1" max="60" value={String(cfg.cycleLength)} onChange={(e) => set('cycleLength', Math.max(1, Math.min(60, Number(e.target.value) || 7)))} />
        </FormField>
        <FormField label="Coins per day (flat)" hint="Used when per-day amounts are off.">
          <Input type="number" min="0" value={String(cfg.dailyCoins)} onChange={(e) => set('dailyCoins', Math.max(0, Number(e.target.value) || 0))} />
        </FormField>
        <FormField label="End-of-cycle bonus" hint="Extra coins on the final day (flat mode).">
          <Input type="number" min="0" value={String(cfg.streakBonusDay7)} onChange={(e) => set('streakBonusDay7', Math.max(0, Number(e.target.value) || 0))} />
        </FormField>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-brand-inkSoft">
        <Switch checked={perDay} onChange={() => setPerDay((v) => !v)} />
        Set each day&apos;s coins individually
      </label>

      {perDay ? (
        <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d, i) => (
            <FormField key={d} label={`Day ${d}`}>
              <Input type="number" min="0" value={String(dayValue(i))} onChange={(e) => setDay(i, Number(e.target.value) || 0)} />
            </FormField>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-brand-divider bg-brand-surface p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <Switch checked={cfg.requireDepositPerCycle} onChange={() => set('requireDepositPerCycle', !cfg.requireDepositPerCycle)} />
          Require a new deposit to start each new cycle
        </label>
        {cfg.requireDepositPerCycle ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <FormField label="Minimum deposit to unlock next cycle (BDT)">
              <Input type="number" min="0" value={String(cfg.minDepositForNextCycle)} onChange={(e) => set('minDepositForNextCycle', Math.max(0, Number(e.target.value) || 0))} />
            </FormField>
            <div className="hidden md:block" />
            <FormField label="Locked message EN">
              <Input value={cfg.depositGateTextEn} onChange={(e) => set('depositGateTextEn', e.target.value)} />
            </FormField>
            <FormField label="Locked message BN">
              <Input value={cfg.depositGateTextBn} onChange={(e) => set('depositGateTextBn', e.target.value)} />
            </FormField>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FormField label="Activity gate: min deposit (BDT)" hint="Lifetime deposit OR bet needed to claim check-in.">
          <Input type="number" min="0" value={String(cfg.minDepositRequirement)} onChange={(e) => set('minDepositRequirement', Math.max(0, Number(e.target.value) || 0))} />
        </FormField>
        <FormField label="Activity gate: min bet (BDT)">
          <Input type="number" min="0" value={String(cfg.minBetRequirement)} onChange={(e) => set('minBetRequirement', Math.max(0, Number(e.target.value) || 0))} />
        </FormField>
      </div>

      {msg ? <p className={`mt-3 text-sm ${msg.ok ? 'text-signal-ok' : 'text-signal-danger'}`}>{msg.text}</p> : null}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void save()} loading={saving}>Save check-in settings</Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lucky Spin configuration (SystemSetting via /api/admin/rewards-config).
// Global spin economy: on/off, title, cost per spin, daily free-spin
// allowance (off / fixed / unlimited), default turnover, and the rules
// copy. These values drive the legacy single-wheel fallback. The live
// tiered wheels override cost + free spins per tier in /admin/spin-tiers.
// ---------------------------------------------------------------------------

interface SpinCfg {
  enabled: boolean;
  titleEn: string;
  titleBn: string;
  costPerSpinCoins: number;
  freeSpinsPerDay: number;
  defaultTurnoverX: number;
  rulesEn: string;
  rulesBn: string;
}

const SPIN_DEFAULTS: SpinCfg = {
  enabled: true,
  titleEn: 'Lucky Spin',
  titleBn: 'লাকি স্পিন',
  costPerSpinCoins: 100,
  freeSpinsPerDay: 3,
  defaultTurnoverX: 3,
  rulesEn: '',
  rulesBn: '',
};

function SpinConfigCard() {
  const [cfg, setCfg] = useState<SpinCfg>(SPIN_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/rewards-config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.spin) return;
        setCfg({ ...SPIN_DEFAULTS, ...d.spin } as SpinCfg);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const set = <K extends keyof SpinCfg>(k: K, v: SpinCfg[K]) => setCfg((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/rewards-config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spin: cfg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setMsg({ ok: true, text: 'Lucky Spin settings saved.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card padding="lg" className="mb-6"><p className="text-sm text-brand-inkMute">Loading spin settings...</p></Card>;

  return (
    <Card padding="lg" className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-brand-ink">
            <Disc3 className="h-4 w-4" /> Lucky Spin
          </h2>
          <p className="text-sm text-brand-inkMute">
            Global spin economy and rules. The live tiered wheels set their own cost and free spins in{' '}
            <a href="/admin/spin-tiers" className="font-semibold text-brand-ink underline">Spin Tiers</a>; these values are the fallback for the untiered wheel.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-brand-inkSoft">
          <Switch checked={cfg.enabled} onChange={() => set('enabled', !cfg.enabled)} />
          {cfg.enabled ? 'Enabled' : 'Disabled'}
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Title EN">
          <Input value={cfg.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
        </FormField>
        <FormField label="Title BN">
          <Input value={cfg.titleBn} onChange={(e) => set('titleBn', e.target.value)} />
        </FormField>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <FormField label="Cost per spin (coins)">
          <Input type="number" min="0" value={String(cfg.costPerSpinCoins)} onChange={(e) => set('costPerSpinCoins', Math.max(0, Number(e.target.value) || 0))} />
        </FormField>
        <FormField label="Default turnover multiplier" hint="Applied to cash/bonus wins that do not set their own.">
          <Input type="number" min="0" step="0.1" value={String(cfg.defaultTurnoverX)} onChange={(e) => set('defaultTurnoverX', Math.max(0, Number(e.target.value) || 0))} />
        </FormField>
        <FormField label="Free spins per day" hint="Off, a fixed daily count, or unlimited.">
          <div className="space-y-2">
            <Select
              value={freeSpinMode(cfg.freeSpinsPerDay)}
              onChange={(e) => set('freeSpinsPerDay', freeSpinValue(e.target.value as FreeSpinMode, cfg.freeSpinsPerDay))}
            >
              <option value="off">Off (no free spins)</option>
              <option value="fixed">Fixed number per day</option>
              <option value="unlimited">Unlimited</option>
            </Select>
            {freeSpinMode(cfg.freeSpinsPerDay) === 'fixed' ? (
              <Input
                type="number"
                min="1"
                aria-label="Free spins per day (fixed daily count)"
                value={cfg.freeSpinsPerDay > 0 ? cfg.freeSpinsPerDay : 1}
                onChange={(e) => set('freeSpinsPerDay', Math.max(1, Number(e.target.value) || 1))}
              />
            ) : null}
          </div>
        </FormField>
      </div>

      {isUnlimitedFreeSpins(cfg.freeSpinsPerDay) ? (
        <p className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-brand-inkSoft">
          <span className="font-semibold text-brand-ink">Warning: </span>
          unlimited free spins let players spin the untiered wheel without limit at no coin cost. Only use this on a wheel whose segments pay Coins (non-withdrawable). Cash or Bonus segments on an unlimited wheel can be farmed for real balance.
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <FormField label="Rules EN">
          <Textarea rows={2} value={cfg.rulesEn} onChange={(e) => set('rulesEn', e.target.value)} />
        </FormField>
        <FormField label="Rules BN">
          <Textarea rows={2} value={cfg.rulesBn} onChange={(e) => set('rulesBn', e.target.value)} />
        </FormField>
      </div>

      <p className="mt-3 text-[11px] text-brand-inkMute">
        Current daily free spins: <span className="font-semibold text-brand-ink">{formatFreeSpins(cfg.freeSpinsPerDay, false)}</span>
      </p>

      {msg ? <p className={`mt-3 text-sm ${msg.ok ? 'text-signal-ok' : 'text-signal-danger'}`}>{msg.text}</p> : null}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void save()} loading={saving}>Save spin settings</Button>
      </div>
    </Card>
  );
}
