'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { mockBonusRules } from '@/lib/mock/bonuses';
import { Gift, CheckCircle2 } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

export default function BonusCenter() {
  const claimable = mockBonusRules.filter((b) => b.status === 'active');
  return (
    <>
      <PageHeader title="Bonus Center" subtitle="Available rewards and active promotions" icon={<Gift className="h-5 w-5" />} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card padding="md" tone="gold">
          <p className="text-xs uppercase tracking-wider text-gold-300">Total Earned</p>
          <p className="mt-1 text-xl font-bold text-gradient-gold">{formatBDT(4_250)}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-ink-lo">Pending</p>
          <p className="mt-1 text-xl font-bold text-ink-hi">{formatBDT(850)}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-ink-lo">Wagering Progress</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-base-deep">
            <div className="h-full w-[64%] rounded-full bg-grad-gold" />
          </div>
          <p className="mt-1 text-xs text-ink-mid">64% complete on First Deposit Bonus</p>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader title="Available bonuses" subtitle="Tap claim to lock in a reward" />
        <div className="grid gap-3">
          {claimable.map((b) => (
            <div key={b.id} className="flex flex-col items-start justify-between gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold text-ink-hi">{b.name}</p>
                <p className="mt-1 text-xs text-ink-mid">{b.description}</p>
                <p className="mt-2 text-xs text-ink-lo">Min ৳ {b.minDeposit.toLocaleString()} | Max ৳ {b.maxBonus.toLocaleString()}</p>
              </div>
              <button className="btn-gold inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Claim
              </button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
