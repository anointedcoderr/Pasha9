// Built by Anointed Coder.
//
// /admin/betting-pass. Two-pane editor.
//   Pane A: runtime config. Enable + points-per-BDT for deposit and bet.
//   Pane B: tier ladder. CRUD per BettingPassRule. Operator sets
//           pointsRequired and a reward (coins / bonus / freebet / physical).
//   Pane C: recent claims + recent point events.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Sparkles, Plus, Pencil, Trash2, Save, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';

interface Config {
  enabled: boolean;
  pointsPerBdtDeposit: number;
  pointsPerBdtBet: number;
  seasonKey: string;
}

interface Rule {
  id: string;
  tier: number;
  nameEn: string;
  nameBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  iconUrl: string | null;
  pointsRequired: number;
  rewardKind: 'coins' | 'bonus' | 'freebet' | 'physical';
  rewardAmount: number;
  turnoverX: number;
  isActive: boolean;
}

interface ClaimRow {
  id: string;
  username: string | null;
  phone: string | null;
  tier: number;
  rewardKind: string;
  rewardAmount: number;
  status: string;
  createdAt: string;
}

interface EventRow {
  id: string;
  username: string | null;
  source: string;
  sourceId: string | null;
  points: number;
  createdAt: string;
}

const BLANK_RULE: Rule = {
  id: '',
  tier: 1,
  nameEn: '',
  nameBn: '',
  descriptionEn: '',
  descriptionBn: '',
  iconUrl: '',
  pointsRequired: 1000,
  rewardKind: 'coins',
  rewardAmount: 100,
  turnoverX: 0,
  isActive: true,
};

