'use client';

import { Drawer } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import type { User } from '@/types';
import { useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User | null;
  onAdjustBalance: (u: User) => void;
}

export function UserDetailDrawer({ open, onOpenChange, user, onAdjustBalance }: Props) {
  const { lang } = useLang();
  const [enabled, setEnabled] = useState(user?.status === 'active');

  if (!user) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={user.username} description={user.phone} width="440px">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-neon/10 bg-base-deep/40 p-3">
          <div>
            <p className="text-xs text-ink-lo">Account status</p>
            <p className="mt-1 text-sm capitalize text-ink-hi">{user.status}</p>
          </div>
          <Switch checked={enabled} onChange={setEnabled} label="Toggle status" />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Role" value={<span className="capitalize">{user.role.replace('_', ' ')}</span>} />
          <Field label="Country" value={user.country} />
          <Field label="Language" value={user.language === 'bn' ? 'Bangla' : 'English'} />
          <Field label="Created" value={formatDate(user.createdAt, lang)} />
          <Field label="Referral code" value={<code className="font-mono text-xs">{user.referralCode}</code>} />
          <Field label="Referred by" value={user.referredBy ? <code className="font-mono text-xs">{user.referredBy}</code> : <Chip>Direct</Chip>} />
        </dl>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Balance" value={formatBDT(user.balance)} tone="gold" />
          <Stat label="Bonus" value={formatBDT(user.bonusBalance)} tone="neon" />
          <Stat label="Locked" value={formatBDT(user.lockedBalance)} tone="cool" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Total Deposit" value={formatBDT(user.totalDeposit)} tone="cool" />
          <Stat label="Total Withdraw" value={formatBDT(user.totalWithdraw)} tone="cool" />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onAdjustBalance(user)} className="flex-1">Adjust Balance</Button>
          <Button variant="neon" className="flex-1">Reset Password</Button>
        </div>
      </div>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <dt className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</dt>
      <dd className="mt-1 text-ink-hi">{value}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'neon' | 'cool' }) {
  const map = { gold: 'ring-gold-soft', neon: 'ring-neon-soft', cool: 'border-neon/15' } as const;
  return (
    <div className={`rounded-xl border bg-base-deep/40 p-3 ${map[tone]}`}>
      <p className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={tone === 'gold' ? 'mt-1 font-semibold text-gradient-gold' : 'mt-1 font-semibold text-ink-hi'}>{value}</p>
    </div>
  );
}
