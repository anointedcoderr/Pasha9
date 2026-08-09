// Built by Anointed Coder.
//
// The player's own wallet audit, shown inside History.
//
// Reads /api/me/wallet-history, which is backed by the same permanent
// WalletLedger the admin audit uses. The point of this screen is the three
// money columns: the balance before a movement, the movement itself, and the
// balance after it. A player who can see those three figures can answer "why
// did my balance change" for themselves, which is the question behind most
// support messages.
//
// History (the Transaction view) stays as it is and still shows in-flight
// items like pending withdrawals. This view shows only settled ledger
// movements, because a record with a balance either side of it does not exist
// until the money has actually moved.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { RefreshCw } from 'lucide-react';

interface AuditRow {
  id: string;
  type: string;
  direction: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  status: string;
  description: string | null;
  reference: string | null;
  game: string | null;
  createdAt: string;
}

const WINDOWS = [7, 15, 30] as const;

export function WalletAuditPanel() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(7);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/me/wallet-history?days=${d}`, { cache: 'no-store', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setRows(Array.isArray(j?.rows) ? (j.rows as AuditRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [load, days]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* A radio group, not a row of buttons: exactly one window is active. */}
        <div role="radiogroup" aria-label={bn ? 'সময়সীমা' : 'Time period'} className="flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={days === w}
              onClick={() => setDays(w)}
              className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40 ${
                days === w
                  ? 'border-brand-yellow-600 bg-brand-yellow-500 font-semibold text-brand-ink'
                  : 'border-brand-divider bg-brand-surface text-brand-inkMute hover:text-brand-ink'
              }`}
            >
              {w} {bn ? 'দিন' : 'days'}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void load(days)} loading={loading}>
          {bn ? 'রিফ্রেশ' : 'Refresh'}
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-signal-danger" role="alert">{error}</p> : null}

      <Card padding="lg">
        {/* Wide table scrolls inside its own box so the page never scrolls sideways on a phone. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-ink-lo">
              <tr className="border-b border-brand-divider">
                <th scope="col" className="py-2 pr-3 font-medium">{bn ? 'সময়' : 'Date & time'}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{bn ? 'ধরন' : 'Type'}</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">{bn ? 'আগে' : 'Before'}</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">{bn ? 'পরিবর্তন' : 'Change'}</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">{bn ? 'পরে' : 'After'}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{bn ? 'অবস্থা' : 'Status'}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{bn ? 'বিবরণ' : 'Details'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const negative = r.amount.trim().startsWith('-');
                return (
                  <tr key={r.id} className="border-b border-brand-divider/60 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-brand-inkMute">{formatDateTime(r.createdAt, lang)}</td>
                    <td className="py-2 pr-3 font-medium text-brand-ink">{r.type}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right text-brand-inkMute">{r.balanceBefore}</td>
                    <td className={`whitespace-nowrap py-2 pr-3 text-right font-semibold ${negative ? 'text-signal-danger' : 'text-signal-ok'}`}>
                      {negative ? '' : '+'}{r.amount}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right font-semibold text-brand-ink">{r.balanceAfter}</td>
                    <td className="py-2 pr-3 text-brand-inkMute">{r.status}</td>
                    <td className="py-2 pr-3 text-brand-inkMute">
                      {r.game ?? r.description ?? <span className="text-ink-lo">.</span>}
                      {r.reference ? <span className="block text-xs text-ink-lo">{bn ? 'রেফ' : 'Ref'} {r.reference}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-brand-inkMute">
            {loading
              ? (bn ? 'লোড হচ্ছে...' : 'Loading...')
              : (bn ? 'এই সময়ে কোনো লেনদেন নেই।' : 'No movements in this period.')}
          </p>
        ) : null}
      </Card>

      <p className="mt-3 text-xs text-brand-inkMute">
        {bn
          ? 'এই তথ্য স্থায়ী রেকর্ড থেকে আসে এবং পরিবর্তন করা যায় না।'
          : 'These figures come from the permanent record and cannot be altered.'}
      </p>
    </>
  );
}
