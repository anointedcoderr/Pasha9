'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { balanceAdjustSchema, type BalanceAdjustInput } from '@/lib/utils/validation';
import { formatBDT } from '@/lib/utils/format';
import { useEffect, useState } from 'react';
import type { User } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User | null;
  // Preselects the Type dropdown when the modal opens (the operator
  // clicked a Credit or a Debit button on the row).
  initialType?: 'credit' | 'debit';
  // Performs the real wallet write. Must THROW on failure; the thrown
  // message renders inside the modal so the operator sees it above
  // the action buttons instead of behind the overlay. The modal stays
  // open until this settles and only closes on success.
  onConfirm: (input: BalanceAdjustInput & { newBalance: number; oldBalance: number }) => void | Promise<void>;
}

export function BalanceAdjustModal({ open, onOpenChange, user, initialType, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BalanceAdjustInput>({
    resolver: zodResolver(balanceAdjustSchema),
    defaultValues: { amount: 0, reason: '', type: 'credit' },
  });

  // Re-arm the form each time the modal opens so the Type select
  // matches the button the operator clicked.
  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({ amount: 0, reason: '', type: initialType ?? 'credit' });
    }
  }, [open, initialType, reset]);

  const amount = Number(watch('amount') || 0);
  const type = watch('type');
  const sign = type === 'credit' ? 1 : -1;
  const oldBalance = user?.balance ?? 0;
  const newBalance = oldBalance + sign * Math.abs(amount);

  if (!user) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (loading) return; if (!v) { reset(); setServerError(null); } onOpenChange(v); }}
      title="Adjust Balance"
      description={`Manual change on ${user.username}. This action is logged with reason, old and new balance.`}
      size="md"
    >
      <form
        onSubmit={handleSubmit(async (values) => {
          setLoading(true);
          setServerError(null);
          try {
            await onConfirm({ ...values, oldBalance, newBalance });
            reset();
            onOpenChange(false);
          } catch (e) {
            setServerError(e instanceof Error ? e.message : 'Adjustment failed');
          } finally {
            setLoading(false);
          }
        })}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Cell label="Current balance" value={formatBDT(oldBalance)} />
          <Cell label="New balance" value={formatBDT(newBalance)} tone={sign > 0 ? 'neon' : 'danger'} />
        </div>
        <FormField label="Type" required>
          <Select {...register('type')}>
            <option value="credit">Credit (add)</option>
            <option value="debit">Debit (deduct)</option>
          </Select>
        </FormField>
        <FormField label="Amount" required error={errors.amount?.message}>
          <Input type="number" step="50" min="0" {...register('amount')} invalid={!!errors.amount} />
        </FormField>
        <FormField label="Reason" required error={errors.reason?.message} hint="At least 6 characters. Visible in the audit log.">
          <Textarea rows={3} placeholder="Example: Refund of failed deposit TRX-12345" {...register('reason')} invalid={!!errors.reason} />
        </FormField>
        <div className="flex items-start gap-2 rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 text-xs text-gold-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>This change creates a transaction record and an audit log entry tagged with your admin ID.</span>
        </div>
        {serverError ? (
          <div className="rounded-xl border border-signal-danger/40 bg-signal-danger/5 p-3">
            <p className="text-sm text-signal-danger">Adjustment failed: {serverError}</p>
            <p className="text-xs text-signal-danger">ব্যালেন্স পরিবর্তন ব্যর্থ হয়েছে। কোনো টাকা লেখা হয়নি; আবার চেষ্টা করুন।</p>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" disabled={loading} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={loading}>Confirm</Button>
        </div>
      </form>
    </Modal>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'neon' | 'danger' }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={tone === 'danger' ? 'mt-1 font-semibold text-signal-danger' : tone === 'neon' ? 'mt-1 font-semibold text-neon' : 'mt-1 font-semibold text-ink-hi'}>{value}</p>
    </div>
  );
}
