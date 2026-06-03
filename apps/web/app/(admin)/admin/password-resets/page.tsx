// Built by Anointed Coder.
//
// /admin/password-resets - operator review queue for the admin-
// assisted forgot-password flow. Lists pending and recent requests.
// Approve generates a one-time token shown in a copy modal exactly
// once. Reject closes the request with an optional admin note.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { KeyRound, Check, X, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ResetRow {
  id: string;
  userId: string;
  username: string | null;
  phone: string | null;
  email: string | null;
  identifier: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'consumed';
  adminNote: string | null;
  createdAt: string;
  approvedAt: string | null;
  expiresAt: string | null;
}

export default function AdminPasswordResetsPage() {
  const [rows, setRows] = useState<ResetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenShown, setTokenShown] = useState<{ id: string; token: string; expiresAt: string } | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/password-resets', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Load failed');
      setRows((j.requests ?? []) as ResetRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const approve = async (id: string) => {
    setBusyId(id); setError(null);
    try {
      const r = await fetch(`/api/admin/password-resets/${id}/approve`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Approve failed');
      setTokenShown({ id, token: j.token, expiresAt: j.expiresAt });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Approve failed'); }
    finally { setBusyId(null); }
  };

  const submitReject = async () => {
    if (!rejectId) return;
    setBusyId(rejectId); setError(null);
    try {
      const r = await fetch(`/api/admin/password-resets/${rejectId}/reject`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adminNote: rejectNote.trim() || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Reject failed');
      setRejectId(null); setRejectNote('');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Reject failed'); }
    finally { setBusyId(null); }
  };

  const onCopy = async () => {
    if (!tokenShown) return;
    try { await navigator.clipboard.writeText(tokenShown.token); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ok */ }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<KeyRound className="h-5 w-5" />}
        title="Password resets"
        subtitle="Operator-assisted forgot-password queue. Approve to generate a one-time token shown once."
        action={<Button variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={refresh}>Reload</Button>}
      />

      {error ? <Card padding="sm" className="border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      {loading ? (
        <p className="text-sm text-brand-inkMute">Loading...</p>
      ) : rows.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-brand-inkMute">No password reset requests.</p></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const tone = r.status === 'pending' ? 'warn' : r.status === 'approved' ? 'ok' : r.status === 'consumed' ? 'neutral' : 'neutral';
            return (
              <Card key={r.id} padding="md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-hi">{r.username ?? '(unknown)'}</span>
                      <Chip tone={tone}>{r.status}</Chip>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-lo">submitted: {r.identifier ?? '-'}</p>
                    <p className="mt-0.5 text-[10px] text-ink-lo">{r.phone ? `phone ${r.phone}` : ''} {r.email ? ` . email ${r.email}` : ''}</p>
                    <p className="mt-0.5 text-[10px] text-ink-lo">requested {new Date(r.createdAt).toLocaleString()}{r.expiresAt ? ` . expires ${new Date(r.expiresAt).toLocaleString()}` : ''}</p>
                    {r.adminNote ? <p className="mt-1 text-xs text-brand-inkSoft">Admin note: {r.adminNote}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="gold" loading={busyId === r.id} leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => approve(r.id)}>Approve</Button>
                        <Button size="sm" variant="ghost" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => { setRejectId(r.id); setRejectNote(''); }}>Reject</Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!tokenShown}
        onOpenChange={(v) => { if (!v) setTokenShown(null); }}
        title="One-time reset token"
        description="This token is shown only once. Share it with the user out-of-band. The user redeems it on the reset password page."
        footer={<Button variant="gold" onClick={() => setTokenShown(null)}>Done</Button>}
      >
        {tokenShown ? (
          <div className="space-y-2">
            <div className={cn('flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-100/10 px-3 py-2')}>
              <code className="grow break-all font-mono text-xs text-amber-200">{tokenShown.token}</code>
              <button type="button" onClick={onCopy} className="inline-flex h-8 w-8 items-center justify-center rounded border border-amber-400/40 text-amber-100 hover:bg-amber-500/15">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-ink-lo">Expires {new Date(tokenShown.expiresAt).toLocaleString()}. Single-use.</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!rejectId}
        onOpenChange={(v) => { if (!v) { setRejectId(null); setRejectNote(''); } }}
        title="Reject this request"
        description="Optional note shown to other operators in the queue."
        footer={(
          <>
            <Button variant="ghost" onClick={() => { setRejectId(null); setRejectNote(''); }}>Cancel</Button>
            <Button variant="danger" loading={!!busyId} onClick={submitReject}>Reject</Button>
          </>
        )}
      >
        <textarea
          rows={3}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          className="w-full rounded-lg border border-neon/15 bg-base-panel px-3 py-2 text-sm text-ink-hi placeholder:text-ink-lo focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          placeholder="e.g. could not verify user identity over chat"
        />
      </Modal>
    </div>
  );
}
