// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { Ticket, Pencil, Trash2, Plus, Crown, CheckCircle2 } from 'lucide-react';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';

type Accent = 'yellow' | 'blue' | 'red' | 'royal';
type Status = 'active' | 'hidden' | 'paused';

interface Draw {
  id: string;
  name: string;
  schedule?: string | null;
  drawsAt?: string | null;
  digitsCount: number;
  ticketPrice: number | string;
  prizePool: number | string;
  accent: Accent;
  position: number;
  status: Status;
}

interface ResultRow {
  id: string;
  drawId: string;
  winningNumber: string;
  publishedAt: string;
  totalWinners: number;
  totalPaid: number;
  ticketBaseValue: number;
  prize1xMult: number;
}

interface SettleDraft {
  draw: Draw;
  winningNumber: string;
  ticketBaseValue: string;
  prize1xMult: string;
  prize2xMult: string;
  prize3xMult: string;
  prizeSpecialMult: string;
  prizeConsoMult: string;
}

const BLANK: Draw = {
  id: '',
  name: '',
  schedule: '',
  drawsAt: '',
  digitsCount: 4,
  ticketPrice: 20,
  prizePool: 100000,
  accent: 'yellow',
  position: 0,
  status: 'active',
};

export default function AdminLottoPage() {
  const { lang } = useLang();
  const [draws, setDraws] = useState<Draw[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Draw | null>(null);
  const [settling, setSettling] = useState<SettleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [drawsRes, resultsRes] = await Promise.all([
        fetch('/api/admin/lotto', { cache: 'no-store' }),
        fetch('/api/content/lotto/results', { cache: 'no-store' }),
      ]);
      const drawsData = await drawsRes.json();
      if (!drawsRes.ok) throw new Error(drawsData.message ?? drawsData.code);
      setDraws((drawsData.draws ?? []) as Draw[]);
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setResults((resultsData.results ?? []) as ResultRow[]);
      }
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
    const toIso = (v?: string | null) => (v ? new Date(v).toISOString() : null);
    const payload = {
      name: editor.name,
      schedule: editor.schedule || null,
      drawsAt: toIso(editor.drawsAt),
      digitsCount: Number(editor.digitsCount),
      ticketPrice: Number(editor.ticketPrice),
      prizePool: Number(editor.prizePool),
      accent: editor.accent,
      position: Number(editor.position),
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/lotto/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/lotto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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

  const remove = async (id: string) => {
    if (!confirm('Delete this draw?')) return;
    const res = await fetch(`/api/admin/lotto/${id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  };

  const toggle = async (d: Draw) => {
    await fetch(`/api/admin/lotto/${d.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: d.status === 'active' ? 'hidden' : 'active' }),
    });
    refresh();
  };

  const settle = async () => {
    if (!settling) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        winningNumber: settling.winningNumber,
        ticketBaseValue: Number(settling.ticketBaseValue) || undefined,
        prize1xMult: Number(settling.prize1xMult) || undefined,
        prize2xMult: Number(settling.prize2xMult) || undefined,
        prize3xMult: Number(settling.prize3xMult) || undefined,
        prizeSpecialMult: Number(settling.prizeSpecialMult) || undefined,
        prizeConsoMult: Number(settling.prizeConsoMult) || undefined,
      };
      const res = await fetch(`/api/admin/lotto/${settling.draw.id}/settle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Settle failed');
      setToast(`Published ${settling.winningNumber}. ${data.totalWinners} winner(s), ${formatBDT(Number(data.totalPaid))} paid.`);
      setTimeout(() => setToast(null), 5500);
      setSettling(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Settle failed');
    } finally {
      setBusy(false);
    }
  };

  const resultByDraw = new Map<string, ResultRow>(results.map((r) => [r.drawId, r]));

  return (
    <>
      <PageHeader
        title="Lotto Draws"
        subtitle="Daily 4D lottery + settlement"
        icon={<Ticket className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: draws.length + 1 })}>New Draw</Button>}
      />

      {toast ? (
        <Card padding="md" className="mb-4">
          <p className="flex items-center gap-2 text-sm text-signal-ok">
            <CheckCircle2 className="h-4 w-4" /> {toast}
          </p>
        </Card>
      ) : null}

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          Settling a draw publishes the winning 4-digit number, evaluates every ticket attached to that draw
          (exact match wins the full first prize; any permutation wins
          <span className="font-semibold text-ink-hi"> first prize / unique-permutation-count </span>
          under iBox rules) and credits each user&apos;s Lotto Balance immediately. Second / Third / Special /
          Consolation tier automation ships in Milestone 2.
        </p>
      </Card>

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : draws.length === 0 ? (
        <Card padding="lg"><EmptyState title="No lotto draws" description="Create the first draw to populate the public lotto page." /></Card>
      ) : (
        <div className="space-y-3">
          {draws.map((d) => {
            const result = resultByDraw.get(d.id);
            return (
              <Card key={d.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-extrabold text-brand-ink">{d.name}</p>
                    <Chip tone={d.status === 'active' ? 'ok' : 'neutral'}>{d.status}</Chip>
                    {result ? (
                      <Chip tone="ok">settled · {result.winningNumber}</Chip>
                    ) : (
                      <Chip tone="warn">awaiting settlement</Chip>
                    )}
                    <span className="text-[11px] text-brand-inkMute">position {d.position}</span>
                  </div>
                  <p className="text-sm text-brand-inkSoft">{d.schedule ?? 'no schedule'}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-inkSoft">
                    <span><span className="text-brand-inkMute">Digits</span> <span className="font-bold text-brand-ink">{d.digitsCount}</span></span>
                    <span><span className="text-brand-inkMute">Ticket base</span> <span className="font-bold text-brand-ink">{formatBDT(Number(d.ticketPrice))}</span></span>
                    <span><span className="text-brand-inkMute">Prize pool</span> <span className="font-bold text-brand-ink">{formatBDT(Number(d.prizePool), { compact: true })}</span></span>
                    {d.drawsAt ? (
                      <span><span className="text-brand-inkMute">Next draw</span> <span className="font-bold text-brand-ink">{formatDateTime(d.drawsAt, lang)}</span></span>
                    ) : null}
                  </div>
                  {result ? (
                    <p className="mt-1 text-xs text-brand-inkMute">
                      Published {formatDateTime(result.publishedAt, lang)} · {result.totalWinners} winner(s) · {formatBDT(result.totalPaid)} paid out
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Switch checked={d.status === 'active'} onChange={() => toggle(d)} />
                  {!result ? (
                    <Button
                      size="sm"
                      variant="gold"
                      leftIcon={<Crown className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setSettling({
                          draw: d,
                          winningNumber: '',
                          ticketBaseValue: String(d.ticketPrice),
                          prize1xMult: '2000',
                          prize2xMult: '800',
                          prize3xMult: '300',
                          prizeSpecialMult: '150',
                          prizeConsoMult: '30',
                        })
                      }
                    >
                      Settle
                    </Button>
                  ) : null}
                  <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...d, drawsAt: d.drawsAt ? d.drawsAt.slice(0, 16) : '' })}>Edit</Button>
                  <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(d.id)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Draw' : 'New Draw'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name" required>
                <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Schedule" hint="Human readable, e.g. Daily 19:30">
              <Input value={editor.schedule ?? ''} onChange={(e) => setEditor({ ...editor, schedule: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Digits">
                <Input type="number" min="1" max="10" value={String(editor.digitsCount)} onChange={(e) => setEditor({ ...editor, digitsCount: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Ticket base value (BDT)" hint="Used as the unit prize when settling.">
                <Input type="number" min="0" step="1" value={String(editor.ticketPrice)} onChange={(e) => setEditor({ ...editor, ticketPrice: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Prize pool (BDT)">
                <Input type="number" min="0" step="1000" value={String(editor.prizePool)} onChange={(e) => setEditor({ ...editor, prizePool: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Next draw at">
                <Input type="datetime-local" value={editor.drawsAt ?? ''} onChange={(e) => setEditor({ ...editor, drawsAt: e.target.value })} />
              </FormField>
              <FormField label="Accent">
                <Select value={editor.accent} onChange={(e) => setEditor({ ...editor, accent: e.target.value as Accent })}>
                  <option value="yellow">Yellow</option>
                  <option value="blue">Blue</option>
                  <option value="red">Red</option>
                  <option value="royal">Royal</option>
                </Select>
              </FormField>
              <FormField label="Position">
                <Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <p className="text-xs text-brand-inkMute">
              Tickets are now generated automatically when a deposit is approved. Manual purchase is not supported.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!settling} onOpenChange={(v) => !v && setSettling(null)} title="Settle Draw" size="md">
        {settling ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void settle(); }}>
            <div className="rounded-xl border border-neon/10 bg-base-deep/50 p-3 text-sm">
              <p className="text-ink-mid">Draw</p>
              <p className="font-extrabold text-ink-hi">{settling.draw.name}</p>
              <p className="text-xs text-ink-lo">{settling.draw.schedule}</p>
            </div>
            <FormField label="Winning 4-digit number" required hint="Digits only, e.g. 1234 or 1111.">
              <Input
                value={settling.winningNumber}
                onChange={(e) => setSettling({ ...settling, winningNumber: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                inputMode="numeric"
                placeholder="1234"
                maxLength={4}
              />
            </FormField>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Ticket base value">
                <Input type="number" min="1" value={settling.ticketBaseValue} onChange={(e) => setSettling({ ...settling, ticketBaseValue: e.target.value })} />
              </FormField>
              <FormField label="1st prize ×">
                <Input type="number" min="1" value={settling.prize1xMult} onChange={(e) => setSettling({ ...settling, prize1xMult: e.target.value })} />
              </FormField>
              <FormField label="2nd prize ×">
                <Input type="number" min="1" value={settling.prize2xMult} onChange={(e) => setSettling({ ...settling, prize2xMult: e.target.value })} />
              </FormField>
              <FormField label="3rd prize ×">
                <Input type="number" min="1" value={settling.prize3xMult} onChange={(e) => setSettling({ ...settling, prize3xMult: e.target.value })} />
              </FormField>
              <FormField label="Special ×">
                <Input type="number" min="1" value={settling.prizeSpecialMult} onChange={(e) => setSettling({ ...settling, prizeSpecialMult: e.target.value })} />
              </FormField>
              <FormField label="Consolation ×">
                <Input type="number" min="1" value={settling.prizeConsoMult} onChange={(e) => setSettling({ ...settling, prizeConsoMult: e.target.value })} />
              </FormField>
            </div>
            <p className="text-xs text-brand-inkMute">
              M1 settles 1st prize (exact match + iBox permutations) and credits each user&apos;s Lotto Balance.
              2nd / 3rd / Special / Consolation multipliers are saved to the result record for display and are
              wired for full automation in Milestone 2.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setSettling(null)}>Cancel</Button>
              <Button type="submit" variant="gold" loading={busy} disabled={!/^\d{4}$/.test(settling.winningNumber)}>
                Publish + Settle
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
