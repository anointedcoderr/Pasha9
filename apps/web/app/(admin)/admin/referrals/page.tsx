// Built by Anointed Coder.
//
// Real referral overview. Reads aggregated stats and recent links
// directly from the database (User chain + AffiliateCommission).
// The detailed CRUD for tiers + claims lives under /admin/affiliate
// and /admin/referral-claims; this page is the at-a-glance overview.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Network, RefreshCw, ArrowRight } from 'lucide-react';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

interface OverviewResponse {
  ok: true;
  stats: {
    totalInvited: number;
    totalEarned: number;
    pending: number;
    claimable: number;
    claimed: number;
  };
  topReferrers: Array<{
    affiliateId: string;
    username: string;
    activeReferrals: number;
    earned: number;
  }>;
  recentChain: Array<{
    id: string;
    referredUsername: string;
    referrerUsername: string | null;
    level: number;
    earned: number;
    status: string;
    createdAt: string;
  }>;
}

export default function AdminReferralsPage() {
  const { lang } = useLang();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/referrals/overview', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setData(j as OverviewResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const s = data?.stats;

  return (
    <>
      <PageHeader
        title="Referral Chain Management"
        subtitle="Three level commission tracking and review"
        icon={<Network className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>Refresh</Button>
            <Link href="/admin/affiliate/tiers" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-paper px-3 text-xs font-bold uppercase tracking-wider text-brand-ink hover:bg-brand-surface">
              Manage tiers <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4 border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      <div className="grid gap-4 sm:grid-cols-5">
        <Stat label="Total invited"  value={loading ? '...' : (s?.totalInvited ?? 0).toString()} />
        <Stat label="Total earned"   value={loading ? '...' : formatBDT(s?.totalEarned ?? 0)} accent />
        <Stat label="Pending"        value={loading ? '...' : formatBDT(s?.pending ?? 0)} />
        <Stat label="Claimable"      value={loading ? '...' : formatBDT(s?.claimable ?? 0)} accent />
        <Stat label="Claimed (paid)" value={loading ? '...' : formatBDT(s?.claimed ?? 0)} />
      </div>

      <Card className="mt-6" padding="lg">
        <CardHeader title="Top referrers" subtitle="Network leaders by approved + paid commissions" />
        {(data?.topReferrers ?? []).length === 0 ? (
          <p className="text-sm text-ink-mid">No commissions accrued yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {data?.topReferrers.map((u, i) => (
              <div key={u.affiliateId} className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-grad-gold text-xs font-bold text-base-deep">{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-hi">{u.username}</p>
                  <p className="text-xs text-ink-lo">{u.activeReferrals} active referral{u.activeReferrals === 1 ? '' : 's'}</p>
                </div>
                <span className="ml-auto text-sm font-semibold text-gradient-gold">{formatBDT(u.earned)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6 p-0" padding="none">
        <div className="border-b border-neon/10 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <CardHeader title="Referral relations" subtitle="Latest chain links across all users" />
          <Link href="/admin/referral-claims" className="text-xs font-bold uppercase tracking-wider text-brand-yellow-700 hover:text-brand-ink">
            Review claims
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-6 py-3 text-left">Referred user</th>
                <th className="px-6 py-3 text-left">Upline</th>
                <th className="px-6 py-3 text-left">Level</th>
                <th className="px-6 py-3 text-left">Earned</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentChain ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-6 text-center text-ink-mid">No commission rows yet.</td></tr>
              ) : data?.recentChain.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="px-6 py-3 text-ink-hi">{r.referredUsername}</td>
                  <td className="px-6 py-3 text-ink-mid">{r.referrerUsername ?? '-'}</td>
                  <td className="px-6 py-3 text-ink-mid">L{r.level}</td>
                  <td className="px-6 py-3 font-semibold text-gradient-gold">{formatBDT(r.earned)}</td>
                  <td className="px-6 py-3"><Chip tone={r.status === 'paid' ? 'ok' : r.status === 'pending' ? 'warn' : 'info'}>{r.status}</Chip></td>
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
