// Built by Anointed Coder.
//
// WinGo Tournaments admin console (permission: bonuses.write). Two tabs:
//
//   Tournaments - create / edit a tournament (bilingual name, window,
//                 turnoverX, minTurnover, a top-N prize table builder),
//                 list every tournament with a status badge, a dryRun
//                 Preview of the frozen standings + intended prizes
//                 (credits NOTHING), a Void action behind the shared
//                 ConfirmDialog, a Settle now override for a live/ended
//                 tournament (also confirmed, since it pays real money),
//                 and a results/audit view of a paid tournament (final
//                 ranks, amounts and per-winner payout status).
//
//   Giveaways   - a small panel that creates a multi-use PromoCode via
//                 the existing promo plumbing and best-effort broadcasts
//                 the code to the configured Telegram group. Players
//                 redeem it on the promotions page through the unchanged
//                 redeem path; no wallet is touched here.
//
// No money logic lives on this page; the tournament engine owns every
// prize credit (idempotent, keyed) and the giveaway helper owns the
// PromoCode + Telegram broadcast. Strings are bilingual (English +
// Bangla) to match the other admin surfaces. Ships with no active
// tournament by default.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Ban,
  Coins,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Gift,
  Send,
} from 'lucide-react';

// ---------- Types (mirror the /api/admin/tournaments response shapes) ----------

interface PrizeSlot {
  rank: number;
  amount: number;
}

interface TournamentRow {
  id: string;
  nameEn: string;
  nameBn: string | null;
  status: string;
  scope: string;
  rankMetric: string;
  startsAt: string;
  endsAt: string;
  turnoverX: number;
  minTurnover: number;
  prizes: PrizeSlot[];
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  payoutCount: number;
}

interface StandingRow {
  userId: string;
  score: number;
  rank: number;
  firstActivityAt: string;
  prizeAmount: number;
}

interface PreviewLine {
  userId: string;
  rank: number;
  score: number;
  amount: number;
  status: string;
  payoutId?: string | null;
}

interface PreviewResult {
  tournamentId: string;
  status: string;
  dryRun: boolean;
  participants: number;
  paidCount: number;
  totalPaid: number;
  prizeSlots: number;
  lines: PreviewLine[];
}

interface PayoutRow {
  id: string;
  userId: string;
  rank: number;
  score: number;
  amount: number;
  status: string;
  walletTxId: string | null;
  userBonusId: string | null;
  createdAt: string;
}

interface DetailResult {
  tournament: TournamentRow;
  standings: StandingRow[];
  participants: number;
  payouts: PayoutRow[];
}

// Editor works with an ordered list of prize amounts; the rank is always
// the row index + 1 so the table is guaranteed 1..N contiguous + unique
// (exactly what the API refinement validates). This makes an invalid
// prize table impossible to build.
interface EditorState {
  id: string;
  nameEn: string;
  nameBn: string;
  startsAt: string | null;
  endsAt: string | null;
  turnoverX: number;
  minTurnover: number;
  prizeAmounts: string[];
}

const BLANK: EditorState = {
  id: '',
  nameEn: '',
  nameBn: '',
  startsAt: null,
  endsAt: null,
  turnoverX: 1,
  minTurnover: 0,
  prizeAmounts: ['', '', ''],
};

