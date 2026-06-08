// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Megaphone, Plus, Send, Trash2, AlertCircle, CheckCircle2, Eye } from 'lucide-react';

interface CampaignRow {
  id: string;
  channel: 'sms' | 'email';
  title: string;
  subject: string | null;
  body: string;
  audience: string;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'partial' | 'failed' | 'provider_setup_required';
  providerStatus: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
  actualRecipientCount: number;
}

interface RecipientRow {
  id: string;
  username: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  providerMessageId: string | null;
  error: string | null;
  sentAt: string | null;
}

const AUDIENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All users' },
  { value: 'active', label: 'Active users' },
  { value: 'depositors', label: 'Depositors' },
  { value: 'with_phone', label: 'Users with phone' },
  { value: 'with_email', label: 'Users with email' },
  { value: 'selected', label: 'Selected user IDs' },
];

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'neutral' | 'info'> = {
  draft: 'neutral',
  queued: 'info',
  sending: 'info',
  sent: 'ok',
  partial: 'warn',
  failed: 'warn',
  provider_setup_required: 'warn',
};

interface DraftState {
  channel: 'sms' | 'email';
  title: string;
  subject: string;
  body: string;
  audience: string;
  userIdsRaw: string;
}

const BLANK: DraftState = {
  channel: 'sms',
  title: '',
  subject: '',
  body: '',
  audience: 'all',
  userIdsRaw: '',
};

export default function AdminCampaignsPage() {
  const [list, setList] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(BLANK);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [audit, setAudit] = useState<{ campaign: CampaignRow | null; recipients: RecipientRow[] }>({ campaign: null, recipients: [] });

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/campaigns', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setList(data.campaigns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const payload = {
        channel: draft.channel,
        title: draft.title,
        subject: draft.channel === 'email' ? draft.subject || null : null,
        body: draft.body,
        audience: draft.audience,
        userIds:
          draft.audience === 'selected'
            ? draft.userIdsRaw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
            : undefined,
      };
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setToast('Draft saved.');
      setDraft(BLANK);
      setComposing(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const dispatchCampaign = async (id: string) => {
    if (!confirm('Dispatch this campaign now? This will attempt delivery via the configured provider.')) return;
    setError(null);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/dispatch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Dispatch failed');
      if (data.status === 'provider_setup_required') {
        setToast(`Provider setup required: ${data.providerStatus ?? 'configure provider keys before dispatching.'}`);
      } else if (data.status === 'sent') {
        setToast(`Sent to ${data.sentCount} recipient(s).`);
      } else if (data.status === 'partial') {
        setToast(`Partial send: ${data.sentCount} sent, ${data.failedCount} failed.`);
      } else if (data.status === 'failed') {
        setToast(`Send failed for all ${data.failedCount} recipient(s).`);
      } else {
        setToast(`Status: ${data.status}.`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this draft?')) return;
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data?.message ?? 'Delete failed');
    else refresh();
  };

  const openAudit = async (c: CampaignRow) => {
    setAudit({ campaign: c, recipients: [] });
    const res = await fetch(`/api/admin/campaigns/${c.id}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setAudit({ campaign: c, recipients: data.recipients ?? [] });
  };

  return (
    <>
      <PageHeader
        title="SMS and Email Campaigns"
        subtitle="Bulk SMS and email blasts. SMS dispatches via the configured /admin/notifications provider; email needs SMTP keys before any send completes."
        icon={<Megaphone className="h-5 w-5" />}
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setComposing(true)}>
            New campaign
          </Button>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{toast}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : list.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No campaigns yet"
            description="Create the first campaign to broadcast SMS or email to your players."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <Card key={c.id} padding="md">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink-hi">{c.title}</p>
                    <Chip tone="info">{c.channel.toUpperCase()}</Chip>
                    <Chip tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status.replaceAll('_', ' ')}</Chip>
                    <Chip>{c.audience.replace('_', ' ')}</Chip>
                  </div>
                  {c.subject ? <p className="text-xs text-ink-mid">Subject: {c.subject}</p> : null}
                  <p className="mt-1 text-[11px] text-ink-lo">
                    {c.actualRecipientCount} recipients . {c.sentCount} sent . {c.failedCount} failed
                  </p>
                  {c.providerStatus ? (
                    <p className="mt-1 text-[11px] text-amber-700">Provider status: {c.providerStatus}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                  <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => openAudit(c)}>
                    Recipients
                  </Button>
                  {c.status === 'draft' || c.status === 'provider_setup_required' || c.status === 'failed' ? (
                    <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} onClick={() => dispatchCampaign(c.id)}>
                      Dispatch
                    </Button>
                  ) : null}
                  {c.status === 'draft' || c.status === 'provider_setup_required' ? (
                    <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(c.id)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={composing} onOpenChange={(v) => setComposing(v)} title="New campaign" size="lg">
        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Channel" required>
              <Select value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as DraftState['channel'] })}>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </Select>
            </FormField>
            <FormField label="Audience" required>
              <Select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}>
                {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Title (admin reference)" required>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Weekend reload reminder" />
          </FormField>
          {draft.channel === 'email' ? (
            <FormField label="Email subject" required>
              <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Your weekend reload is ready" />
            </FormField>
          ) : null}
          <FormField label={draft.channel === 'sms' ? 'SMS body' : 'Email body'} required hint={draft.channel === 'sms' ? 'Keep under 160 characters for a single-segment SMS.' : 'Plain text or HTML allowed by your SMTP provider.'}>
            <Textarea rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </FormField>
          {draft.audience === 'selected' ? (
            <FormField label="Selected user IDs" hint="Comma or whitespace separated.">
              <Textarea rows={3} value={draft.userIdsRaw} onChange={(e) => setDraft({ ...draft, userIdsRaw: e.target.value })} />
            </FormField>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setComposing(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Save draft</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!audit.campaign} onOpenChange={(v) => !v && setAudit({ campaign: null, recipients: [] })} title={audit.campaign ? `Recipients . ${audit.campaign.title}` : ''} size="lg">
        {audit.recipients.length === 0 ? (
          <p className="text-sm text-ink-mid">No recipients yet.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {audit.recipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-hi">{r.username ?? '(no username)'}</p>
                  <p className="truncate text-[11px] text-ink-lo">{r.phone ?? r.email ?? ''}</p>
                </div>
                <div className="text-right">
                  <Chip tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Chip>
                  {r.error ? <p className="mt-1 text-[10px] text-rose-600">{r.error}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
