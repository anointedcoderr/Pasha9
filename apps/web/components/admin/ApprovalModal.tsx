'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Textarea } from '@/components/ui/Input';
import { formatBDT } from '@/lib/utils/format';
import { CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: 'approve' | 'reject' | null;
  title: string;
  summary: { label: string; value: string }[];
  amount: number;
  onConfirm: (note: string) => void;
}

export function ApprovalModal({ open, onOpenChange, action, title, summary, amount, onConfirm }: Props) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const approve = action === 'approve';

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) setNote(''); onOpenChange(v); }} title={title} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/50 p-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${approve ? 'bg-neon/15 text-neon' : 'bg-signal-danger/15 text-signal-danger'}`}>
            {approve ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-sm text-ink-mid">{approve ? 'Approving' : 'Rejecting'}</p>
            <p className="text-lg font-semibold text-ink-hi">{formatBDT(amount)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          {summary.map((s) => (
            <div key={s.label} className="rounded-lg border border-neon/10 bg-base-deep/40 p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-ink-lo">{s.label}</dt>
              <dd className="mt-0.5 truncate text-ink-hi">{s.value}</dd>
            </div>
          ))}
        </dl>

        <FormField
          label={approve ? 'Admin note' : 'Rejection reason'}
          hint={approve ? 'Optional. Visible on the request record.' : 'Required. Shown to the player on their deposit history.'}
        >
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={approve ? 'Verified payment in sender wallet' : 'TX ID mismatch with sender record'}
            invalid={!approve && note.trim().length > 0 && note.trim().length < 3}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={approve ? 'gold' : 'danger'}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              await new Promise((r) => setTimeout(r, 500));
              setLoading(false);
              onConfirm(note);
              setNote('');
              onOpenChange(false);
            }}
          >
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
