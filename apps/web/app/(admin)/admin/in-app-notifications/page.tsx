// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { Bell, Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface NotificationRow {
  id: string;
  titleEn: string;
  titleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  soundUrl: string | null;
  priority: string;
  status: string;
  audience: string;
  createdAt: string;
  recipientCount: number;
}

interface ComposeState {
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  linkUrl: string;
  imageUrl: string;
  soundUrl: string;
  priority: 'low' | 'normal' | 'high';
  audience: 'all' | 'active' | 'depositors' | 'selected';
  userIdsRaw: string;
}

const BLANK: ComposeState = {
  titleEn: '',
  titleBn: '',
  bodyEn: '',
  bodyBn: '',
  linkUrl: '',
  imageUrl: '',
  soundUrl: '',
  priority: 'normal',
  audience: 'all',
  userIdsRaw: '',
};

export default function AdminInAppNotificationsPage() {
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>(BLANK);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setList(data.notifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const payload = {
        titleEn: compose.titleEn,
        titleBn: compose.titleBn || null,
        bodyEn: compose.bodyEn || null,
        bodyBn: compose.bodyBn || null,
        linkUrl: compose.linkUrl || null,
        imageUrl: compose.imageUrl || null,
        soundUrl: compose.soundUrl || null,
        priority: compose.priority,
        audience: compose.audience,
        userIds:
          compose.audience === 'selected'
            ? compose.userIdsRaw
                .split(/[\s,;]+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
      };
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Send failed');
      setToast(`Delivered to ${data.recipientCount ?? 0} recipient(s).`);
      setCompose(BLANK);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="In-app notifications"
        subtitle="Broadcast a notification that appears in the player notification bell. Live push (web push / VAPID) is a separate provider integration."
        icon={<Bell className="h-5 w-5" />}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{toast}</p></Card> : null}

      <Card padding="lg" className="mb-6">
        <form className="space-y-4" onSubmit={send}>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Title (English)" required>
              <Input value={compose.titleEn} onChange={(e) => setCompose({ ...compose, titleEn: e.target.value })} />
            </FormField>
            <FormField label="Title (Bangla)">
              <Input value={compose.titleBn} onChange={(e) => setCompose({ ...compose, titleBn: e.target.value })} />
            </FormField>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Body (English)">
              <Textarea rows={3} value={compose.bodyEn} onChange={(e) => setCompose({ ...compose, bodyEn: e.target.value })} />
            </FormField>
            <FormField label="Body (Bangla)">
              <Textarea rows={3} value={compose.bodyBn} onChange={(e) => setCompose({ ...compose, bodyBn: e.target.value })} />
            </FormField>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Audience" required>
              <Select value={compose.audience} onChange={(e) => setCompose({ ...compose, audience: e.target.value as ComposeState['audience'] })}>
                <option value="all">All users</option>
                <option value="active">Active users</option>
                <option value="depositors">Depositors</option>
                <option value="selected">Selected user IDs</option>
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={compose.priority} onChange={(e) => setCompose({ ...compose, priority: e.target.value as ComposeState['priority'] })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            </FormField>
            <FormField label="Click target URL">
              <Input value={compose.linkUrl} onChange={(e) => setCompose({ ...compose, linkUrl: e.target.value })} placeholder="/promotions" />
            </FormField>
          </div>
          {compose.audience === 'selected' ? (
            <FormField label="User IDs" hint="Comma, space or newline separated. Up to 2,000 IDs.">
              <Textarea
                rows={3}
                value={compose.userIdsRaw}
                onChange={(e) => setCompose({ ...compose, userIdsRaw: e.target.value })}
                placeholder="usr_abc, usr_def"
              />
            </FormField>
          ) : null}
          <AdminMediaUpload
            label="Notification image (optional)"
            hint="Shown in the notification card."
            value={compose.imageUrl || null}
            category="banners"
            constraintHint="PNG / JPG / WEBP, square or 16/9, max 2 MB"
            onChange={(url) => setCompose({ ...compose, imageUrl: url ?? '' })}
          />
          <FormField label="Custom sound URL (optional)" hint="Short audio file (mp3 / wav). Falls back to the browser default chime when empty.">
            <Input value={compose.soundUrl} onChange={(e) => setCompose({ ...compose, soundUrl: e.target.value })} placeholder="/uploads/sounds/ping.mp3" />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" loading={busy} leftIcon={<Send className="h-4 w-4" />}>
              Send notification
            </Button>
          </div>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-mid">History</h2>
      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : list.length === 0 ? (
        <Card padding="lg">
          <EmptyState title="No notifications sent yet" description="Compose one above to broadcast to your players." />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((n) => (
            <Card key={n.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink-hi">{n.titleEn}</p>
                    <Chip tone="info">{n.audience}</Chip>
                    <Chip tone={n.priority === 'high' ? 'warn' : 'neutral'}>{n.priority}</Chip>
                    <span className="text-[11px] text-ink-lo">{n.recipientCount} recipients</span>
                  </div>
                  {n.titleBn ? <p className="text-sm text-ink-mid">{n.titleBn}</p> : null}
                  {n.bodyEn ? <p className="mt-1 text-xs text-ink-lo whitespace-pre-line">{n.bodyEn}</p> : null}
                </div>
                <p className="text-[11px] text-ink-lo">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