export default function AdminBettingPassPage() {
  const [config, setConfig] = useState<Config>({ enabled: true, pointsPerBdtDeposit: 1, pointsPerBdtBet: 1, seasonKey: 'season_1' });
  const [rules, setRules] = useState<Rule[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editor, setEditor] = useState<Rule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/betting-pass', { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setConfig(data.config);
      setRules(data.rules);
      setClaims(data.recentClaims);
      setEvents(data.recentEvents);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveConfig = async () => {
    setSavingConfig(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/betting-pass', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const saveRule = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        tier: Number(editor.tier),
        nameEn: editor.nameEn,
        nameBn: editor.nameBn || null,
        descriptionEn: editor.descriptionEn || null,
        descriptionBn: editor.descriptionBn || null,
        iconUrl: editor.iconUrl || null,
        pointsRequired: Number(editor.pointsRequired),
        rewardKind: editor.rewardKind,
        rewardAmount: Number(editor.rewardAmount),
        turnoverX: Number(editor.turnoverX ?? 0),
        isActive: editor.isActive,
      };
      const r = editor.id
        ? await fetch(`/api/admin/betting-pass/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/betting-pass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (id: string) => {
    if (!confirm('Delete this tier? Existing claims on this tier are cascade-deleted.')) return;
    try {
      const r = await fetch(`/api/admin/betting-pass/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <>
      <PageHeader
        title="Betting Pass"
        subtitle={loading ? 'Loading...' : `${rules.length} tier${rules.length === 1 ? '' : 's'} . ${claims.length} recent claim${claims.length === 1 ? '' : 's'}`}
        icon={<Sparkles className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {error ? <Card padding="md" className="mb-4 border-l-4 border-rose-500"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Runtime config</p>
            <h2 className="text-lg font-extrabold text-brand-ink">Point multipliers</h2>
            <p className="text-xs text-brand-inkMute">Approved deposits and accepted provider bets emit points using these multipliers. Existing events keep the rate they were issued at.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">Season {config.seasonKey}</span>
            <Switch checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">{config.enabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <FormField label="Points per 1 BDT deposit">
            <Input type="number" step="0.1" value={String(config.pointsPerBdtDeposit)} onChange={(e) => setConfig({ ...config, pointsPerBdtDeposit: Number(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Points per 1 BDT bet">
            <Input type="number" step="0.1" value={String(config.pointsPerBdtBet)} onChange={(e) => setConfig({ ...config, pointsPerBdtBet: Number(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Season key">
            <Input value={config.seasonKey} onChange={(e) => setConfig({ ...config, seasonKey: e.target.value })} placeholder="season_1" />
          </FormField>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="gold" leftIcon={<Save className="h-4 w-4" />} loading={savingConfig} onClick={saveConfig}>Save config</Button>
        </div>
      </Card>

      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Tier ladder</p>
            <h2 className="text-lg font-extrabold text-brand-ink">Rules</h2>
            <p className="text-xs text-brand-inkMute">Each row is one tier reward. pointsRequired is the lifetime points the player needs to unlock and claim.</p>
          </div>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK_RULE, tier: (rules[rules.length - 1]?.tier ?? 0) + 1, pointsRequired: (rules[rules.length - 1]?.pointsRequired ?? 0) + 1000 })}>
            New tier
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {rules.length === 0 ? (
            <p className="text-sm text-brand-inkMute">{'No tiers yet. Create the first one above. Suggested ladder: tier 1 = 1000 pts (Bronze), tier 2 = 5000 (Silver), tier 3 = 15000 (Gold).'}</p>
          ) : null}
          {rules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/15 text-[11px] font-bold text-brand-yellow-700">
                {r.tier}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-brand-ink">{r.nameEn}</p>
                <p className="truncate text-[11px] text-brand-inkMute">
                  {r.pointsRequired.toLocaleString()} pts . {r.rewardKind} {Number(r.rewardAmount).toLocaleString()}
                </p>
              </div>
              <Chip tone={r.isActive ? 'ok' : 'neutral'}>{r.isActive ? 'active' : 'paused'}</Chip>
              <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...r, nameBn: r.nameBn ?? '', descriptionEn: r.descriptionEn ?? '', descriptionBn: r.descriptionBn ?? '', iconUrl: r.iconUrl ?? '' })}>Edit</Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => removeRule(r.id)}>Delete</Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="md">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Recent claims</p>
          <h2 className="text-lg font-extrabold text-brand-ink">Tier redemptions</h2>
          <div className="mt-2 space-y-1.5">
            {claims.length === 0 ? <p className="text-xs text-brand-inkMute">No claims yet.</p> : null}
            {claims.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-brand-divider bg-brand-surface px-2 py-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-yellow-500/15 text-[10px] font-bold text-brand-yellow-700">{c.tier}</span>
                <span className="grow truncate text-xs font-semibold text-brand-ink">{c.username ?? '-'}</span>
                <span className="shrink-0 text-[11px] text-brand-inkMute">{c.rewardKind} {c.rewardAmount}</span>
                <span className="shrink-0 text-[10px] text-brand-inkMute">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="md">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Recent point events</p>
          <h2 className="text-lg font-extrabold text-brand-ink">Awards ledger</h2>
          <div className="mt-2 space-y-1.5">
            {events.length === 0 ? <p className="text-xs text-brand-inkMute">No events yet.</p> : null}
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md border border-brand-divider bg-brand-surface px-2 py-1.5">
                <Chip tone={e.source === 'deposit' ? 'info' : e.source === 'bet' ? 'ok' : 'neutral'}>{e.source}</Chip>
                <span className="grow truncate text-xs font-semibold text-brand-ink">{e.username ?? '-'}</span>
                <span className="shrink-0 font-mono text-[11px] text-brand-yellow-700">+{Number(e.points).toLocaleString()}</span>
                <span className="shrink-0 text-[10px] text-brand-inkMute">{new Date(e.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit tier' : 'New tier'} size="lg">
        {editor ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void saveRule(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Tier" required><Input type="number" min="0" value={String(editor.tier)} onChange={(e) => setEditor({ ...editor, tier: Number(e.target.value) || 0 })} /></FormField>
              <FormField label="Points required" required><Input type="number" min="0" value={String(editor.pointsRequired)} onChange={(e) => setEditor({ ...editor, pointsRequired: Number(e.target.value) || 0 })} /></FormField>
              <FormField label="Name (EN)" required><Input value={editor.nameEn} onChange={(e) => setEditor({ ...editor, nameEn: e.target.value })} placeholder="Bronze" /></FormField>
              <FormField label="Name (BN)"><Input value={editor.nameBn ?? ''} onChange={(e) => setEditor({ ...editor, nameBn: e.target.value })} placeholder="ব্রোঞ্জ" /></FormField>
              <FormField label="Reward kind">
                <Select value={editor.rewardKind} onChange={(e) => setEditor({ ...editor, rewardKind: e.target.value as Rule['rewardKind'] })}>
                  <option value="coins">Coins (bonusBalance, no turnover)</option>
                  <option value="bonus">Bonus (lockedBalance + UserBonus turnover)</option>
                  <option value="freebet">Freebet (lockedBalance, no turnover)</option>
                  <option value="physical">Physical (operator fulfils)</option>
                </Select>
              </FormField>
              <FormField label="Reward amount"><Input type="number" min="0" step="0.01" value={String(editor.rewardAmount)} onChange={(e) => setEditor({ ...editor, rewardAmount: Number(e.target.value) || 0 })} /></FormField>
              <FormField label="Turnover multiplier" hint="Used only when reward kind is bonus. 3 means amount x 3 wager required to release.">
                <Input type="number" min="0" step="0.1" value={String(editor.turnoverX)} onChange={(e) => setEditor({ ...editor, turnoverX: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <FormField label="Description (EN, optional)"><Input value={editor.descriptionEn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionEn: e.target.value })} /></FormField>
            <FormField label="Description (BN, optional)"><Input value={editor.descriptionBn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionBn: e.target.value })} /></FormField>
            <AdminMediaUpload
              label="Tier icon (optional)"
              value={editor.iconUrl}
              category="branding"
              constraintHint="PNG / JPG / WEBP / SVG, square ~256px"
              onChange={(url) => setEditor({ ...editor, iconUrl: url ?? '' })}
            />
            <div className="flex items-center justify-between rounded-lg border border-brand-divider bg-brand-surface p-3">
              <p className="text-sm font-semibold text-brand-ink">Active</p>
              <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: v })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
