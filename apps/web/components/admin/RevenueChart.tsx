// Built by Anointed Coder.
//
// 30-day deposit vs withdrawal chart driven by the existing reports
// timeseries endpoint. Reads two series in parallel and merges them
// by date so the chart shows the same daily buckets the rest of the
// admin reports surface uses. No mock fallback - when the endpoint
// fails or returns empty the chart renders an empty grid with a
// short hint instead of inventing numbers.

'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SeriesPoint { ts: string; value: number }
interface SeriesPayload { points: SeriesPoint[] }

interface ChartRow { date: string; deposit: number; withdraw: number; net: number }

function isoDay(ts: string): string {
  return ts.slice(0, 10);
}

export function RevenueChart() {
  const [rows, setRows] = useState<ChartRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [depRes, wdRes] = await Promise.all([
          fetch('/api/admin/reports/timeseries?metric=deposits&granularity=day', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/admin/reports/timeseries?metric=withdrawals&granularity=day', { cache: 'no-store', credentials: 'include' }),
        ]);
        if (!depRes.ok || !wdRes.ok) {
          if (alive) setError('Could not load chart series.');
          return;
        }
        const [dep, wd] = (await Promise.all([depRes.json(), wdRes.json()])) as [SeriesPayload, SeriesPayload];

        const byDay = new Map<string, ChartRow>();
        for (const p of dep.points ?? []) {
          const key = isoDay(p.ts);
          const v = Number(p.value) || 0;
          const row = byDay.get(key) ?? { date: key, deposit: 0, withdraw: 0, net: 0 };
          row.deposit += v;
          byDay.set(key, row);
        }
        for (const p of wd.points ?? []) {
          const key = isoDay(p.ts);
          const v = Number(p.value) || 0;
          const row = byDay.get(key) ?? { date: key, deposit: 0, withdraw: 0, net: 0 };
          row.withdraw += v;
          byDay.set(key, row);
        }
        const merged = Array.from(byDay.values())
          .map((r) => ({ ...r, net: r.deposit - r.withdraw }))
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        if (alive) setRows(merged);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Chart load failed.');
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="h-[280px] w-full">
      {rows === null && !error ? (
        <div className="flex h-full items-center justify-center text-xs text-ink-mid">Loading chart...</div>
      ) : null}
      {error ? (
        <div className="flex h-full items-center justify-center text-xs text-ink-mid">{error}</div>
      ) : null}
      {rows && rows.length === 0 && !error ? (
        <div className="flex h-full items-center justify-center text-xs text-ink-mid">No deposit or withdrawal activity in the last 30 days.</div>
      ) : null}
      {rows && rows.length > 0 ? (
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ left: 0, right: 12, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5d061" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#f5d061" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="wdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#36ff9a" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#36ff9a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(54,255,154,0.08)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#6e8a7a', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} stroke="rgba(54,255,154,0.10)" />
            <YAxis tick={{ fill: '#6e8a7a', fontSize: 11 }} stroke="rgba(54,255,154,0.10)" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              contentStyle={{
                background: '#04100a',
                border: '1px solid rgba(54,255,154,0.20)',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: '#bcd9c6' }}
              cursor={{ stroke: 'rgba(245,208,97,0.30)' }}
            />
            <Area type="monotone" dataKey="deposit" stroke="#f5d061" strokeWidth={2} fill="url(#depGrad)" />
            <Area type="monotone" dataKey="withdraw" stroke="#36ff9a" strokeWidth={2} fill="url(#wdGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
