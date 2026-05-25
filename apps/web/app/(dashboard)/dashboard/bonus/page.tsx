// Built by Anointed Coder.
//
// M2D Bonus Center for signed-in users. Live reads /api/bonuses/me
// for the user's own grants + wallet snapshot, and /api/content/
// promotions for the rule explainer (which active rules are out
// there and how they pay).

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Gift, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface MyGrant {
  id: string;
  amount: number;
  turnoverRequired: number;
  turnoverProgress: number;
  status: string;
  sourceType: string | null;
  claimedAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  note: string | null;
  rule: { id: string; name: string; type: string; description: string | null; turnoverX: number; validityDays: number };
}

interface Promo {
  id: string;
  name: string;
  type: string;
  description: string | null;
  percentage: number;
  amount: number;
  minDeposit: number;
  maxBonus: number;
  turnoverX: number;
  validityDays: number;
  effective: string;
}

interface MeResponse {
  wallet: { balance: number; bonusBalance: number; lockedBalance: number } | null;
  totals: { locked: number; released: number; forfeited: number };
  grants: MyGrant[];
}

function chipFor(status: string): 'info' | 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'active') return 'info';
  if (status === 'completed') return 'ok';
  if (status === 'expired') return 'warn';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hrs}h left`;
  return `${hrs}h left`;
}

export default function BonusCenter() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch('/api/bonuses/me', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/content/promotions', { cache: 'no-store' }),
      ]);
      if (mRes.ok) setMe(await mRes.json());
      else if (mRes.status === 401) setError('Please log in to view your bonuses.');
      if (pRes.ok) {
        const data = await pRes.json();
        setPromos((data.promotions ?? []) as Promo[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = (me?.grants ?? []).filter((g) => g.status === 'active');
  const history = (me?.grants ?? []).filter((g) => g.status !== 'active');

  return (
    <>
      <PageHeader
        title="Bonus Center"
        subtitle="Track active rewards, wagering progress, and available promotions"
        icon={<Gift className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
            Reload
          </Button>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card padding="md" tone="gold">
          <p className="text-xs uppercase tracking-wider text-gold-300">Released</p>
          <p className="mt-1 text-xl font-bold text-gradient-gold">{formatBDT(me?.totals.released ?? 0)}</p>
          <p className="mt-1 text-xs text-ink-mid">Total bonus moved to main wallet after wagering</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-ink-lo">Locked bonus</p>
          <p className="mt-1 text-xl font-bold text-ink-hi">{formatBDT(me?.wallet?.lockedBalance ?? me?.totals.locked ?? 0)}</p>
          <p className="mt-1 text-xs text-ink-mid">Wager to release. Can not be withdrawn.</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-ink-lo">Forfeited</p>
          <p className="mt-1 text-xl font-bold text-ink-hi">{formatBDT(me?.totals.forfeited ?? 0)}</p>
          <p className="mt-1 text-xs text-ink-mid">Expired or cancelled bonuses lifetime</p>
        </Card>
      </div>

      <Card padding="lg" className="mb-6">
        <CardHeader title="Active grants" subtitle="Each row is a bonus the engine has issued you. Bet to clear the turnover requirement and release the funds." />
        {loading ? (
          <p className="text-sm text-ink-mid">Loading...</p>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-5">
            <p className="text-sm text-ink-mid">No active grants right now. Make a qualifying deposit or claim a promo to start wagering one.</p>
            <Link href="/deposit" className="btn-gold inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-ink">
              Make a deposit
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {active.map((g) => {
              const pct = g.turnoverRequired > 0 ? Math.min(100, Math.round((g.turnoverProgress / g.turnoverRequired) * 100)) : 100;
              const left = timeLeft(g.expiresAt);
              return (
                <div key={g.id} className="rounded-xl border border-neon/10 bg-base-deep/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-hi">{g.rule.name}</p>
                      <p className="mt-0.5 text-xs uppercase tracking-wider text-gold-300">{g.rule.type.replace('_', ' ')}</p>
                      {g.rule.description ? <p className="mt-1 text-xs text-ink-mid">{g.rule.description}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-ink-hi">{formatBDT(g.amount)}</p>
                      <Chip tone={chipFor(g.status)} className="mt-1">{g.status}</Chip>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-ink-mid">
                      <span>{formatBDT(g.turnoverProgress)} / {formatBDT(g.turnoverRequired)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-base-deep">
                      <div className="h-full rounded-full bg-grad-gold" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-lo">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {left ?? 'No expiry'}</span>
                    {g.rule.turnoverX > 0 ? <span>{g.rule.turnoverX}x wagering</span> : <span>No wagering</span>}
                    <span>Source: {g.sourceType ?? 'auto'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card padding="lg" className="mb-6">
        <CardHeader title="Available promotions" subtitle="Rules the admin has published. Trigger conditions: a qualifying deposit, a referral, or a manual admin grant." />
        {promos.length === 0 ? (
          <p className="text-sm text-ink-mid">No promotions are live right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {promos.map((p) => (
              <div key={p.id} className="rounded-xl border border-neon/10 bg-base-deep/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gold-300">{p.type.replace('_', ' ')}</p>
                    <p className="mt-1 text-sm font-semibold text-ink-hi">{p.name}</p>
                  </div>
                  {p.maxBonus > 0 ? <Chip tone="gold">Up to {formatBDT(p.maxBonus)}</Chip> : null}
                </div>
                {p.description ? <p className="mt-2 text-xs text-ink-mid">{p.description}</p> : null}
                <p className="mt-2 text-[11px] text-ink-lo">{p.effective}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader title="History" subtitle="Released, expired, or cancelled grants" />
        {history.length === 0 ? (
          <p className="text-sm text-ink-mid">No closed grants yet.</p>
        ) : (
          <ul className="divide-y divide-neon/10">
            {history.map((g) => (
              <li key={g.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-hi">{g.rule.name}</p>
                  <p className="text-xs text-ink-lo">
                    {g.status === 'completed' ? `Released ${g.releasedAt ? new Date(g.releasedAt).toLocaleDateString() : ''}` : null}
                    {g.status === 'expired' ? 'Expired - turnover not met' : null}
                    {g.status === 'cancelled' ? `Cancelled${g.note ? ` - ${g.note}` : ''}` : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink-hi">{formatBDT(g.amount)}</p>
                  <Chip tone={chipFor(g.status)} className="mt-1">{g.status}</Chip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="md" className="mt-6">
        <p className="text-xs text-ink-mid">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          Locked bonus funds count toward your wallet total but can not be withdrawn. Complete the wagering requirement on each grant to release the funds into your main balance.
        </p>
      </Card>
    </>
  );
}