// Formats an ISO timestamp for a datetime-local input in the OPERATOR'S
// LOCAL TIME (matches the cashback / lotto editors). A naive
// toISOString().slice(0, 16) would render UTC and silently shift the
// window on re-save.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMoney(n: number): string {
  return `BDT ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function statusTone(s: string): 'ok' | 'warn' | 'info' | 'danger' | 'neutral' {
  if (s === 'active') return 'ok';
  if (s === 'ended') return 'warn';
  if (s === 'paid') return 'info';
  if (s === 'void') return 'danger';
  return 'neutral'; // draft
}

function statusLabel(s: string): string {
  switch (s) {
    case 'draft':
      return 'draft (খসড়া)';
    case 'active':
      return 'active (চলমান)';
    case 'ended':
      return 'ended (শেষ)';
    case 'paid':
      return 'paid (পরিশোধিত)';
    case 'void':
      return 'void (বাতিল)';
    default:
      return s;
  }
}

function payoutTone(s: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (s === 'paid') return 'ok';
  if (s === 'failed') return 'danger';
  if (s.startsWith('skipped')) return 'neutral';
  return 'warn';
}

export default function AdminTournamentsPage() {
  const [list, setList] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Preview (dryRun) modal state.
  const [preview, setPreview] = useState<{ tournament: TournamentRow; result: PreviewResult; standings: StandingRow[] } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  // Results / audit modal state.
  const [detail, setDetail] = useState<DetailResult | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  // Destructive actions run through the shared in-page ConfirmDialog.
  const [voidTarget, setVoidTarget] = useState<TournamentRow | null>(null);
  const [settleTarget, setSettleTarget] = useState<TournamentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TournamentRow | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/tournaments', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setList(Array.isArray(data.tournaments) ? data.tournaments : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const openNew = () => {
    setEditorError(null);
    setEditor({ ...BLANK, prizeAmounts: [...BLANK.prizeAmounts] });
  };

  const openEdit = (t: TournamentRow) => {
    setEditorError(null);
    const ordered = [...t.prizes].sort((a, b) => a.rank - b.rank).map((p) => String(p.amount));
    setEditor({
      id: t.id,
      nameEn: t.nameEn,
      nameBn: t.nameBn ?? '',
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      turnoverX: t.turnoverX,
      minTurnover: t.minTurnover,
      prizeAmounts: ordered.length > 0 ? ordered : [''],
    });
  };

  const save = async () => {
    if (!editor) return;
    setEditorError(null);

    if (!editor.nameEn.trim()) {
      setEditorError('English name is required. ইংরেজি নাম আবশ্যক।');
      return;
    }
    if (!editor.startsAt || !editor.endsAt) {
      setEditorError('Both start and end time are required. শুরু ও শেষের সময় দুটোই আবশ্যক।');
      return;
    }
    if (new Date(editor.endsAt).getTime() <= new Date(editor.startsAt).getTime()) {
      setEditorError('End time must be after the start time. শেষের সময় শুরুর সময়ের পরে হতে হবে।');
      return;
    }
    const amounts = editor.prizeAmounts.map((a) => Number(a));
    if (amounts.length === 0 || amounts.some((a) => !Number.isFinite(a) || a <= 0)) {
      setEditorError('Every prize slot needs an amount greater than 0. প্রতিটি পুরস্কারের পরিমাণ ০ এর বেশি হতে হবে।');
      return;
    }
    const prizes = amounts.map((amount, i) => ({ rank: i + 1, amount }));

    setBusy(true);
    const payload = {
      nameEn: editor.nameEn.trim(),
      nameBn: editor.nameBn.trim() || null,
      startsAt: new Date(editor.startsAt).toISOString(),
      endsAt: new Date(editor.endsAt).toISOString(),
      turnoverX: editor.turnoverX,
      minTurnover: editor.minTurnover,
      prizes,
    };
    try {
      const isNew = !editor.id;
      const res = isNew
        ? await fetch('/api/admin/tournaments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/tournaments/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        const issue = data?.issues?.[0]?.message;
        throw new Error(issue ?? data.message ?? data.code ?? 'Save failed');
      }
      setEditor(null);
      flash(`Tournament "${payload.nameEn}" saved. টুর্নামেন্টটি সংরক্ষণ করা হয়েছে।`);
      await refresh();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async (t: TournamentRow) => {
    setError(null);
    setPreviewBusy(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${t.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'preview' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Preview failed');
      setPreview({ tournament: t, result: data.preview, standings: Array.isArray(data.standings) ? data.standings : [] });
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Preview failed'} (Preview failed. প্রিভিউ ব্যর্থ হয়েছে।)`);
    } finally {
      setPreviewBusy(false);
    }
  };

  const openDetail = async (t: TournamentRow) => {
    setError(null);
    setDetailBusy(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${t.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setDetail(data);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Failed to load results'} (ফলাফল লোড ব্যর্থ হয়েছে।)`);
    } finally {
      setDetailBusy(false);
    }
  };

  const doVoid = async (t: TournamentRow) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${t.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Void failed');
      flash(`Tournament "${t.nameEn}" voided. It will never pay. টুর্নামেন্টটি বাতিল করা হয়েছে; কোনো পুরস্কার দেওয়া হবে না।`);
      await refresh();
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Void failed'} (বাতিল ব্যর্থ হয়েছে।)`);
    }
  };

  const doSettle = async (t: TournamentRow) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${t.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'settle' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Settle failed');
      const s = data.settlement;
      flash(`Settled "${t.nameEn}": paid ${s?.paidCount ?? 0} winner(s), total ${fmtMoney(Number(s?.totalPaid ?? 0))}. টুর্নামেন্টটি নিষ্পত্তি হয়েছে।`);
      await refresh();
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Settle failed'} (নিষ্পত্তি ব্যর্থ হয়েছে।)`);
    }
  };

  const doDelete = async (t: TournamentRow) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${t.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Delete failed');
      flash(`Draft "${t.nameEn}" deleted. খসড়াটি মুছে ফেলা হয়েছে।`);
      await refresh();
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Delete failed'} (ডিলিট ব্যর্থ হয়েছে।)`);
    }
  };

  return (
    <>
      <PageHeader
        title="WinGo Tournaments"
        subtitle="Total-wagered leaderboards over a WinGo window with fully automatic, idempotent prize payout when the tournament ends. Ties break by earliest activity, then user id."
        icon={<Trophy className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>New tournament</Button>}
      />

      {error ? (
        <Card padding="md" className="mb-4">
          <p className="text-sm text-signal-danger"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</p>
        </Card>
      ) : null}
      {toast ? (
        <Card padding="md" className="mb-4">
          <p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{toast}</p>
        </Card>
      ) : null}

      <Tabs defaultValue="tournaments">
        <TabsList className="mb-4">
          <TabsTrigger value="tournaments">Tournaments (টুর্নামেন্ট)</TabsTrigger>
          <TabsTrigger value="giveaways">Giveaways (গিভঅ্যাওয়ে)</TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments">
          {loading ? (
            <Card padding="lg">Loading... লোড হচ্ছে...</Card>
          ) : list.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                title="No tournaments yet"
                description="Create a WinGo tournament to reward your highest-wagering players. It activates automatically at its start time and pays the top ranks automatically when it ends."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {list.map((t) => {
                const totalPool = t.prizes.reduce((sum, p) => sum + p.amount, 0);
                const isDraft = t.status === 'draft';
                const canVoid = t.status === 'draft' || t.status === 'active' || t.status === 'ended';
                const canSettle = t.status === 'active' || t.status === 'ended';
                const isPaid = t.status === 'paid';
                return (
                  <Card key={t.id} padding="lg" className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink-hi">{t.nameEn}</p>
                        <Chip tone={statusTone(t.status)}>{statusLabel(t.status)}</Chip>
                        <span className="text-xs text-ink-lo">{t.prizes.length} prize slot(s)</span>
                        <span className="text-xs text-ink-lo">{t.payoutCount} paid</span>
                      </div>
                      {t.nameBn ? <p className="text-sm text-ink-mid">{t.nameBn}</p> : null}
                      <p className="text-[11px] text-ink-lo">
                        {fmtDateTime(t.startsAt)} to {fmtDateTime(t.endsAt)}
                      </p>
                      <p className="text-[11px] text-ink-lo">
                        Pool {fmtMoney(totalPool)} . Turnover {t.turnoverX}x . Min turnover {t.minTurnover > 0 ? fmtMoney(t.minTurnover) : 'none'}
                        {t.settledAt ? ` . settled ${fmtDateTime(t.settledAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} loading={previewBusy} onClick={() => runPreview(t)}>
                        Preview
                      </Button>
                      {isPaid ? (
                        <Button size="sm" variant="neon" leftIcon={<ClipboardList className="h-3.5 w-3.5" />} loading={detailBusy} onClick={() => openDetail(t)}>
                          Results
                        </Button>
                      ) : null}
                      {isDraft ? (
                        <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(t)}>
                          Edit
                        </Button>
                      ) : null}
                      {canSettle ? (
                        <Button size="sm" variant="ghost" leftIcon={<Coins className="h-3.5 w-3.5" />} onClick={() => setSettleTarget(t)}>
                          Settle now
                        </Button>
                      ) : null}
                      {canVoid ? (
                        <Button size="sm" variant="danger" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => setVoidTarget(t)}>
                          Void
                        </Button>
                      ) : null}
                      {isDraft ? (
                        <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(t)}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="giveaways">
          <GiveawayPanel onDone={(msg) => flash(msg)} />
        </TabsContent>
      </Tabs>

      {/* ---------- Create / edit editor ---------- */}
      <Modal
        open={!!editor}
        onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }}
        title={editor?.id ? 'Edit Tournament (draft)' : 'New Tournament'}
        size="lg"
      >
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name (English)" required>
                <Input value={editor.nameEn} onChange={(e) => setEditor({ ...editor, nameEn: e.target.value })} />
              </FormField>
              <FormField label="Name (Bangla)">
                <Input value={editor.nameBn} onChange={(e) => setEditor({ ...editor, nameBn: e.target.value })} />
              </FormField>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Starts at" required>
                <Input type="datetime-local" value={toLocalInput(editor.startsAt)} onChange={(e) => setEditor({ ...editor, startsAt: e.target.value || null })} />
              </FormField>
              <FormField label="Ends at" required>
                <Input type="datetime-local" value={toLocalInput(editor.endsAt)} onChange={(e) => setEditor({ ...editor, endsAt: e.target.value || null })} />
              </FormField>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Prize turnover (x)" hint="Applied to each prize as a wager lock. 0 = pure cash, immediately withdrawable.">
                <Input type="number" min="0" max="100" step="0.5" value={String(editor.turnoverX)} onChange={(e) => setEditor({ ...editor, turnoverX: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Minimum turnover to qualify (BDT)" hint="0 = anyone with a bet qualifies. Players below this wagered total are excluded from the ranking.">
                <Input type="number" min="0" step="1" value={String(editor.minTurnover)} onChange={(e) => setEditor({ ...editor, minTurnover: Number(e.target.value) || 0 })} />
              </FormField>
            </div>

            {/* Prize table builder. Rows ARE the ranks: row 1 = rank 1, and
                so on, so the table can never be non-contiguous. Add / remove
                slots from the end. */}
            <FormField label="Prize table (top N)" hint="Rank 1 is the highest wagered player. Amounts are credited to the winner's main balance.">
              <div className="space-y-2 rounded-xl border border-brand-divider bg-brand-paper p-3">
                {editor.prizeAmounts.map((amount, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-16 shrink-0 items-center justify-center rounded-lg border border-brand-divider bg-brand-surface text-xs font-bold uppercase tracking-wider text-brand-ink">
                      #{i + 1}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Prize amount (BDT)"
                      value={amount}
                      onChange={(e) => {
                        const next = [...editor.prizeAmounts];
                        next[i] = e.target.value;
                        setEditor({ ...editor, prizeAmounts: next });
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={editor.prizeAmounts.length <= 1}
                      onClick={() => setEditor({ ...editor, prizeAmounts: editor.prizeAmounts.filter((_, idx) => idx !== i) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setEditor({ ...editor, prizeAmounts: [...editor.prizeAmounts, ''] })}
                >
                  Add prize slot (পুরস্কার যোগ করুন)
                </Button>
                <p className="text-[11px] text-brand-inkMute">
                  If fewer players qualify than prize slots, the unused prizes are simply not paid. যদি পুরস্কারের চেয়ে কম খেলোয়াড় থাকে, বাকি পুরস্কার দেওয়া হবে না।
                </p>
              </div>
            </FormField>

            {editor.id ? (
              <p className="text-[11px] text-brand-inkMute">
                Only a draft can be edited. Once it goes live the window and prize table are frozen. শুধু খসড়া সম্পাদনা করা যায়; চালু হলে সব কিছু স্থির হয়ে যায়।
              </p>
            ) : null}

            {editorError ? (
              <p className="text-sm text-signal-danger">Save failed: {editorError}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditor(null); setEditorError(null); }}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* ---------- Preview (dryRun) ---------- */}
      <Modal open={!!preview} onOpenChange={(v) => !v && setPreview(null)} title={preview ? `Preview . ${preview.tournament.nameEn}` : ''} size="lg">
        {preview ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-sky-500/60 bg-sky-500/10 p-3">
              <p className="text-xs font-semibold text-sky-400">
                Preview only, nothing was paid. These are the frozen standings and the prizes that WOULD be credited if the tournament settled now.
                {' '}শুধুই প্রিভিউ, কোনো টাকা দেওয়া হয়নি।
              </p>
            </div>
            <p className="text-xs text-ink-mid">
              {preview.result.participants} qualifying player(s) . would pay {preview.result.paidCount} of {preview.result.prizeSlots} prize slot(s) . total {fmtMoney(preview.result.totalPaid)}.
            </p>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-lo">Intended prizes (উদ্দিষ্ট পুরস্কার)</p>
              <div className="space-y-1">
                {preview.result.lines.map((line) => (
                  <div key={line.rank} className="flex items-center justify-between gap-2 rounded border border-brand-divider bg-brand-paper px-3 py-1.5 text-xs">
                    <span className="font-semibold text-ink-hi">#{line.rank}</span>
                    <code className="flex-1 truncate px-2 font-mono text-ink-lo">{line.userId || '(no player)'}</code>
                    <span className="text-ink-lo">score {Number(line.score).toLocaleString()}</span>
                    <Chip tone={line.status === 'paid' ? 'ok' : 'neutral'}>
                      {line.status === 'paid' ? 'would pay' : line.status.replace(/_/g, ' ')}
                    </Chip>
                    <span className="font-bold text-brand-yellow-700">{fmtMoney(line.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-lo">Live standings (top 50)</p>
              <div className="max-h-[40vh] space-y-1 overflow-y-auto">
                {preview.standings.length === 0 ? (
                  <p className="text-xs text-ink-lo">No qualifying players yet. এখনো কোনো যোগ্য খেলোয়াড় নেই।</p>
                ) : (
                  preview.standings.slice(0, 50).map((row) => (
                    <div key={row.userId} className="flex items-center justify-between gap-2 rounded border border-brand-divider bg-brand-paper px-3 py-1.5 text-xs">
                      <span className="font-semibold text-ink-hi">#{row.rank}</span>
                      <code className="flex-1 truncate px-2 font-mono text-ink-lo">{row.userId}</code>
                      <span className="font-bold text-ink-mid">{fmtMoney(row.score)}</span>
                      {row.prizeAmount > 0 ? <Chip tone="gold">{fmtMoney(row.prizeAmount)}</Chip> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ---------- Results / audit (paid) ---------- */}
      <Modal open={!!detail} onOpenChange={(v) => !v && setDetail(null)} title={detail ? `Results . ${detail.tournament.nameEn}` : ''} size="lg">
        {detail ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-mid">
              Status <Chip tone={statusTone(detail.tournament.status)}>{statusLabel(detail.tournament.status)}</Chip>
              {' '}. {detail.participants} participant(s) . settled {fmtDateTime(detail.tournament.settledAt)}.
            </p>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-lo">Payouts (পেআউট)</p>
              {detail.payouts.length === 0 ? (
                <p className="text-xs text-ink-lo">No payouts recorded. কোনো পেআউট রেকর্ড নেই।</p>
              ) : (
                <div className="space-y-1">
                  {detail.payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded border border-brand-divider bg-brand-paper px-3 py-1.5 text-xs">
                      <span className="font-semibold text-ink-hi">#{p.rank}</span>
                      <code className="flex-1 truncate px-2 font-mono text-ink-lo">{p.userId}</code>
                      <span className="text-ink-lo">score {Number(p.score).toLocaleString()}</span>
                      <Chip tone={payoutTone(p.status)}>{p.status.replace(/_/g, ' ')}</Chip>
                      <span className="font-bold text-brand-yellow-700">{fmtMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-lo">Final standings (top 50)</p>
              <div className="max-h-[40vh] space-y-1 overflow-y-auto">
                {detail.standings.slice(0, 50).map((row) => (
                  <div key={row.userId} className="flex items-center justify-between gap-2 rounded border border-brand-divider bg-brand-paper px-3 py-1.5 text-xs">
                    <span className="font-semibold text-ink-hi">#{row.rank}</span>
                    <code className="flex-1 truncate px-2 font-mono text-ink-lo">{row.userId}</code>
                    <span className="font-bold text-ink-mid">{fmtMoney(row.score)}</span>
                    {row.prizeAmount > 0 ? <Chip tone="gold">{fmtMoney(row.prizeAmount)}</Chip> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ---------- Confirm dialogs ---------- */}
      <ConfirmDialog
        open={!!voidTarget}
        onOpenChange={(v) => !v && setVoidTarget(null)}
        title="Void tournament"
        message={voidTarget ? `Void "${voidTarget.nameEn}"? This is permanent. The tournament will never pay any prize.` : ''}
        messageBn={voidTarget ? `"${voidTarget.nameBn || voidTarget.nameEn}" বাতিল করবেন? এটি স্থায়ী; কোনো পুরস্কার দেওয়া হবে না।` : ''}
        confirmLabel="Void"
        onConfirm={async () => {
          if (voidTarget) await doVoid(voidTarget);
          setVoidTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!settleTarget}
        onOpenChange={(v) => !v && setSettleTarget(null)}
        title="Settle tournament now"
        message={settleTarget ? `Settle "${settleTarget.nameEn}" now? This ends the tournament immediately and credits real prize money to the top ranks. Payout is idempotent, so an already-paid rank is never paid twice.` : ''}
        messageBn={settleTarget ? `"${settleTarget.nameBn || settleTarget.nameEn}" এখনই নিষ্পত্তি করবেন? এটি টুর্নামেন্ট শেষ করে বিজয়ীদের আসল পুরস্কার দেবে। পেআউট idempotent, তাই কেউ দুইবার পাবে না।` : ''}
        confirmLabel="Settle and pay"
        onConfirm={async () => {
          if (settleTarget) await doSettle(settleTarget);
          setSettleTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete draft tournament"
        message={deleteTarget ? `Delete draft "${deleteTarget.nameEn}"? Only a draft can be deleted; a tournament that went live keeps its audit trail.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.nameBn || deleteTarget.nameEn}" খসড়াটি মুছবেন? শুধু খসড়া মোছা যায়।` : ''}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await doDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

// ---------- Giveaway panel ----------

interface BonusRuleOption {
  id: string;
  name: string;
  type: string;
  turnoverX: number;
}

const REWARD_TYPES: Array<{ value: string; labelEn: string; labelBn: string }> = [
  { value: 'main_balance', labelEn: 'Main balance (cash)', labelBn: 'মূল ব্যালেন্স' },
  { value: 'bonus_grant', labelEn: 'Bonus grant (rule)', labelBn: 'বোনাস গ্রান্ট' },
  { value: 'bonus_balance', labelEn: 'Bonus balance', labelBn: 'বোনাস ব্যালেন্স' },
  { value: 'locked_balance', labelEn: 'Locked balance', labelBn: 'লকড ব্যালেন্স' },
];

interface GiveawayState {
  code: string;
  rewardType: string;
  amount: number;
  turnoverX: number;
  maxRedemptions: number;
  perUserLimit: number;
  endsAt: string | null;
  bonusRuleId: string;
  broadcast: boolean;
}

const GIVEAWAY_BLANK: GiveawayState = {
  code: '',
  rewardType: 'main_balance',
  amount: 100,
  turnoverX: 0,
  maxRedemptions: 100,
  perUserLimit: 1,
  endsAt: null,
  bonusRuleId: '',
  broadcast: true,
};

interface GiveawayResult {
  code: string;
  rewardType: string;
  rewardAmount: number;
  maxRedemptions: number;
  perUserLimit: number;
  broadcast: { ok: boolean; skipped?: boolean; error?: string };
}

function localToIso(local: string | null): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toLocalInputG(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function GiveawayPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [form, setForm] = useState<GiveawayState>({ ...GIVEAWAY_BLANK });
  const [rules, setRules] = useState<BonusRuleOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<GiveawayResult | null>(null);

  useEffect(() => {
    fetch('/api/admin/bonus-rules', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { rules: [] }))
      .then((d) => {
        const all = Array.isArray(d.rules) ? d.rules : [];
        setRules(all.map((r: { id: string; name: string; type: string; turnoverX: number }) => ({ id: r.id, name: r.name, type: r.type, turnoverX: Number(r.turnoverX) })));
      })
      .catch(() => setRules([]));
  }, []);

  const submit = async () => {
    setErr(null);
    setResult(null);
    if (!(form.amount > 0)) {
      setErr('Amount must be greater than 0. পরিমাণ ০ এর বেশি হতে হবে।');
      return;
    }
    if (form.rewardType === 'bonus_grant' && !form.bonusRuleId) {
      setErr('A bonus grant giveaway needs a Bonus Rule. বোনাস গ্রান্টের জন্য একটি বোনাস রুল দরকার।');
      return;
    }
    setBusy(true);
    const payload = {
      code: form.code.trim() || null,
      rewardType: form.rewardType,
      amount: form.amount,
      turnoverX: form.turnoverX,
      maxRedemptions: form.maxRedemptions,
      perUserLimit: form.perUserLimit,
      endsAt: localToIso(form.endsAt),
      bonusRuleId: form.rewardType === 'bonus_grant' ? form.bonusRuleId : null,
      broadcast: form.broadcast,
    };
    try {
      const res = await fetch('/api/admin/giveaways', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        const issue = data?.issues?.[0]?.message;
        throw new Error(issue ?? data.message ?? data.code ?? 'Giveaway failed');
      }
      const promo = data.promoCode;
      setResult({
        code: promo.code,
        rewardType: promo.rewardType,
        rewardAmount: promo.rewardAmount,
        maxRedemptions: promo.maxRedemptions,
        perUserLimit: promo.perUserLimit,
        broadcast: data.broadcast ?? { ok: false, skipped: true },
      });
      onDone(`Giveaway code "${promo.code}" created. গিভঅ্যাওয়ে কোড তৈরি হয়েছে।`);
      setForm({ ...GIVEAWAY_BLANK });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Giveaway failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card padding="lg">
        <div className="mb-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-brand-yellow-700" />
          <p className="text-sm font-semibold text-ink-hi">Telegram giveaway code (টেলিগ্রাম গিভঅ্যাওয়ে কোড)</p>
        </div>
        <p className="mb-4 text-[11px] text-ink-lo">
          Creates a multi-use promo code through the standard promo plumbing and, optionally, broadcasts it to your Telegram group. Players redeem it on the promotions page. No wallet is touched here.
          {' '}একটি মাল্টি-ইউজ প্রোমো কোড তৈরি করে টেলিগ্রাম গ্রুপে পাঠায়; খেলোয়াড়রা প্রোমোশন পেজে রিডিম করে।
        </p>

        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <FormField label="Code" hint="Leave blank to auto-generate an unambiguous code.">
            <Input value={form.code} placeholder="AUTO" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </FormField>

          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Reward type" required>
              <Select value={form.rewardType} onChange={(e) => setForm({ ...form, rewardType: e.target.value })}>
                {REWARD_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.labelEn} / {r.labelBn}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Amount (BDT)" required>
              <Input type="number" min="1" step="1" value={String(form.amount)} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
            </FormField>
          </div>

          {form.rewardType === 'bonus_grant' ? (
            <FormField label="Bonus rule" required hint="The bonus engine rule this grant follows.">
              <Select value={form.bonusRuleId} onChange={(e) => setForm({ ...form, bonusRuleId: e.target.value })}>
                <option value="">Select a rule...</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.type}, {r.turnoverX}x)</option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField label="Turnover (x)" hint="Wager lock applied on redemption. 0 = pure cash.">
              <Input type="number" min="0" max="100" step="0.5" value={String(form.turnoverX)} onChange={(e) => setForm({ ...form, turnoverX: Number(e.target.value) || 0 })} />
            </FormField>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Max redemptions" required hint="Total number of players who can use the code.">
              <Input type="number" min="1" step="1" value={String(form.maxRedemptions)} onChange={(e) => setForm({ ...form, maxRedemptions: Number(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Per-user limit" hint="Usually 1.">
              <Input type="number" min="0" step="1" value={String(form.perUserLimit)} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) || 0 })} />
            </FormField>
          </div>

          <FormField label="Expiry (optional)">
            <Input type="datetime-local" value={toLocalInputG(form.endsAt)} onChange={(e) => setForm({ ...form, endsAt: e.target.value || null })} />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-ink-mid">
            <Switch checked={form.broadcast} onChange={(v) => setForm({ ...form, broadcast: Boolean(v) })} />
            Broadcast to Telegram group (টেলিগ্রাম গ্রুপে পাঠান)
          </label>

          {err ? <p className="text-sm text-signal-danger"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{err}</p> : null}

          <Button type="submit" loading={busy} leftIcon={<Send className="h-4 w-4" />}>
            Create giveaway
          </Button>
        </form>
      </Card>

      <Card padding="lg">
        <p className="mb-3 text-sm font-semibold text-ink-hi">Last created code (সর্বশেষ কোড)</p>
        {result ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-brand-yellow-500/40 bg-brand-yellow-500/10 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-ink-lo">Giveaway code</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-brand-yellow-700">{result.code}</p>
            </div>
            <p className="text-xs text-ink-mid">
              {fmtMoney(result.rewardAmount)} . {result.rewardType.replace(/_/g, ' ')} . up to {result.maxRedemptions.toLocaleString()} uses . {result.perUserLimit} per user.
            </p>
            <div className="rounded-lg border border-brand-divider bg-brand-paper p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-lo">Telegram broadcast</p>
              {result.broadcast.ok ? (
                <p className="mt-1 text-xs text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Sent to the Telegram group. টেলিগ্রাম গ্রুপে পাঠানো হয়েছে।</p>
              ) : result.broadcast.skipped ? (
                <p className="mt-1 text-xs text-ink-lo">Skipped: {result.broadcast.error ?? 'Telegram is not configured.'} (এড়ানো হয়েছে।)</p>
              ) : (
                <p className="mt-1 text-xs text-signal-danger">Failed: {result.broadcast.error ?? 'unknown'}. The code was still created. (কোডটি তৈরি হয়েছে, তবে পাঠানো ব্যর্থ।)</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-lo">Create a giveaway to see the code and broadcast result here. এখানে তৈরি কোড ও ব্রডকাস্ট ফলাফল দেখা যাবে।</p>
        )}
      </Card>
    </div>
  );
}
