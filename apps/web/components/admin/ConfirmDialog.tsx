// Built by Anointed Coder.
//
// In-page confirm dialog for destructive admin actions. Replaces the
// native window.confirm(), which is silently suppressed in installed
// PWAs and in-app webviews (iOS standalone mode returns false without
// showing anything), so buttons gated behind it looked completely
// dead. This renders through the shared Radix Modal instead, so it
// works everywhere the admin panel runs.

'use client';

import { type ReactNode, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  // English body line, then the Bangla line under it.
  message: ReactNode;
  messageBn?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Called when the operator confirms. May be async; the dialog shows
  // a spinner until it settles and closes itself afterwards.
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  messageBn,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!busy) onOpenChange(v); }}
      title={
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-signal-warn" />
          {title}
        </span>
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" type="button" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant="danger" type="button" loading={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-sm text-ink-mid">{message}</p>
        {messageBn ? <p className="text-sm text-ink-mid">{messageBn}</p> : null}
      </div>
    </Modal>
  );
}
