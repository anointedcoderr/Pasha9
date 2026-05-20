'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { mockReferralChain, referralStats } from '@/lib/mock/referrals';
import { mockUsers } from '@/lib/mock/users';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Chip } from '@/components/ui/Chip';
import { Network } from 'lucide-react';

export default function AdminReferralsPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHeader title="Referral Chain Management" subtitle="Three level commission tracking and review" icon={<Network className="h-5 w-5" />} />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total invited" value={referralStats.totalInvited.toString()} />
        <Stat label="Total earned" value={formatBDT(referralStats.totalEarned)} accent />
        <Stat label="Pending" value={formatBDT(referralStats.pending)} />
        <Stat label="Claimed" value={formatBDT(referralStats.claimed)} accent />
      </div>

      <Card className="mt-6" padding="lg">
        <CardHeader title="Top referrers" subtitle="Network leaders by active downline" />
        <div className="grid gap-3 md:grid-cols-3">
          {mockUsers.slice(0, 6).map((u, i) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-grad-gold text-xs font-bold text-base-deep">{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-hi">{u.username}</p>
                <p className="text-xs text-ink-lo">{(20 - i * 2)} active referrals</p>
              </div>
              <span className="ml-auto text-sm font-semibold text-gradient-gold">{formatBDT(8500 - i * 800)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-0" padding="none">
        <div className="border-b border-neon/10 px-6 py-4">
          <CardHeader title="Referral relations" subtitle="Latest chain links across all users" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-6 py-3 text-left">Referred User</th>
                <th className="px-6 py-3 text-left">Level</th>
                <th className="px-6 py-3 text-left">Earned</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {mockReferralChain.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="px-6 py-3 text-ink-hi">{r.referredUsername}</td>
                  <td className="px-6 py-3 text-ink-mid">L{r.level}</td>
                  <td className="px-6 py-3 font-semibold text-gradient-gold">{formatBDT(r.earned)}</td>
                  <td className="px-6 py-3"><Chip tone={r.status === 'active' ? 'ok' : 'warn'}>{r.status}</Chip></td>
                  <td className="px-6 py-3 text-ink-lo">{formatDate(r.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-glow p-4">
      <p className="text-xs uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={accent ? 'mt-2 text-xl font-bold text-gradient-gold' : 'mt-2 text-xl font-bold text-ink-hi'}>{value}</p>
    </div>
  );
}
