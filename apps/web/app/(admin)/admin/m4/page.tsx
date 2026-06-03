// Built by Anointed Coder.
//
// /admin/m4 - read-only Phase A landing console.
//
// Not yet wired into the admin sidebar. Hit it directly to confirm
// the Phase A schema landed and the seed populated the baseline rows
// on the VPS. Phases B-G replace each upcoming-surface placeholder
// with the real admin page.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sparkles, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

interface HealthResponse {
  ok: boolean;
  tables: Record<string, number>;
  phaseAComplete: boolean;
}

const UPCOMING = [
  { phase: 'B', label: 'Homepage game sections', path: '/admin/homepage-sections', detail: 'Featured-game picker (max 20), section show/hide/sort/title.' },
  { phase: 'C', label: 'Deposit notice + tier bonus', path: '/admin/deposit-notice', detail: 'Notice popup editor, tier bonus table, mandatory reject reason.' },
  { phase: 'C', label: 'Deposit bonus tiers', path: '/admin/deposit-bonus-tiers', detail: 'Threshold table (1000 / 5000 / 10000 etc) mapped to BonusRule rows.' },
  { phase: 'D', label: 'Promotion editor with banners', path: '/admin/promotions', detail: 'Per-promo desktop / mobile banner uploads + typed claim flows.' },
  { phase: 'E', label: 'Referral claims and balances', path: '/admin/referral-claims', detail: 'Pending / claimable / claimed ledger, weekly cadence.' },
  { phase: 'F', label: 'Lotto polish', path: '/admin/lotto', detail: 'Date-filter result history, auto-publish toggle.' },
  { phase: 'G', label: 'About + public payment display', path: '/admin/about', detail: 'Ambassadors, sponsors, public payment-method pills.' },
];

export default function AdminM4Page() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/m4/health', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setData(j as HealthResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Sparkles className="h-5 w-5" />}
        title="M4 launch readiness"
        subtitle="Phase A health check and upcoming-surface map. Phases B through H land the full admin UIs."
      />

      <Card padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Phase A status</p>
            <p className="mt-1 text-lg font-semibold text-brand-ink">
              {loading ? 'Loading...' : data?.phaseAComplete ? 'Schema + baseline seed present' : 'Baseline seed missing - run pnpm seed'}
            </p>
          </div>
          <Button variant="ghost" onClick={refresh} loading={loading}>Refresh</Button>
        </div>
        {error ? <p className="mt-3 text-sm text-signal-danger">{error}</p> : null}
        {data ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4">
            {Object.entries(data.tables).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-brand-inkMute">{k}</p>
                <p className="mt-1 text-base font-bold text-brand-ink">{v}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card padding="md">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Upcoming admin surfaces</p>
        <p className="mt-1 text-xs text-brand-inkMute">Links resolve to a 404 today; each phase replaces the placeholder with the real page.</p>
        <div className="mt-3 space-y-2">
          {UPCOMING.map((u) => (
            <div key={u.path} className="flex items-start gap-3 rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/15 text-[11px] font-bold text-brand-yellow-700">
                {u.phase}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-ink">{u.label}</p>
                <p className="text-[11px] text-brand-inkMute">{u.detail}</p>
              </div>
              <Link
                href={u.path}
                className="inline-flex items-center gap-1 rounded-md border border-brand-divider px-2 py-1 text-[11px] text-brand-inkSoft hover:text-brand-ink"
              >
                {u.path}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">What landed in Phase A</p>
        <ul className="mt-2 space-y-1 text-sm text-brand-inkSoft">
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> 11 additive Prisma models. Zero column changes on existing tables except 6 optional columns on BonusRule.</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> Idempotent seed for PublicSection, UploadConstraint, DepositNotice, PublicPaymentMethod (incl Upay), BrandAmbassador, Sponsor, and 5 SystemSetting keys.</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> User back-relations for ReferralBalance, ReferralClaim, PromotionClaim. Cascade-delete preserved.</li>
          <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" /> No public site or admin page behaviour changed in Phase A. Phases B-G wire the data through.</li>
        </ul>
      </Card>
    </div>
  );
}
